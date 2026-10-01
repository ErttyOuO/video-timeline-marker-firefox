// Firefox for Android：popup 以全寬顯示，樣式由 popup.css 的 html.vtm-android 處理。
if (/Android/i.test(navigator.userAgent)) document.documentElement.classList.add("vtm-android");

const KEY = "vtm_markers_v1";
const IMPORT_REPORT_KEY = "vtm_last_import_report_v1";
const GROUP_COLLAPSE_KEY = "vtm_popup_group_collapse_v1";
const t = (key, substitutions) => browser.i18n.getMessage(key, substitutions) || key;
let renderedGroups = [];
let groupCollapseState = Object.create(null);
let groupCollapseLoaded = false;
let syncPanelOpen = false;

function supportedMediaPlatform(urlValue) {
  try {
    const url = new URL(urlValue || "");
    const host = url.hostname.replace(/^(?:www|m)\./, "");
    if (host === "youtube.com") {
      if (url.pathname === "/watch" && url.searchParams.get("v")) return "youtube";
      if (/^\/(?:shorts|live)\/[^/?#]+/.test(url.pathname)) return "youtube";
    }
    if (host === "twitch.tv") {
      if (/^\/videos\/\d+/.test(url.pathname)) return "twitch";
      if (/^\/[^/]+\/?$/.test(url.pathname) && !/^\/(?:directory|downloads|jobs|p|settings|subscriptions)\/?$/.test(url.pathname)) return "twitch";
    }
  } catch {}
  return null;
}

async function getActiveSupportedMediaTab() {
  const preferredQueries = [
    { active: true, currentWindow: true },
    { active: true, lastFocusedWindow: true }
  ];

  let anyPreferredTab = false;
  for (const query of preferredQueries) {
    let tabs = [];
    try { tabs = await browser.tabs.query(query); } catch { continue; }
    if (tabs?.length) anyPreferredTab = true;
    for (const tab of tabs || []) {
      if (!tab?.id) continue;
      const platform = supportedMediaPlatform(tab.url);
      if (platform) return { tab, platform };
    }
  }

  // 只有瀏覽器沒有回傳任何 current/last-focused active tab 時才做跨視窗備援，
  // 避免在目前頁不是影片時誤標記另一個視窗的 YouTube。
  if (anyPreferredTab) return null;

  try {
    const tabs = await browser.tabs.query({ active: true });
    for (const tab of tabs || []) {
      const platform = supportedMediaPlatform(tab?.url);
      if (tab?.id && platform) return { tab, platform };
    }
  } catch {}
  return null;
}

const CAPTURE_DEPENDENCY_FILES = {
  youtube: [
    "src/core/namespace.js",
    "src/platforms/youtube/youtube-detector.js",
    "src/platforms/youtube/youtube-metadata.js",
    "src/platforms/youtube/youtube-timeline.js"
  ],
  twitch: [
    "src/core/namespace.js",
    "src/platforms/twitch/twitch-detector.js",
    "src/platforms/twitch/twitch-metadata.js",
    "src/platforms/twitch/twitch-timeline.js"
  ]
};

async function pingCaptureBridge(tabId) {
  try {
    return await browser.tabs.sendMessage(tabId, { type: "VTM_CAPTURE_BRIDGE_PING" });
  } catch {
    return null;
  }
}

async function ensureCaptureBridge(tabId, platform) {
  let state = await pingCaptureBridge(tabId);
  if (state?.supported) return true;

  if (!browser.scripting?.executeScript) return false;
  try {
    // 先只補 capture bridge。這可處理「擴充套件更新後，舊分頁仍有上一版平台模組」的常見情況，
    // 不會重複掛載 marker UI、timer 或頁面事件。
    await browser.scripting.executeScript({
      target: { tabId },
      files: ["src/content/popup-capture-bridge.js"]
    });
    state = await pingCaptureBridge(tabId);
    if (state?.supported) return true;

    // 若分頁是在擴充套件安裝前就已經開著，連平台模組也不存在；只補讀取目前時間
    // 所需的 namespace/detector/metadata/timeline，不注入頁面 UI 與常駐 content controller。
    await browser.scripting.executeScript({
      target: { tabId },
      files: CAPTURE_DEPENDENCY_FILES[platform] || []
    });
    state = await pingCaptureBridge(tabId);
    return Boolean(state?.supported);
  } catch (error) {
    console.warn("[VTM] unable to inject capture bridge", error);
    return false;
  }
}

function popupMarkerId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `vtm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function captureMarkerFromCurrentTab() {
  const active = await getActiveSupportedMediaTab();
  if (!active) return { ok: false, reason: "unsupported" };
  const { tab, platform } = active;
  if (!await ensureCaptureBridge(tab.id, platform)) return { ok: false, reason: "bridge_unavailable" };

  const result = await browser.tabs.sendMessage(tab.id, { type: "VTM_CAPTURE_FROM_POPUP" });
  if (!result?.ok || !result.capture) return result || { ok: false, reason: "capture_failed" };

  const captured = result.capture;
  const marker = {
    ...captured,
    id: popupMarkerId(),
    capturedAt: new Date().toISOString(),
    note: "",
    vodResolution: captured.mediaType === "live" && platform === "twitch"
      ? { status: "pending", vodId: null, vodUrl: null, resolvedPositionSeconds: null }
      : { status: "not_needed", vodId: null, vodUrl: null, resolvedPositionSeconds: null }
  };

  const markers = await getAll();
  markers.push(marker);
  await setAll(markers);
  return { ok: true, marker };
}

function setSyncPanelOpen(open) {
  syncPanelOpen = Boolean(open);
  const panel = document.getElementById("sync-panel");
  const toggle = document.getElementById("sync-panel-toggle");
  if (panel) panel.hidden = !syncPanelOpen;
  if (toggle) toggle.setAttribute("aria-expanded", syncPanelOpen ? "true" : "false");
}

function applyLocale() {
  const language = browser.i18n.getUILanguage?.() || navigator.language || "en";
  document.documentElement.lang = language;
  document.getElementById("popup-title").textContent = t("popupTitle");
  document.getElementById("popup-subtitle").textContent = t("popupSubtitle");
  document.getElementById("import-txt").textContent = t("importTxt");
  const syncToggle = document.getElementById("sync-panel-toggle");
  syncToggle.title = t("syncTitle");
  syncToggle.setAttribute("aria-label", t("syncTitle"));
  const syncClose = document.getElementById("sync-panel-close");
  syncClose.title = t("close");
  syncClose.setAttribute("aria-label", t("close"));
  document.getElementById("add-marker-current").textContent = t("popupAddCurrent");
  document.getElementById("export-all").textContent = t("exportAll");
  document.getElementById("select-all-label").textContent = t("selectAllMedia");
  document.getElementById("import-report-details-label").textContent = t("importDetails");
  document.getElementById("sync-title").textContent = t("syncTitle");
  document.getElementById("sync-auto-label").textContent = t("syncAuto");
  document.getElementById("sync-now").textContent = t("syncNow");
  document.getElementById("sync-disconnect").textContent = t("syncDisconnect");
  document.getElementById("sync-setup-help").textContent = t("syncSetupHelp");
  document.getElementById("sync-connect").textContent = t("syncConnect");
  const closeReport = document.getElementById("import-report-close");
  closeReport.title = t("closeImportReport");
  closeReport.setAttribute("aria-label", t("closeImportReport"));
  document.title = t("extensionName");
  updateBatchButtons();
}


async function updateAddMarkerAvailability() {
  const button = document.getElementById("add-marker-current");
  button.disabled = true;
  button.title = t("popupAddCurrentUnavailable");

  const active = await getActiveSupportedMediaTab();
  if (!active) return;

  // URL 已明確是支援的觀看頁時先允許操作；點擊時再確認播放器與 capture bridge。
  // 這樣 extension 更新後舊分頁尚未重新注入 content script，也不會讓按鈕永久灰掉。
  button.disabled = false;
  button.title = t("markCurrentTime");
}

function syncErrorText(error) {
  const rawCode = typeof error === "string" ? error : (error?.code || error?.message || "");
  const code = String(rawCode || "").replace(/^Error:\s*/i, "").trim();
  const known = {
    invalid_client_id: "syncErrorInvalidClientId",
    not_connected: "syncErrorNotConnected",
    invalid_grant: "syncErrorAuthorizationExpired",
    unauthorized_client: "syncErrorAuthorizationExpired",
    oauth_client_changed: "syncErrorAuthorizationExpired",
    scope_not_granted: "syncErrorScope",
    missing_refresh_token: "syncErrorRefreshToken",
    oauth_state_mismatch: "syncErrorOauthState",
    oauth_missing_code: "syncErrorOauthCode",
    oauth_launch_failed: "syncErrorOauthLaunch",
    oauth_connect_failed: "syncErrorOauthLaunch",
    oauth_user_cancelled: "syncErrorOauthCancelled",
    oauth_timeout: "syncErrorOauthTimeout",
    oauth_fallback_unavailable: "syncErrorOauthFallback",
    oauth_fallback_failed: "syncErrorOauthFallback",
    redirect_uri_mismatch: "syncErrorRedirectUri",
    invalid_request: "syncErrorInvalidRequest",
    invalid_client: "syncErrorInvalidClient",
    deleted_client: "syncErrorInvalidClient",
    org_internal: "syncErrorAccountPolicy",
    admin_policy_enforced: "syncErrorAccountPolicy",
    disallowed_useragent: "syncErrorUserAgent",
    data_collection_permission_missing: "syncErrorDataPermission",
    data_collection_permission_denied: "syncErrorDataPermission",
    access_denied: "syncErrorAccessDenied",
    cloud_json_invalid: "syncErrorCloudInvalid",
    cloud_schema_unsupported: "syncErrorSchema",
    drive_list_failed: "syncErrorDrive",
    drive_metadata_failed: "syncErrorDrive",
    drive_download_failed: "syncErrorDrive",
    drive_create_failed: "syncErrorDrive",
    drive_update_failed: "syncErrorDrive"
  };
  const key = known[code];
  const base = t(key || "syncErrorGeneric");
  const detail = String(error?.detail || "").trim();
  const providerDetailCodes = new Set([
    "oauth_launch_failed",
    "oauth_connect_failed",
    "oauth_fallback_failed",
    "access_denied",
    "invalid_request",
    "redirect_uri_mismatch",
    "invalid_client",
    "deleted_client",
    "unauthorized_client",
    "admin_policy_enforced",
    "org_internal",
    "disallowed_useragent"
  ]);
  if (detail && providerDetailCodes.has(code)) {
    return `${base}\n${t("syncErrorProviderDetail")}: ${detail.slice(0, 600)}`;
  }
  return key || !code ? base : `${base} (${code})`;
}

function formatSyncTime(value) {
  if (!value) return t("syncNever");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("syncNever");
  return date.toLocaleString();
}

function setSyncBusy(busy, labelKey = null) {
  for (const id of ["sync-now", "sync-connect", "sync-disconnect", "sync-auto"]) {
    const element = document.getElementById(id);
    if (element) element.disabled = Boolean(busy);
  }
  const badge = document.getElementById("sync-status-badge");
  if (busy && badge) {
    badge.dataset.state = "syncing";
    badge.textContent = t(labelKey || "syncStatusSyncing");
  }
}

function renderSyncStatus(status, transientError = null) {
  if (!status) return;
  const connected = Boolean(status.connected && status.enabled);
  const badge = document.getElementById("sync-status-badge");
  const summary = document.getElementById("sync-summary");
  const connectedPanel = document.getElementById("sync-connected");
  const setup = document.getElementById("sync-setup");
  const auto = document.getElementById("sync-auto");
  const last = document.getElementById("sync-last");
  const errorNode = document.getElementById("sync-error");

  if (auto) auto.checked = status.autoSync !== false;
  if (connectedPanel) connectedPanel.hidden = !connected;
  if (setup) setup.hidden = connected;

  const effectiveError = transientError || status.lastError;
  if (effectiveError) {
    badge.dataset.state = "error";
    badge.textContent = t("syncStatusError");
    errorNode.textContent = syncErrorText(effectiveError);
  } else if (status.syncing) {
    badge.dataset.state = "syncing";
    badge.textContent = t("syncStatusSyncing");
    errorNode.textContent = "";
  } else if (connected) {
    badge.dataset.state = "connected";
    badge.textContent = t("syncStatusConnected");
    errorNode.textContent = "";
  } else {
    badge.dataset.state = "off";
    badge.textContent = t("syncStatusOff");
    errorNode.textContent = "";
  }

  const toolbarToggle = document.getElementById("sync-panel-toggle");
  const toolbarIndicator = document.getElementById("sync-toolbar-indicator");
  const toolbarState = effectiveError ? "error" : status.syncing ? "syncing" : connected ? "connected" : "off";
  if (toolbarToggle) toolbarToggle.dataset.state = toolbarState;
  if (toolbarIndicator) toolbarIndicator.dataset.state = toolbarState;

  summary.textContent = connected
    ? t("syncSummaryConnected", [String(status.markerCount || 0)])
    : t("syncSummaryDisconnected");

  if (connected) {
    const duplicateWarning = Number(status.lastStats?.duplicateCloudFiles || 0) > 0
      ? ` · ${t("syncDuplicateWarning", [String(status.lastStats.duplicateCloudFiles)])}`
      : "";
    last.textContent = `${t("syncLast", [formatSyncTime(status.lastSyncAt)])}${duplicateWarning}`;
  } else {
    last.textContent = "";
  }
}

async function loadSyncStatus({ refreshIfStale = false } = {}) {
  const status = await browser.runtime.sendMessage({ type: "VTM_SYNC_GET_STATUS" });
  renderSyncStatus(status);

  const lastMs = status?.lastSyncAt ? new Date(status.lastSyncAt).getTime() : 0;
  const stale = !lastMs || Date.now() - lastMs > 60_000;
  if (refreshIfStale && status?.connected && status?.enabled && status?.autoSync && stale) {
    setSyncBusy(true);
    try {
      const result = await browser.runtime.sendMessage({ type: "VTM_SYNC_NOW", reason: "popup" });
      renderSyncStatus(result?.status || await browser.runtime.sendMessage({ type: "VTM_SYNC_GET_STATUS" }));
      if (result?.stats?.localChanged) await render();
    } catch (error) {
      const latest = await browser.runtime.sendMessage({ type: "VTM_SYNC_GET_STATUS" }).catch(() => status);
      renderSyncStatus(latest, error);
    } finally {
      setSyncBusy(false);
    }
  }
  return status;
}

async function connectGoogleDrive() {
  try {
    const granted = await browser.permissions.request({
      data_collection: ["authenticationInfo", "websiteActivity", "websiteContent"]
    });
    if (granted === false) {
      const error = new Error("data_collection_permission_denied");
      error.code = "data_collection_permission_denied";
      const status = await browser.runtime.sendMessage({ type: "VTM_SYNC_GET_STATUS" }).catch(() => null);
      renderSyncStatus(status || { connected: false, enabled: false }, error);
      return;
    }
  } catch (error) {
    // 部分環境（例如 Firefox for Android）可能不支援 data_collection 權限 API：
    // 此時不視為使用者拒絕，繼續走 Google 授權流程（Firefox 安裝時已顯示資料傳輸聲明）。
    console.warn("[VTM Sync] data collection permission request unavailable; continuing", error);
  }

  setSyncBusy(true, "syncStatusConnecting");
  try {
    const result = await browser.runtime.sendMessage({ type: "VTM_SYNC_CONNECT" });
    renderSyncStatus(result?.status, result?.authError || result?.syncError);
    if (result?.status?.connected) await render();
  } catch (error) {
    const status = await browser.runtime.sendMessage({ type: "VTM_SYNC_GET_STATUS" }).catch(() => null);
    renderSyncStatus(status || { connected: false, enabled: false }, error);
  } finally {
    setSyncBusy(false);
  }
}

async function syncNow() {
  setSyncBusy(true);
  try {
    const result = await browser.runtime.sendMessage({ type: "VTM_SYNC_NOW", reason: "manual" });
    renderSyncStatus(result?.status);
    if (result?.stats?.localChanged) await render();
  } catch (error) {
    const status = await browser.runtime.sendMessage({ type: "VTM_SYNC_GET_STATUS" }).catch(() => null);
    renderSyncStatus(status, error);
  } finally {
    setSyncBusy(false);
  }
}

async function disconnectGoogleDrive() {
  if (!(await confirmAction({ title: t("syncDisconnect"), message: t("syncConfirmDisconnect"), confirmLabel: t("syncDisconnect") }))) return;
  setSyncBusy(true);
  try {
    const status = await browser.runtime.sendMessage({ type: "VTM_SYNC_DISCONNECT" });
    try {
      await browser.permissions.remove({
        data_collection: ["authenticationInfo", "websiteActivity", "websiteContent"]
      });
    } catch {}
    renderSyncStatus(status);
  } catch (error) {
    const status = await browser.runtime.sendMessage({ type: "VTM_SYNC_GET_STATUS" }).catch(() => null);
    renderSyncStatus(status, error);
  } finally {
    setSyncBusy(false);
  }
}

function formatClock(value) {
  const total = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : null;
  if (total === null) return "--:--";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function accuracyLabel(value) {
  return ({ exact: t("exact"), calibrated: t("calibrated"), estimated: t("estimated") })[value] || value || t("unknown");
}

function mediaTypeLabel(value) {
  return ({ live: t("live"), video: t("video"), vod: t("vod") })[String(value || "").toLowerCase()] || value || "";
}

function twitchTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h ? `${h}h` : ""}${m || h ? `${m}m` : ""}${sec}s`;
}

function markerUrl(marker) {
  const seconds = marker.vodResolution?.resolvedPositionSeconds ?? marker.positionSeconds ?? marker.timeline?.playerCurrentTime;
  if (marker.platform === "youtube" && marker.mediaId && Number.isFinite(Number(seconds))) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(marker.mediaId)}&t=${Math.floor(Number(seconds))}s`;
  }
  if (marker.platform === "twitch") {
    const vodId = marker.vodResolution?.vodId || (marker.mediaType === "vod" ? marker.mediaId : null);
    if (vodId && Number.isFinite(Number(seconds))) {
      return `https://www.twitch.tv/videos/${vodId}?t=${twitchTime(seconds)}`;
    }
  }
  return marker.canonicalUrl || marker.originalUrl || null;
}

function mediaGroupKey(marker) {
  return `${marker.platform || "unknown"}:${marker.mediaId || marker.canonicalUrl || marker.originalUrl || "unknown"}`;
}

function markerTimelineSeconds(marker) {
  const value = marker?.vodResolution?.resolvedPositionSeconds ?? marker?.positionSeconds ?? marker?.timeline?.playerCurrentTime;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : null;
}

function compareMarkersByTimelineAsc(a, b) {
  const aSeconds = markerTimelineSeconds(a);
  const bSeconds = markerTimelineSeconds(b);
  if (aSeconds !== null && bSeconds !== null && aSeconds !== bSeconds) return aSeconds - bSeconds;
  if (aSeconds !== null && bSeconds === null) return -1;
  if (aSeconds === null && bSeconds !== null) return 1;
  return new Date(a?.capturedAt || 0) - new Date(b?.capturedAt || 0);
}

function groupMarkers(markers) {
  const groups = new Map();
  for (const marker of markers) {
    const key = mediaGroupKey(marker);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(marker);
  }
  return Array.from(groups, ([key, items]) => {
    items.sort(compareMarkersByTimelineAsc);
    const latestCaptured = items.reduce((latest, marker) => {
      if (!latest) return marker;
      return new Date(marker?.capturedAt || 0) > new Date(latest?.capturedAt || 0) ? marker : latest;
    }, null);
    return {
      key,
      markers: items,
      latestAt: latestCaptured?.capturedAt || "",
      first: latestCaptured || items[0]
    };
  }).sort((a, b) => new Date(b.latestAt) - new Date(a.latestAt));
}

async function getAll() {
  const result = await browser.storage.local.get(KEY);
  return Array.isArray(result[KEY]) ? result[KEY] : [];
}

async function setAll(markers) {
  await browser.storage.local.set({ [KEY]: markers });
}

async function loadGroupCollapseState() {
  if (groupCollapseLoaded) return;
  const result = await browser.storage.local.get(GROUP_COLLAPSE_KEY);
  const stored = result[GROUP_COLLAPSE_KEY];
  groupCollapseState = stored && typeof stored === "object" && !Array.isArray(stored)
    ? { ...stored }
    : Object.create(null);
  groupCollapseLoaded = true;
}

async function saveGroupCollapseState() {
  await browser.storage.local.set({ [GROUP_COLLAPSE_KEY]: groupCollapseState });
}

function groupIsCollapsed(groupKey, groupIndex) {
  if (Object.prototype.hasOwnProperty.call(groupCollapseState, groupKey)) {
    return Boolean(groupCollapseState[groupKey]);
  }
  // Keep the most recently used group open; older groups start compact.
  return groupIndex > 0;
}

function applyGroupCollapsedState(groupNode, markerList, toggle, collapsed, title) {
  groupNode.classList.toggle("is-collapsed", collapsed);
  markerList.hidden = collapsed;
  toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  const label = collapsed ? t("expandMedia") : t("collapseMedia");
  toggle.title = label;
  toggle.setAttribute("aria-label", `${label}: ${title}`);
}

async function toggleGroupCollapsed(group, groupIndex, groupNode, markerList, toggle) {
  const collapsed = !groupNode.classList.contains("is-collapsed");
  groupCollapseState[group.key] = collapsed;
  applyGroupCollapsedState(groupNode, markerList, toggle, collapsed, group.first?.title || t("unnamedVideo"));
  try {
    await saveGroupCollapseState();
  } catch (error) {
    console.warn("[VTM] failed to persist popup collapse state", error);
  }
}

async function pruneGroupCollapseState(groups) {
  const valid = new Set(groups.map((group) => group.key));
  let changed = false;
  for (const key of Object.keys(groupCollapseState)) {
    if (!valid.has(key)) {
      delete groupCollapseState[key];
      changed = true;
    }
  }
  if (changed) {
    try {
      await saveGroupCollapseState();
    } catch (error) {
      console.warn("[VTM] failed to prune popup collapse state", error);
    }
  }
}

async function editNote(id) {
  const all = await getAll();
  const marker = all.find((m) => m.id === id);
  if (!marker) return;
  const next = window.prompt(t("editNote"), marker.note || "");
  if (next === null) return;
  marker.note = next.trim();
  await setAll(all);
  await render();
}

// 自訂確認視窗（取代 window.confirm）。auto=true 時 1 秒內沒在視窗內移動滑鼠就自動確定。
async function confirmAction({ title, message, confirmLabel, auto = false }) {
  const dialog = globalThis.__VTM_CONFIRM__?.confirmDialog;
  if (!dialog) return window.confirm(message);
  return dialog({
    title,
    message,
    confirmLabel,
    cancelLabel: auto ? t("confirmKeep") : t("cancel"),
    autoConfirmMs: auto ? 1000 : 0,
    hintAuto: auto ? t("confirmAutoHint") : "",
    hintPaused: auto ? t("confirmPausedHint") : ""
  });
}

async function removeMarker(id) {
  if (!(await confirmAction({ title: t("confirmDeleteTitle"), message: t("confirmDelete"), confirmLabel: t("delete"), auto: true }))) return;
  const all = await getAll();
  await setAll(all.filter((m) => m.id !== id));
  await render();
}

function selectedGroupKeys() {
  return Array.from(document.querySelectorAll(".group-select:checked"), (input) => input.dataset.groupKey).filter(Boolean);
}

function selectedGroups() {
  const keys = new Set(selectedGroupKeys());
  return renderedGroups.filter((group) => keys.has(group.key));
}

function updateBatchButtons() {
  const selected = selectedGroupKeys();
  const exportButton = document.getElementById("export-selected");
  const deleteButton = document.getElementById("delete-selected");
  if (exportButton) {
    exportButton.disabled = selected.length === 0;
    exportButton.textContent = selected.length
      ? t("exportSelectedCount", [String(selected.length)])
      : t("exportSelected");
  }
  if (deleteButton) {
    deleteButton.disabled = selected.length === 0;
    deleteButton.textContent = selected.length
      ? t("deleteSelectedCount", [String(selected.length)])
      : t("deleteSelected");
  }

  const selectAll = document.getElementById("select-all-groups");
  if (!selectAll) return;
  const total = renderedGroups.length;
  selectAll.checked = total > 0 && selected.length === total;
  selectAll.indeterminate = selected.length > 0 && selected.length < total;
}

function exportGroup(group) {
  if (!group?.markers?.length) return;
  return browser.runtime.sendMessage({ type: "VTM_EXPORT", markerIds: group.markers.map((marker) => marker.id) });
}

function exportSelectedGroups() {
  const markerIds = selectedGroups().flatMap((group) => group.markers.map((marker) => marker.id));
  if (!markerIds.length) return;
  return browser.runtime.sendMessage({ type: "VTM_EXPORT", markerIds });
}

async function deleteGroup(group) {
  if (!group?.markers?.length) return;
  const title = group.first?.title || t("unnamedVideo");
  const confirmed = await confirmAction({ title: t("confirmDeleteBatchTitle"), message: t("confirmDeleteMedia", [title, String(group.markers.length)]), confirmLabel: t("delete") });
  if (!confirmed) return;
  const ids = new Set(group.markers.map((marker) => marker.id));
  const all = await getAll();
  await setAll(all.filter((marker) => !ids.has(marker.id)));
  await render();
}

async function deleteSelectedGroups() {
  const groups = selectedGroups();
  if (!groups.length) return;
  const markerCount = groups.reduce((count, group) => count + group.markers.length, 0);
  const confirmed = await confirmAction({ title: t("confirmDeleteBatchTitle"), message: t("confirmDeleteSelected", [String(groups.length), String(markerCount)]), confirmLabel: t("delete") });
  if (!confirmed) return;
  const ids = new Set(groups.flatMap((group) => group.markers.map((marker) => marker.id)));
  const all = await getAll();
  await setAll(all.filter((marker) => !ids.has(marker.id)));
  await render();
}

function navigationIdentity(platform, rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (platform === "youtube") {
      const videoId = url.hostname.includes("youtu.be")
        ? url.pathname.split("/").filter(Boolean)[0]
        : url.searchParams.get("v");
      return videoId ? `youtube:video:${videoId}` : null;
    }
    if (platform === "twitch") {
      const vodMatch = url.pathname.match(/^\/videos\/(\d+)/i);
      if (vodMatch) return `twitch:vod:${vodMatch[1]}`;
      const firstPath = url.pathname.split("/").filter(Boolean)[0];
      return firstPath ? `twitch:live:${firstPath.toLowerCase()}` : null;
    }
  } catch {}
  return null;
}

function candidateTabPatterns(platform) {
  if (platform === "youtube") {
    return ["https://www.youtube.com/*", "https://youtube.com/*", "https://m.youtube.com/*"];
  }
  if (platform === "twitch") {
    return ["https://www.twitch.tv/*", "https://twitch.tv/*", "https://m.twitch.tv/*"];
  }
  return [];
}

async function openMarkerSmart(marker) {
  const url = markerUrl(marker);
  if (!url) return;
  const platform = marker.platform === "twitch" ? "twitch" : marker.platform === "youtube" ? "youtube" : "unknown";
  const identity = navigationIdentity(platform, url);
  const patterns = candidateTabPatterns(platform);

  if (!identity || !patterns.length) {
    await browser.tabs.create({ url });
    return;
  }

  try {
    const tabs = await browser.tabs.query({ url: patterns });
    const matches = tabs
      .filter((tab) => tab.id != null && tab.url && navigationIdentity(platform, tab.url) === identity)
      .sort((a, b) => {
        if (Boolean(a.active) !== Boolean(b.active)) return a.active ? -1 : 1;
        return Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0);
      });

    if (matches.length) {
      const targetTab = matches[0];
      await browser.tabs.update(targetTab.id, { url, active: true });
      if (targetTab.windowId != null && browser.windows?.update) {
        try {
          await browser.windows.update(targetTab.windowId, { focused: true });
        } catch {}
      }
      return;
    }
  } catch (error) {
    console.warn("[VTM] existing-tab lookup failed; opening a new tab instead", error);
  }

  await browser.tabs.create({ url });
}

function importFormatLabel(format) {
  if (format === "legacy") return t("importFormatLegacy");
  if (format === "compatible") return t("importFormatCompatible");
  return t("importFormatCurrent");
}

function importWarningLabel(code) {
  if (code === "MISSING_URL") return t("importWarningMissingUrl");
  if (code === "UNKNOWN_PLATFORM") return t("importWarningUnknownPlatform");
  if (code === "MISSING_TITLE") return t("importWarningMissingTitle");
  return code;
}

function reportSeverity(report) {
  if (report.storageError || !report.successFiles) return "error";
  if (report.failedFiles || report.totals.conflicts || report.warningCount) return "warning";
  return "success";
}

function showImportReport(report) {
  const panel = document.getElementById("import-report");
  const title = document.getElementById("import-report-title");
  const summary = document.getElementById("import-report-summary");
  const details = document.getElementById("import-report-details");
  const filesContainer = document.getElementById("import-report-files");
  if (!panel || !title || !summary || !details || !filesContainer) return;

  if (!report) {
    panel.hidden = true;
    filesContainer.replaceChildren();
    return;
  }

  const severity = reportSeverity(report);
  panel.hidden = false;
  panel.dataset.state = severity;
  title.textContent = severity === "error"
    ? `✕ ${t("importResultErrorTitle")}`
    : severity === "warning"
      ? `⚠ ${t("importResultWarningTitle")}`
      : `✓ ${t("importResultSuccessTitle")}`;

  summary.textContent = report.storageError
    ? t("importStorageFailureSummary", [report.storageError])
    : t("importResultSummary", [
        String(report.files.length),
        String(report.totals.parsed),
        String(report.totals.added),
        String(report.totals.updated),
        String(report.totals.skipped),
        String(report.totals.conflicts),
        String(report.failedFiles)
      ]);

  filesContainer.replaceChildren();
  for (const file of report.files) {
    const item = document.createElement("div");
    item.className = `import-file-result ${file.ok ? "is-ok" : "is-failed"}`;

    const name = document.createElement("strong");
    name.textContent = `${file.ok ? "✓" : "✕"} ${file.name}`;
    item.appendChild(name);

    const line = document.createElement("div");
    line.className = "import-file-summary";
    if (file.ok) {
      line.textContent = t("importFileSuccess", [
        importFormatLabel(file.format),
        String(file.parsed),
        String(file.stats.added),
        String(file.stats.updated),
        String(file.stats.skipped),
        String(file.stats.conflicts)
      ]);
    } else {
      line.textContent = t("importFileFailed", [file.reason || t("importErrorUnknown")]);
    }
    item.appendChild(line);

    if (file.warnings?.length) {
      const warningList = document.createElement("ul");
      warningList.className = "import-warnings";
      for (const warning of file.warnings) {
        const li = document.createElement("li");
        li.textContent = importWarningLabel(warning);
        warningList.appendChild(li);
      }
      item.appendChild(warningList);
    }
    filesContainer.appendChild(item);
  }

  details.open = severity !== "success";
}

async function loadImportReport() {
  const result = await browser.storage.local.get(IMPORT_REPORT_KEY);
  showImportReport(result[IMPORT_REPORT_KEY] || null);
}

async function clearImportReport() {
  await browser.storage.local.remove(IMPORT_REPORT_KEY);
  showImportReport(null);
}

async function openImportWindow() {
  const url = browser.runtime.getURL("src/import/import.html");
  try {
    await browser.windows.create({
      url,
      type: "popup",
      width: 620,
      height: 620
    });
  } catch (error) {
    console.warn("[VTM] import window failed; opening import page in a tab", error);
    await browser.tabs.create({ url });
  }
}

async function render() {
  await loadGroupCollapseState();
  const previouslySelected = new Set(selectedGroupKeys());
  const list = document.getElementById("list");
  const itemTemplate = document.getElementById("item-template");
  const groupTemplate = document.getElementById("group-template");
  const all = await getAll();
  renderedGroups = groupMarkers(all);
  await pruneGroupCollapseState(renderedGroups);
  list.replaceChildren();

  const batchToolbar = document.getElementById("batch-toolbar");
  batchToolbar.hidden = renderedGroups.length === 0;

  if (!all.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("popupEmpty");
    list.appendChild(empty);
    updateBatchButtons();
    return;
  }

  for (const [groupIndex, group] of renderedGroups.entries()) {
    const first = group.first;
    const platform = first.platform === "twitch" ? "twitch" : first.platform === "youtube" ? "youtube" : "other";
    const groupNode = groupTemplate.content.firstElementChild.cloneNode(true);
    groupNode.dataset.platform = platform;
    groupNode.dataset.groupKey = group.key;

    const select = groupNode.querySelector(".group-select");
    select.dataset.groupKey = group.key;
    select.checked = previouslySelected.has(group.key);
    select.setAttribute("aria-label", t("selectMediaForBatch", [first.title || t("unnamedVideo")]));
    select.addEventListener("change", updateBatchButtons);

    groupNode.querySelector(".group-title").textContent = first.title || t("unnamedVideo");
    groupNode.querySelector(".group-badge").textContent = `${first.platform || ""} · ${mediaTypeLabel(first.mediaType)} · ${t("markerCount", [String(group.markers.length)])}`;
    groupNode.querySelector(".group-meta").textContent = first.creatorName || t("creatorFallback");

    const groupExport = groupNode.querySelector(".group-export");
    groupExport.textContent = t("exportThisMedia");
    groupExport.addEventListener("click", () => exportGroup(group));

    const groupDelete = groupNode.querySelector(".group-delete");
    groupDelete.textContent = t("deleteThisMedia");
    groupDelete.addEventListener("click", () => deleteGroup(group));

    const markerList = groupNode.querySelector(".group-markers");
    const groupToggle = groupNode.querySelector(".group-toggle");
    const collapsed = groupIsCollapsed(group.key, groupIndex);
    applyGroupCollapsedState(
      groupNode,
      markerList,
      groupToggle,
      collapsed,
      first.title || t("unnamedVideo")
    );
    groupToggle.addEventListener("click", () => {
      toggleGroupCollapsed(group, groupIndex, groupNode, markerList, groupToggle);
    });

    for (const marker of group.markers) {
      const node = itemTemplate.content.firstElementChild.cloneNode(true);
      const seconds = marker.vodResolution?.resolvedPositionSeconds ?? marker.positionSeconds ?? marker.timeline?.playerCurrentTime;
      node.querySelector(".time").textContent = formatClock(seconds);
      node.querySelector(".badge").textContent = accuracyLabel(marker.accuracy);
      node.querySelector(".note").textContent = marker.note || t("noNote");

      const openButton = node.querySelector(".open");
      const editButton = node.querySelector(".edit");
      const exportButton = node.querySelector(".export");
      const deleteButton = node.querySelector(".delete");
      openButton.textContent = t("open");
      openButton.title = t("openReuseHint");
      editButton.textContent = t("editNote");
      exportButton.textContent = t("exportMarker");
      deleteButton.textContent = t("delete");

      openButton.addEventListener("click", () => openMarkerSmart(marker));
      editButton.addEventListener("click", () => editNote(marker.id));
      exportButton.addEventListener("click", () => browser.runtime.sendMessage({ type: "VTM_EXPORT", markerIds: [marker.id] }));
      deleteButton.addEventListener("click", () => removeMarker(marker.id));
      markerList.appendChild(node);
    }

    list.appendChild(groupNode);
  }

  updateBatchButtons();
}

document.getElementById("add-marker-current").addEventListener("click", async () => {
  const button = document.getElementById("add-marker-current");
  if (button.disabled) return;

  const normalLabel = t("popupAddCurrent");
  button.disabled = true;
  try {
    const result = await captureMarkerFromCurrentTab();
    if (!result?.ok) {
      button.title = result?.message || t("popupAddCurrentUnavailable");
      return;
    }

    await render();
    const marker = result.marker;
    button.textContent = `✓ ${formatClock(marker?.positionSeconds)}`;
    button.title = t("markCurrentTime");
    window.setTimeout(() => {
      button.textContent = normalLabel;
      void updateAddMarkerAvailability();
    }, 1400);
  } catch (error) {
    console.warn("[VTM] unable to add marker from popup", error);
    button.title = String(error?.message || t("popupAddCurrentUnavailable"));
  } finally {
    if (button.textContent === normalLabel) await updateAddMarkerAvailability();
  }
});

document.getElementById("export-all").addEventListener("click", () => browser.runtime.sendMessage({ type: "VTM_EXPORT" }));
document.getElementById("export-selected").addEventListener("click", exportSelectedGroups);
document.getElementById("delete-selected").addEventListener("click", deleteSelectedGroups);
document.getElementById("select-all-groups").addEventListener("change", (event) => {
  const checked = Boolean(event.target.checked);
  for (const input of document.querySelectorAll(".group-select")) input.checked = checked;
  updateBatchButtons();
});
document.getElementById("import-txt").addEventListener("click", openImportWindow);
document.getElementById("import-report-close").addEventListener("click", clearImportReport);
document.getElementById("sync-panel-toggle").addEventListener("click", () => setSyncPanelOpen(!syncPanelOpen));
document.getElementById("sync-panel-close").addEventListener("click", () => setSyncPanelOpen(false));
document.getElementById("sync-connect").addEventListener("click", connectGoogleDrive);
document.getElementById("sync-now").addEventListener("click", syncNow);
document.getElementById("sync-disconnect").addEventListener("click", disconnectGoogleDrive);
document.getElementById("sync-auto").addEventListener("change", async (event) => {
  try {
    const status = await browser.runtime.sendMessage({
      type: "VTM_SYNC_UPDATE_SETTINGS",
      settings: { autoSync: Boolean(event.target.checked) }
    });
    renderSyncStatus(status);
  } catch (error) {
    const status = await browser.runtime.sendMessage({ type: "VTM_SYNC_GET_STATUS" }).catch(() => null);
    renderSyncStatus(status, error);
  }
});

applyLocale();
{
  const versionNode = document.getElementById("app-version");
  if (versionNode) versionNode.textContent = `v${browser.runtime.getManifest().version}`;
}
setSyncPanelOpen(false);

// Firefox 的 MV3 不會自動授予網站權限（Android 尤其如此）：沒有授權時，內容腳本不會注入，
// 標記按鈕也就不會出現。偵測到未授權時，在 popup 頂端顯示一個一鍵授權的提示。
async function ensureHostAccessBanner() {
  const origins = ["https://www.youtube.com/*", "https://m.youtube.com/*", "https://www.twitch.tv/*", "https://m.twitch.tv/*"];
  let granted = true;
  try {
    granted = await browser.permissions.contains({ origins });
  } catch {
    return;
  }
  const existing = document.getElementById("host-access-banner");
  if (granted) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const banner = document.createElement("div");
  banner.id = "host-access-banner";
  banner.className = "host-access-banner";
  const text = document.createElement("span");
  text.textContent = t("hostAccessPrompt");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = t("hostAccessButton");
  button.addEventListener("click", async () => {
    try {
      await browser.permissions.request({ origins });
    } catch (error) {
      console.warn("[VTM] host permission request failed", error);
    }
    await ensureHostAccessBanner();
    await updateAddMarkerAvailability();
  });
  banner.append(text, button);
  document.getElementById("list")?.before(banner);
}
void ensureHostAccessBanner();
Promise.all([render(), loadImportReport(), updateAddMarkerAvailability(), loadSyncStatus({ refreshIfStale: true })])
  .catch((error) => console.error("[VTM] popup init failed", error));
