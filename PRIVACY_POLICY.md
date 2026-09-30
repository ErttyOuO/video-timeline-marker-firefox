# Privacy Policy — YouTube / Twitch 時間標記 (Video Timeline Marker for YouTube & Twitch)

Last updated: 2026-09-30

## 繁體中文

### 1. 概要

「YouTube / Twitch 時間標記」（Video Timeline Marker for YouTube & Twitch，以下稱「本擴充功能」）以本機優先為設計原則。

在未啟用 Google Drive 同步時，時間標記、備註與媒體資訊只保存在 Firefox 本機。本擴充功能提供**可選用**的 Google Drive 同步；只有使用者主動啟用、通過 Firefox 資料傳輸同意並完成 Google OAuth 授權後，才會將同步資料傳送到使用者自己的 Google Drive。

本擴充功能沒有開發者營運的後端伺服器，開發者不會收到 Google Drive 同步內容。

### 2. 本機處理的資料

為提供時間標記功能，本擴充功能會在支援的 YouTube／Twitch 播放頁面讀取與處理：

- 影片／直播標題；
- 頻道或實況主名稱；
- 影片／直播網址與平台識別資訊；
- 目前播放器時間或直播校準時間；
- 使用者自行輸入的標記備註；
- 標記建立、排序與同步衝突判定所需的時間資訊。

### 3. 本機儲存

標記與備註主要使用 `browser.storage.local` 儲存在使用者自己的 Firefox profile。

Google Drive 同步功能還會在 Firefox 本機保存：

- 公開的 Google OAuth Client ID（應用程式識別碼，不是使用者祕密）。Desktop 類型 OAuth 用戶端的 client secret 依 Google 說明不具機密性，內建於擴充功能原始碼，並不能用來存取任何使用者資料；
- Google OAuth refresh token；
- 同步版本資訊與刪除 tombstone；
- 上次同步時間、狀態與錯誤碼。

OAuth access token 只保存在背景程式記憶體中，過期後使用 refresh token 重新取得。

### 4. 可選用 Google Drive 同步

使用者主動按下「連接 Google Drive」後，本擴充功能才會要求 Firefox optional data-collection consent 與 Google OAuth 授權。

同步使用 Google Drive API 的 `drive.appdata` scope，資料存入使用者 Google Drive 的隱藏 `appDataFolder`，檔名為 `video-timeline-marker-sync.json`。

同步檔可能包含：

- marker ID；
- 影片／直播標題、頻道／實況主、媒體 URL/ID；
- 標記時間與備註；
- per-marker 更新版本；
- 刪除 tombstone；
- 同步 schema 與裝置識別碼。

這些資料會傳送到 Google 的 OAuth / Drive 服務，目的僅是完成使用者要求的跨裝置同步。資料不會經過開發者伺服器。

### 5. Firefox 資料傳輸聲明

核心時間標記功能不需要把資料傳送到擴充功能外部，因此 `data_collection_permissions.required = ["none"]`。

Google Drive 同步是 optional 功能，Manifest 宣告以下 optional data-collection 類型，並在連線時才要求使用者同意：

- `authenticationInfo`：Google OAuth token；
- `websiteActivity`：使用者建立的媒體時間標記與相關網址／時間資訊；
- `websiteContent`：影片／直播標題、頻道／實況主與標記備註等同步內容。

若使用者不同意，Google Drive 同步維持關閉，其他本機功能仍可使用。

### 6. TXT 匯出與回入

TXT 匯出只在使用者主動操作時透過 Firefox `downloads` API 寫入本機裝置。TXT 回入只在擴充功能本機頁面解析。

TXT 匯出／回入本身不會將檔案傳送給開發者或第三方服務。

### 7. 分析、廣告與追蹤

本擴充功能：

- 不使用分析或遙測服務；
- 不使用廣告 SDK；
- 不使用追蹤器；
- 不使用第三方 JavaScript 函式庫或遠端程式碼；
- 不建立開發者後端；
- 不出售、出租或提供使用者資料給開發者。

Google Drive 同步只在使用者選擇啟用時與 Google OAuth / Drive API 通訊。

### 8. 使用者控制

使用者可以：

- 刪除單一或整組本機標記；
- 關閉自動同步；
- 中斷 Google Drive 同步；
- 在 Firefox Add-ons Manager 撤銷 optional data-collection consent；
- 在 Google 帳戶設定撤銷本擴充功能的 Google OAuth 授權；
- 移除本擴充功能。

中斷同步不會刪除本機時間標記。

### 9. Google 使用者資料的存取、使用、分享與保存

- **存取範圍**：僅 `https://www.googleapis.com/auth/drive.appdata`。本擴充功能只能讀寫由它自己建立、位於使用者 Google Drive 隱藏 `appDataFolder` 內的同步檔，無法存取使用者 Drive 中的其他檔案、Gmail、聯絡人或其他 Google 服務資料。
- **使用目的**：僅用於使用者要求的跨裝置標記同步，不作其他用途。
- **不分享、不出售**：不會將 Google 使用者資料提供、轉讓或出售給任何第三方，也不會用於廣告、個人化廣告、再行銷、信用評估或資料經紀。
- **無人為讀取**：開發者沒有伺服器，也沒有任何管道取得或閱讀同步內容。
- **保存位置與期限**：同步檔存放在使用者自己的 Google Drive，直到使用者刪除為止；本機的 refresh token 保存在使用者 Firefox profile，直到使用者中斷連線、撤銷授權或移除擴充功能為止。
- **Limited Use 聲明**：本擴充功能對從 Google API 取得之資訊的使用與轉移，將遵守 [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)，包括其中的 Limited Use 規定。

### 10. 安全性

與 Google 的通訊皆透過 HTTPS。OAuth 使用 PKCE。access token 只保存在背景程式記憶體；refresh token 只保存在 Firefox 本機 `storage.local`，不會傳給開發者。

### 11. 如何刪除資料

- **中斷連線**：在擴充功能的同步面板按「中斷連線」，會撤銷 Google 授權並清除本機 token；本機標記不會被刪除。
- **刪除雲端同步檔**：前往 [Google Drive 設定 → 管理應用程式](https://drive.google.com/drive/settings)，找到本應用程式，選擇「刪除隱藏的應用程式資料」。
- **撤銷授權**：前往 [Google 帳戶的第三方存取權](https://myaccount.google.com/connections) 移除本應用程式。
- **本機資料**：在擴充功能內刪除標記，或移除擴充功能。

### 12. 兒童隱私

本擴充功能不以 13 歲以下兒童為對象，也不會刻意蒐集兒童的個人資料。

### 13. 政策變更

若政策有重大變更，會更新本頁的「Last updated」日期，並在擴充功能更新說明中告知。

### 14. 聯絡方式

開發者：貳緹 (erttyouo)  
Support Email: Eric208311@gmail.com  
GitHub: https://github.com/ErttyOuO  
Firefox Add-ons: https://addons.mozilla.org/zh-TW/firefox/addon/youtube-twitch-%E6%99%82%E9%96%93%E6%A8%99%E8%A8%98/

---

## English

### 1. Summary

“YouTube / Twitch 時間標記” (Video Timeline Marker for YouTube & Twitch, the “Extension”) is local-first. Without Google Drive sync, timeline markers, notes, and media metadata stay inside the user's Firefox profile.

The Extension provides **optional** Google Drive synchronization. Data is transmitted outside the Extension only after the user explicitly enables sync, grants Firefox's optional data-transmission consent, and completes Google OAuth authorization.

The Extension has no developer-operated backend. The developer does not receive the contents of the user's Google Drive sync file.

### 2. Data processed locally

On supported YouTube and Twitch playback pages, the Extension may process:

- video or stream title;
- channel or streamer name;
- media URL and platform identifiers;
- playback position or calibrated live-stream time;
- notes entered by the user;
- timestamps used for ordering and synchronization conflict resolution.

### 3. Local storage

Markers and notes are primarily stored in `browser.storage.local`.

When Google Drive sync is configured, local Firefox storage also contains:

- the public Google OAuth Client ID (an application identifier, not a user secret). The Desktop-type OAuth client secret is, per Google, not confidential; it is embedded in the source code and cannot by itself access any user data;
- a Google OAuth refresh token;
- per-marker synchronization versions and deletion tombstones;
- last-sync status and error information.

Short-lived OAuth access tokens are kept only in background memory and are refreshed when necessary.

### 4. Optional Google Drive synchronization

Only after the user chooses **Connect Google Drive** does the Extension request optional Firefox data-transmission consent and Google OAuth authorization.

Synchronization uses the Google Drive `drive.appdata` scope. The sync file is stored in the user's hidden Google Drive `appDataFolder` as `video-timeline-marker-sync.json`.

The sync file may contain marker IDs, media titles, channel/streamer names, media URLs/IDs, marker times, user notes, per-marker versions, deletion tombstones, sync schema information, and a device identifier.

These values are sent to Google's OAuth and Drive services solely to provide the user-requested cross-device synchronization. They do not pass through a developer server.

### 5. Firefox data-transmission declaration

The core local marker functionality requires no transmission outside the Extension, so the manifest keeps `data_collection_permissions.required = ["none"]`.

Google Drive sync is optional. The manifest declares the following optional data-collection types and requests consent only when the user connects sync:

- `authenticationInfo` — Google OAuth credentials;
- `websiteActivity` — marker/media URLs and timeline interaction data;
- `websiteContent` — media titles, creator names, and user marker notes included in synchronization.

If the user declines, Google Drive synchronization remains disabled and all local features remain available.

### 6. TXT export and re-import

TXT export occurs only after an explicit user action through Firefox's `downloads` API. TXT re-import is parsed locally in an extension page. TXT import/export itself does not upload files to the developer or to a third-party service.

### 7. Analytics, advertising, and tracking

The Extension uses no analytics, telemetry, advertising SDK, tracker, third-party JavaScript library, remote code, or developer backend. It does not sell or rent user data.

Google OAuth / Drive traffic occurs only when the user enables the optional Google Drive synchronization feature.

### 8. User control

Users can delete markers, disable automatic synchronization, disconnect Google Drive, revoke optional data-transmission consent in Firefox, revoke Google OAuth access from their Google Account, or remove the Extension. Disconnecting synchronization does not delete local timeline markers.

### 9. Google user data: access, use, sharing, and retention

- **Access scope**: only `https://www.googleapis.com/auth/drive.appdata`. The Extension can read and write only its own sync file inside the hidden `appDataFolder` of the user's Google Drive. It cannot access any other Drive files, Gmail, Contacts, or other Google service data.
- **Purpose**: solely to provide the cross-device marker synchronization the user requested. Nothing else.
- **No sharing or sale**: Google user data is not transferred, disclosed, or sold to any third party, and is not used for advertising, personalized advertising, retargeting, credit assessment, or data brokering.
- **No human access**: the developer operates no server and has no means to obtain or read sync contents.
- **Storage and retention**: the sync file remains in the user's own Google Drive until the user deletes it. The local refresh token remains in the user's Firefox profile until the user disconnects, revokes access, or removes the Extension.
- **Limited Use disclosure**: the Extension's use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including its Limited Use requirements.

### 10. Security

All communication with Google uses HTTPS and OAuth with PKCE. Access tokens live only in background memory; the refresh token is stored only in local Firefox `storage.local` and is never sent to the developer.

### 11. How to delete your data

- **Disconnect**: use “Disconnect” in the Extension's sync panel. This revokes Google authorization and clears local tokens. Local markers are kept.
- **Delete the cloud sync file**: open [Google Drive Settings → Manage apps](https://drive.google.com/drive/settings), find this app, and choose “Delete hidden app data”.
- **Revoke access**: remove the app at [Google Account third-party access](https://myaccount.google.com/connections).
- **Local data**: delete markers inside the Extension or uninstall it.

### 12. Children's privacy

The Extension is not directed to children under 13 and does not knowingly collect their personal information.

### 13. Changes to this policy

Material changes will be reflected by updating the “Last updated” date above and noting them in the Extension's release notes.

### 14. Contact

Developer: 貳緹 (erttyouo)  
Support Email: Eric208311@gmail.com  
GitHub: https://github.com/ErttyOuO  
Firefox Add-ons: https://addons.mozilla.org/zh-TW/firefox/addon/youtube-twitch-%E6%99%82%E9%96%93%E6%A8%99%E8%A8%98/
