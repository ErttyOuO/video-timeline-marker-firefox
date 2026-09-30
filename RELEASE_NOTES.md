## v1.2.12
- OAuth diagnostics: Google/Firefox provider `error_description` is now shown for authorization failures such as `invalid_request`, redirect mismatch, client errors, policy blocks and browser launch failures instead of collapsing them into a generic message.
- No Google Drive scope change: `drive.appdata` remains the only Drive scope.

## v1.2.11
- Popup marker cards no longer reserve a full row for repeated Open / Edit note / Export marker / Delete controls on mouse/trackpad devices.
- Marker actions now appear as a compact floating tray on card hover or keyboard focus, increasing the number of visible markers.
- Touch/coarse-pointer environments keep marker actions visible so the controls remain accessible without hover.

## v1.2.10
- Popup: Google Drive sync is now a compact cloud control beside Import TXT and stays collapsed by default. Connection/error state is shown on the cloud control; detailed sync controls expand only on demand.
- Popup: Add marker now captures the active YouTube/Twitch playback position directly into `vtm_markers_v1` and refreshes the popup list instead of forcing the page overlay to open.
- Popup: Added on-demand content-script reinjection for already-open supported tabs after an extension update, so Add marker does not remain disabled merely because the tab still has the previous content-script generation.

## v1.2.9

- Rebuilt Google OAuth request parameters against Google's current Desktop/Installed App documentation.
- Removed `include_granted_scopes=true`: Google documents incremental authorization as unsupported for installed apps, and this could surface as `invalid_request`.
- Removed unnecessary `access_type` / forced `prompt` parameters from the normal installed-app request; the flow now sends only the documented core fields plus PKCE/state.
- Kept Firefox's documented `127.0.0.1/mozoauth2/...` loopback redirect and the Zen compatibility callback fallback.
- Drive sync storage remains on the non-sensitive `drive.appdata` scope and `appDataFolder`.

## v1.2.8
- Fixed YouTube normal-page marker placement against the current `ytd-watch-metadata` DOM: `#subscribe-button` is a direct child of `#owner`, so the marker now mounts in a dedicated slot immediately after Subscribe instead of requiring a nonexistent `#buttons`/`#actions` wrapper.
- Subscribe-state changes now select the actually visible button before copying native dimensions, avoiding hidden notification/subscribe controls.

## v1.2.7
- OAuth compatibility flow now follows Firefox's public `launchWebAuthFlow({url, interactive})` schema first and only falls back to a controlled tab after the known Zen callback failure.
- Google consent now explicitly shows the account chooser (`prompt=select_account consent`) to prevent a fallback tab from silently using the wrong signed-in Google account.
- OAuth `error_description` is preserved and shown for `access_denied` diagnostics instead of collapsing every denial to a generic message.

## v1.2.6
- Added a Firefox/Zen OAuth compatibility path. Modern Firefox uses `identity.launchWebAuthFlow` with the explicit loopback redirect hint; browsers that reject that option automatically fall back to a controlled authorization tab.
- The fallback observes only the exact `127.0.0.1/mozoauth2/...` top-level navigation through `webNavigation`, captures the Google authorization response before localhost is loaded, and closes the temporary tab.
- Added specific cancellation, timeout, and fallback error states.

## v1.2.5
- Fixed Google Drive OAuth launch on Firefox/Zen: removed unsupported top-level `redirect_uri` from `browser.identity.launchWebAuthFlow()`. The loopback redirect remains in the Google authorization URL and token exchange, which is the Firefox-compatible form.
- Keeps the v1.2.4 YouTube marker placement beside Join / Subscribe.

## v1.2.4
- YouTube normal mode marker button now prefers the channel action row beside Join / Subscribe instead of the right-side like/share row, preventing the button from being clipped by the action rail.

# v1.2.3

- Fix Google OAuth completion on Firefox-family browsers by explicitly passing the loopback `redirect_uri` to `browser.identity.launchWebAuthFlow()`.
- Prevent the successful Google callback from being loaded as a real `127.0.0.1` page, which previously produced a connection-refused screen and left Google Drive sync disconnected.
- Keep the existing Desktop OAuth + PKCE + `drive.appdata` flow unchanged.

# Release Notes — 1.2.2

## 繁體中文

- 修正 Google Drive 首次連線的 OAuth 可靠性：授權要求明確加入 `access_type=offline`，並保留 `prompt=consent`，確保背景同步所需的 refresh token 流程清楚。
- `browser.identity.launchWebAuthFlow()` 改為只傳 Firefox 文件定義的 `url` 與 `interactive`，redirect URI 只放在 Google OAuth URL 中。
- 修正 Firefox runtime message 可能遺失自訂 `Error.code`，導致所有 OAuth 問題都顯示成「同步失敗」的問題；現在授權錯誤會以結構化資料回傳。
- 新增 `redirect_uri_mismatch`、`invalid_request`、`invalid_client`、Google 帳號/組織政策、user-agent 與授權流程啟動失敗等具體錯誤提示。
- 未更動 marker 資料格式、Drive appDataFolder 格式、同步 merge 規則或既有 YouTube/Twitch 功能。

## English

- Hardened the initial Google Drive OAuth connection by explicitly requesting `access_type=offline` while keeping `prompt=consent`.
- `browser.identity.launchWebAuthFlow()` now receives only the documented `url` and `interactive` options; the redirect URI remains inside the authorization URL.
- Preserved OAuth failure codes across runtime messaging so connection problems no longer collapse into a generic sync error.
- Added targeted diagnostics for redirect URI, invalid request/client, account policy, user-agent, and identity-flow launch failures.

---

# Release Notes — 1.2.1

## 繁體中文

- 內建正式 Google OAuth 2.0 Desktop Client ID；一般使用者不再需要建立 Google Cloud 專案或手動輸入 Client ID。
- Popup 的 Google Drive 設定簡化為「連接 Google Drive」；移除 Client ID 與 redirect URI 的使用者輸入／顯示欄位。
- OAuth Client ID 僅作為公開應用程式識別碼使用；未加入 API key、service-account key 或任何使用者 token。
- v1.2.0 測試版若曾使用不同 OAuth Client ID 取得 refresh token，v1.2.1 不會跨 Client ID 重用該 token，會要求重新授權。
- 同步設定不再接受 runtime Client ID 覆寫；正式版只有單一維護者控制的 OAuth identity source。
- 保留 v1.2.0 的 PKCE、`drive.appdata`、local-first merge、tombstone、ETag/412 retry 與低頻自動同步設計。

## English

- Embedded the production Google OAuth 2.0 Desktop Client ID; end users no longer create or paste their own OAuth client ID.
- Simplified the popup to a single **Connect Google Drive** action while removing the user-facing Client ID and redirect-URI fields.
- No API key, service-account key, access token, or refresh token is embedded in the extension (the Desktop-client secret, which Google treats as non-confidential, is required for token exchange).
- Refresh tokens issued to a different v1.2.0 test client are never reused under the production client; the user is asked to authorize again.
- Runtime Client ID overrides were removed so the release has one maintainer-controlled OAuth identity source.

---

# Release Notes — 1.2.0

## 繁體中文

- 新增可選用 Google Drive 雙向同步，使用使用者自己的 Drive `appDataFolder`，不建立開發者後端。
- Google OAuth 採 Firefox `identity.launchWebAuthFlow` + Desktop app PKCE 授權碼流程，可使用 refresh token 自動續期。
- 本機 `vtm_markers_v1` 保持原格式；新增獨立 sync metadata 與 deletion tombstone，避免已刪除標記被其他裝置同步復活。
- 首次同步競態保護：若多台裝置同時建立同名 appData 檔，後續同步會先合併全部同名雲端檔，再回寫主要檔案。
- 每個 marker 的本機更新版本採單調遞增，降低不同裝置時鐘偏差造成衝突判斷錯誤。
- 同一 marker 發生衝突時依 per-marker update version 合併；相同版本使用 deterministic fallback，讓裝置最終收斂。
- 雲端 JSON/schema 先驗證後才套用本機；Drive ETag 可用時使用 `If-Match`，412 會重新下載、合併、重試。
- 自動同步在本機變更後、Firefox 啟動、Popup 開啟 stale 狀態、以及約每 15 分鐘執行；時間標記本身永遠 local-first，不等待網路。
- Firefox data-collection consent 將 Google Drive 同步所需的 `authenticationInfo`、`websiteActivity`、`websiteContent` 宣告為 optional，只在使用者按下連線時要求。
- Popup 新增 Google Drive 狀態、Client ID 設定、自動同步、立即同步與中斷連線控制。

## English

- Added optional two-way Google Drive synchronization through the user's private Drive `appDataFolder`; no developer backend is used.
- Google OAuth uses Firefox `identity.launchWebAuthFlow` with the Desktop-app PKCE authorization-code flow and refresh tokens.
- Kept `vtm_markers_v1` unchanged while adding separate per-marker sync metadata and deletion tombstones.
- Added concurrent first-sync protection: if multiple devices create same-name appData files, all copies are merged before the primary file is updated.
- Added deterministic conflict resolution, cloud schema validation, ETag-based precondition updates when available, and retry after 412 conflicts.
- Auto-sync runs after local changes, on startup, from a stale popup session, and approximately every 15 minutes while marker capture stays fully local-first.
- Firefox optional data-transmission consent is requested only when the user connects Google Drive.

---

# Release Notes — 1.1.7

## 繁體中文

- 強化 YouTube 一般觀看頁的標記按鈕掛載：不再只依賴 Share 按鈕與單一 actions DOM，支援傳統 `#top-level-buttons-computed`、新版 action view model，以及從 Like / Dislike 群組反推掛載位置。
- YouTube SPA 導航完成後若操作列較晚建立，會在 `yt-page-data-updated` / `yt-player-updated` 再次立即檢查，並保留低頻 2 秒 fallback。
- Popup 新增「＋ 新增標記」；只有目前分頁是支援的 YouTube / Twitch 播放頁時才啟用，點擊後直接建立目前時間標記並開啟備註面板。
- 全螢幕 VTM 面板的 keyboard / pointer / click 事件會在插件 UI 邊界截斷，避免 `J/K/L`、方向鍵、數字鍵、空白鍵或點擊穿透至 YouTube 播放器。
- 修正先前 capture-phase 鍵盤攔截可能連 VTM 自己的 Enter 儲存邏輯一起攔掉的問題。
- 不新增 `tabs` 權限；Popup 只使用既有 Tabs API 能力向目前分頁傳送訊息。

## English

- Hardened YouTube watch-page marker injection with multiple action-bar fallbacks and Like/Dislike anchoring.
- Rechecks placement after YouTube SPA page/player update events while keeping the existing low-frequency fallback timer.
- Added a Popup “＋ Add marker” action that is enabled only on supported YouTube/Twitch playback pages.
- Isolated keyboard, pointer, and click events inside VTM UI so YouTube player shortcuts do not fire while typing or interacting with the overlay.
- Fixed an earlier capture-phase interception approach that could suppress VTM's own Enter handling.
- No new `tabs` permission is required.

---

# Release Notes — 1.1.6

## 繁體中文

- YouTube 真正全螢幕右上角的時間標記按鈕，現在會跟隨 YouTube 原生播放器控制列的自動顯示／隱藏狀態。
- 當 YouTube 因閒置而隱藏播放、暫停、進度列等 chrome 時，VTM 按鈕會同步淡出、隱藏並停止接收點擊。
- 使用者移動滑鼠讓 YouTube 控制列重新出現時，VTM 按鈕會同步恢復。
- 同步直接使用播放器既有的 `ytp-autohide`、`ytp-autohide-active`、`ytp-hide-controls` 狀態，不新增 timer、MutationObserver 或頁面級事件監聽。
- 一般 YouTube 頁面按鈕、Twitch、時間擷取、標記 UI、Popup、TXT 匯入／匯出均未修改。

## English

- The dedicated top-right YouTube fullscreen marker now follows YouTube's native control-chrome visibility.
- When YouTube auto-hides its controls, the VTM button fades out, becomes non-interactive, and returns when mouse movement wakes the native controls.
- The behavior is CSS-driven from YouTube's existing `ytp-autohide`, `ytp-autohide-active`, and `ytp-hide-controls` player states; no extra timer or MutationObserver was added.
