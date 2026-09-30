(() => {
  const root = globalThis;
  const ns = root.__VTM_SYNC__ = root.__VTM_SYNC__ || {};

  const AUTH_KEY = "vtm_google_drive_sync_auth_v1";
  const CONFIG_KEY = "vtm_google_drive_sync_config_v1";
  // Public OAuth Desktop client identifier for the released extension.
  // OAuth client IDs are identifiers, not secrets. Never embed client secrets or user tokens here.
  const DEFAULT_CLIENT_ID = "1042569541115-glt68jueeeqd11flb8fadblibg0tqg9a.apps.googleusercontent.com";
  // Google Desktop/Installed-app clients still require client_secret at the token endpoint.
  // Google documents that installed-app secrets cannot be kept confidential; PKCE protects the flow.
  const DEFAULT_CLIENT_SECRET = "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";
  const DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
  const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
  const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
  const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

  let accessTokenCache = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function randomBase64Url(byteLength = 48) {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  async function sha256Base64Url(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    let binary = "";
    for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function validateClientId(clientId) {
    const value = String(clientId || "").trim();
    if (!value || !/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(value)) {
      const error = new Error("invalid_client_id");
      error.code = "invalid_client_id";
      throw error;
    }
    return value;
  }

  function getRedirectUri() {
    // Firefox for Android 沒有 identity API：改用固定的 loopback 位址，
    // 由 webNavigation 在受控分頁中攔截（Google Desktop client 允許任意 127.0.0.1 路徑）。
    if (typeof browser.identity?.getRedirectURL !== "function") return "http://127.0.0.1/mozoauth2/vtm-android";
    const generated = browser.identity.getRedirectURL();
    const url = new URL(generated);
    const subdomain = url.hostname.split(".")[0];
    return `http://127.0.0.1/mozoauth2/${subdomain}`;
  }

  async function getStoredAuth() {
    const result = await browser.storage.local.get(AUTH_KEY);
    const value = result[AUTH_KEY];
    return value && typeof value === "object" ? value : {};
  }


  async function saveAuth(patch) {
    const current = await getStoredAuth();
    const next = { ...current, ...patch };
    await browser.storage.local.set({ [AUTH_KEY]: next });
    return next;
  }

  function setAccessToken(token, expiresInSeconds) {
    if (!token) {
      accessTokenCache = null;
      return;
    }
    const ttlMs = Math.max(0, Number(expiresInSeconds || 3600)) * 1000;
    accessTokenCache = {
      token,
      expiresAt: Date.now() + ttlMs
    };
  }

  function invalidateAccessToken() {
    accessTokenCache = null;
  }

  async function postToken(params) {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ ...params, client_secret: DEFAULT_CLIENT_SECRET })
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const error = new Error(payload?.error_description || payload?.error || `token_http_${response.status}`);
      error.code = payload?.error || `token_http_${response.status}`;
      error.detail = String(payload?.error_description || "");
      error.httpStatus = response.status;
      throw error;
    }
    return payload;
  }

  function isNativeCallbackCompatibilityFailure(error) {
    const message = String(error?.message || error || "");
    // Zen and some Firefox derivatives can complete Google consent but fail to
    // hand the special loopback callback back to launchWebAuthFlow().  In those
    // builds the API commonly rejects with this generic message even though the
    // user did not actually cancel.  Retry once in the controlled-tab fallback.
    return /user cancelled or denied access/i.test(message)
      || /redirect(?:_uri| uri).*(invalid|not permitted|not allowed|mismatch)/i.test(message)
      || /authorization.*(?:cancelled|canceled|denied)/i.test(message);
  }

  function oauthLaunchError(error, code = "oauth_launch_failed") {
    const wrapped = new Error(String(error?.message || error || code));
    wrapped.code = code;
    wrapped.detail = String(error?.message || error || "");
    return wrapped;
  }

  async function launchAuthorizationTabFallback(authUrl, redirectUri) {
    if (!browser.webNavigation?.onBeforeNavigate || !browser.tabs?.create || !browser.tabs?.update) {
      throw oauthLaunchError("OAuth compatibility fallback is unavailable", "oauth_fallback_unavailable");
    }

    const redirect = new URL(redirectUri);
    const scheme = redirect.protocol.replace(/:$/, "");
    let authTabId = null;
    let settled = false;
    let timeoutId = null;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        try { browser.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate); } catch {}
        try { browser.tabs.onRemoved.removeListener(onTabRemoved); } catch {}
      };

      const closeAuthTab = async () => {
        if (!Number.isInteger(authTabId)) return;
        try { await browser.tabs.remove(authTabId); } catch {}
      };

      const finishResolve = async (url) => {
        if (settled) return;
        settled = true;
        cleanup();
        await closeAuthTab();
        resolve(url);
      };

      const finishReject = async (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        await closeAuthTab();
        reject(error);
      };

      const onBeforeNavigate = (details) => {
        if (settled || details.frameId !== 0 || details.tabId !== authTabId) return;
        if (!String(details.url || "").startsWith(redirectUri)) return;
        void finishResolve(details.url);
      };

      const onTabRemoved = (tabId) => {
        if (settled || tabId !== authTabId) return;
        void finishReject(oauthLaunchError("User cancelled the OAuth tab", "oauth_user_cancelled"));
      };

      try {
        browser.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate, {
          url: [{
            schemes: [scheme],
            hostEquals: redirect.hostname,
            pathPrefix: redirect.pathname
          }]
        });
        browser.tabs.onRemoved.addListener(onTabRemoved);
      } catch (error) {
        void finishReject(oauthLaunchError(error, "oauth_fallback_unavailable"));
        return;
      }

      void (async () => {
        try {
          // Register the navigation listener before loading Google so the callback cannot race us.
          const tab = await browser.tabs.create({ url: "about:blank", active: true });
          authTabId = tab.id;
          if (!Number.isInteger(authTabId)) throw new Error("OAuth tab has no id");
          await browser.tabs.update(authTabId, { url: authUrl });
          timeoutId = setTimeout(() => {
            void finishReject(oauthLaunchError("OAuth compatibility flow timed out", "oauth_timeout"));
          }, 10 * 60 * 1000);
        } catch (error) {
          void finishReject(oauthLaunchError(error, "oauth_fallback_failed"));
        }
      })();
    });
  }

  async function launchAuthorizationFlow(authUrl, redirectUri) {
    if (typeof browser.identity?.launchWebAuthFlow !== "function") {
      return launchAuthorizationTabFallback(authUrl, redirectUri);
    }
    try {
      // Firefox's public WebExtension schema accepts only {url, interactive} here.
      // The OAuth redirect_uri stays inside authUrl, per MDN.  Standard Firefox
      // intercepts the special mozoauth2 loopback callback automatically.
      return await browser.identity.launchWebAuthFlow({
        interactive: true,
        url: authUrl
      });
    } catch (error) {
      // Zen and a few Firefox derivatives can let Google consent finish, then reject
      // the identity promise with a generic cancellation/denial message because the
      // loopback callback was not captured. Retry once with a controlled normal tab.
      if (isNativeCallbackCompatibilityFailure(error)) {
        return launchAuthorizationTabFallback(authUrl, redirectUri);
      }
      throw oauthLaunchError(error);
    }
  }

  async function connect() {
    const clientId = validateClientId(DEFAULT_CLIENT_ID);
    const redirectUri = getRedirectUri();
    const verifier = randomBase64Url(64).slice(0, 96);
    const challenge = await sha256Base64Url(verifier);
    const state = randomBase64Url(32);

    const authUrl = new URL(AUTH_ENDPOINT);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", DRIVE_APPDATA_SCOPE);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("state", state);
    // Keep the Desktop/Installed App request deliberately minimal.
    // Google documents incremental authorization as unsupported for installed apps,
    // so do NOT send include_granted_scopes here. Installed-app token exchanges
    // return a refresh token, therefore access_type/prompt are also unnecessary for
    // the normal first-party connect flow and are omitted to avoid provider-specific
    // invalid_request failures.

    const resultUrl = await launchAuthorizationFlow(authUrl.toString(), redirectUri);

    const returned = new URL(resultUrl);
    const returnedState = returned.searchParams.get("state") || new URLSearchParams(returned.hash.replace(/^#/, "")).get("state");
    if (!returnedState || returnedState !== state) {
      const error = new Error("oauth_state_mismatch");
      error.code = "oauth_state_mismatch";
      throw error;
    }

    const hashParams = new URLSearchParams(returned.hash.replace(/^#/, ""));
    const oauthError = returned.searchParams.get("error") || hashParams.get("error");
    if (oauthError) {
      const description = returned.searchParams.get("error_description") || hashParams.get("error_description") || "";
      const error = new Error(oauthError);
      error.code = oauthError;
      error.detail = description;
      throw error;
    }

    const code = returned.searchParams.get("code") || new URLSearchParams(returned.hash.replace(/^#/, "")).get("code");
    if (!code) {
      const error = new Error("oauth_missing_code");
      error.code = "oauth_missing_code";
      throw error;
    }

    const token = await postToken({
      client_id: clientId,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    });

    const grantedScopes = String(token.scope || "").split(/\s+/).filter(Boolean);
    if (!grantedScopes.includes(DRIVE_APPDATA_SCOPE)) {
      const error = new Error("scope_not_granted");
      error.code = "scope_not_granted";
      throw error;
    }

    if (!token.refresh_token) {
      const error = new Error("missing_refresh_token");
      error.code = "missing_refresh_token";
      throw error;
    }

    setAccessToken(token.access_token, token.expires_in);
    await saveAuth({
      clientId,
      refreshToken: token.refresh_token,
      scope: token.scope || DRIVE_APPDATA_SCOPE,
      connectedAt: nowIso()
    });

    return {
      connected: true,
      scope: token.scope || DRIVE_APPDATA_SCOPE,
      redirectUri
    };
  }

  async function refreshAccessToken() {
    const auth = await getStoredAuth();
    const clientId = validateClientId(DEFAULT_CLIENT_ID);
    if (!auth.refreshToken) {
      const error = new Error("not_connected");
      error.code = "not_connected";
      throw error;
    }

    if (auth.clientId && auth.clientId !== clientId) {
      await browser.storage.local.remove(AUTH_KEY);
      invalidateAccessToken();
      const error = new Error("oauth_client_changed");
      error.code = "oauth_client_changed";
      throw error;
    }

    try {
      const token = await postToken({
        client_id: clientId,
        refresh_token: auth.refreshToken,
        grant_type: "refresh_token"
      });
      setAccessToken(token.access_token, token.expires_in);
      if (token.refresh_token && token.refresh_token !== auth.refreshToken) {
        await saveAuth({ refreshToken: token.refresh_token });
      }
      return token.access_token;
    } catch (error) {
      if (error?.code === "invalid_grant" || error?.code === "unauthorized_client") {
        await browser.storage.local.remove(AUTH_KEY);
        invalidateAccessToken();
      }
      throw error;
    }
  }

  async function getAccessToken(options = {}) {
    const forceRefresh = Boolean(options.forceRefresh);
    if (!forceRefresh && accessTokenCache?.token && accessTokenCache.expiresAt - Date.now() > 90_000) {
      return accessTokenCache.token;
    }
    return refreshAccessToken();
  }

  async function clearLocalAuth() {
    await browser.storage.local.remove(AUTH_KEY);
    invalidateAccessToken();
    return { connected: false };
  }

  async function disconnect() {
    const auth = await getStoredAuth();
    const clientId = DEFAULT_CLIENT_ID;
    const tokenForRevoke = auth.refreshToken || accessTokenCache?.token;

    if (tokenForRevoke) {
      try {
        await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(tokenForRevoke)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
      } catch (error) {
        console.warn("[VTM Sync] token revoke request failed", error);
      }
    }

    await browser.storage.local.remove(AUTH_KEY);
    invalidateAccessToken();
    return { connected: false, clientId: clientId || "" };
  }

  async function getState() {
    const auth = await getStoredAuth();
    const clientId = validateClientId(DEFAULT_CLIENT_ID);
    const clientMatches = !auth.clientId || auth.clientId === clientId;
    return {
      connected: Boolean(auth.refreshToken && clientMatches),
      needsReconnect: Boolean(auth.refreshToken && !clientMatches),
      clientConfigured: true,
      connectedAt: clientMatches ? (auth.connectedAt || null) : null,
      scope: clientMatches ? (auth.scope || null) : null,
      redirectUri: getRedirectUri()
    };
  }

  ns.auth = {
    AUTH_KEY,
    CONFIG_KEY,
    DEFAULT_CLIENT_ID,
    DRIVE_APPDATA_SCOPE,
    validateClientId,
    getRedirectUri,
    getState,
    connect,
    disconnect,
    clearLocalAuth,
    getAccessToken,
    invalidateAccessToken
  };
})();
