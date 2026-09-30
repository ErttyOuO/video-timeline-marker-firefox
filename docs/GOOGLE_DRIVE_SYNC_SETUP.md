# Google Drive Sync Setup (v1.2.3)

Video Timeline Marker v1.2.3 can optionally synchronize `vtm_markers_v1` between Firefox installations through the user's own Google Drive **Application Data** folder.

The public release has one maintainer-managed Google OAuth 2.0 **Desktop app** Client ID built into `src/sync/google-auth.js`. End users do **not** create Google Cloud credentials and do **not** paste a Client ID into the popup.

The Desktop-app OAuth client ID and its (non-confidential) client secret are embedded in `src/sync/google-auth.js`, as Google requires for its token endpoint. No API key, service-account key, access token, or refresh token is embedded in the extension.

## 1. Maintainer Google Cloud setup

The maintainer of the public add-on must keep the Google Cloud project configured as follows:

1. Enable **Google Drive API**.
2. Configure the Google Auth Platform consent screen for the intended audience.
3. Create an OAuth 2.0 Client ID with application type **Desktop app**.
4. Put only the generated public Client ID (`…apps.googleusercontent.com`) in `DEFAULT_CLIENT_ID` inside `src/sync/google-auth.js`.
5. The Desktop client secret is required by Google's token endpoint and is embedded in `src/sync/google-auth.js`; installed applications cannot keep it confidential. Never commit the downloaded `client_secret_*.json` file itself.
6. During Google OAuth testing, add intended tester accounts if the consent screen is still in Testing status.

Firefox uses `browser.identity.launchWebAuthFlow()` and PKCE. Its loopback redirect URI is derived from the fixed add-on ID at runtime.

## 2. End-user connection flow

1. Install the extension.
2. Open the extension popup.
3. Click **Connect Google Drive**.
4. Firefox asks for the optional data-transmission consent needed by sync.
5. Google asks the user to sign in and authorize only `https://www.googleapis.com/auth/drive.appdata`.
6. After authorization, the extension immediately performs a two-way merge.

The end user never enters an OAuth Client ID.

## 3. What is stored in Drive

The sync file is named:

`video-timeline-marker-sync.json`

It is stored in Google Drive's hidden `appDataFolder`, not in the user's normal My Drive file list.

The cloud file contains marker records, per-marker update versions, deletion tombstones, sync schema metadata and a device identifier. OAuth refresh credentials remain in Firefox local extension storage; short-lived access tokens stay only in background memory.

## 4. Merge rules

- Marker IDs are the primary identity.
- The newer per-marker update timestamp wins.
- A newer tombstone wins over an older live record, so deleted markers do not return from another device.
- Concurrent first-sync duplicate appData files are all merged before the primary file is updated.
- Independent markers from different devices are merged.
- Equal-version conflicts use a deterministic fallback so devices converge.
- Local data is not replaced until cloud JSON and schema validation succeeds.
- Drive `If-Match` is used when an ETag is available; a 412 precondition failure triggers a fresh read/merge retry.

## 5. Automatic synchronization

When enabled, synchronization runs after local marker changes, at Firefox startup, from a stale popup session, approximately every 15 minutes, and whenever the user presses **Sync now**. Marker capture itself remains local-first and never waits for Google Drive.

## 6. OAuth client migration safety

A refresh token is tied to the OAuth client that issued it. If a v1.2.0 development build was authorized with a different Client ID, v1.2.1 treats that credential as needing reconnection instead of attempting to reuse it under the production Client ID.

## 7. Disconnecting

Disconnecting attempts to revoke the stored Google OAuth credential, removes the local refresh token, disables automatic sync, and leaves all local timeline markers intact. The app-data sync file is intentionally not deleted.

## 8. OAuth troubleshooting (v1.2.3)

The authorization request explicitly asks for `access_type=offline` and `prompt=consent`. Firefox receives the callback through its special loopback URI (`http://127.0.0.1/mozoauth2/<extension-hash>`).

If connection fails, the popup now keeps the OAuth error code instead of collapsing every failure into a generic sync message. Common cases include `redirect_uri_mismatch`, `invalid_request`, account-policy errors, and failure to launch the Firefox identity flow.
## Firefox / Zen callback handling

The extension passes the special loopback callback URI to Google as the OAuth `redirect_uri` query parameter. `browser.identity.launchWebAuthFlow()` itself receives only `{ url, interactive }`, matching Firefox's public WebExtension schema. Firefox 86+ is expected to intercept `http://127.0.0.1/mozoauth2/...` before any real localhost network request is made.

### Firefox / Zen launchWebAuthFlow compatibility

The OAuth `redirect_uri` is included in the Google authorization URL and token exchange. It is **not** passed as a top-level property of `browser.identity.launchWebAuthFlow()`, because Firefox-family WebExtension schemas may reject that property with an `Unexpected property "redirect_uri"` TypeError.

### Firefox / Zen callback compatibility

v1.2.7 uses two callback paths. It first calls the standards-compatible `identity.launchWebAuthFlow({ url, interactive })`. If a Firefox derivative such as Zen completes consent but rejects the identity promise with its known callback/cancellation compatibility error, the extension retries once in a controlled authorization tab and listens only for the exact `http://127.0.0.1/mozoauth2/...` navigation through `webNavigation`. The fallback also forces Google's account chooser so the user can explicitly select the configured test account. No local server is required.
## OAuth request compatibility (v1.2.9)

The runtime uses the Google **Desktop / Installed App** authorization-code flow with PKCE.
The authorization request is intentionally limited to the installed-app parameters documented by Google: `client_id`, `redirect_uri`, `response_type=code`, `scope`, `code_challenge`, `code_challenge_method`, and `state`.

Do **not** add `include_granted_scopes=true` to this Desktop client flow. Google documents incremental authorization as unsupported for installed apps/devices. The `drive.appdata` scope is requested as the single scope from the start.

Firefox uses its documented special loopback redirect `http://127.0.0.1/mozoauth2/<extension-subdomain>` for Google OAuth.

