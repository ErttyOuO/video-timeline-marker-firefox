# YouTube / Twitch 時間標記

_Video Timeline Marker for YouTube & Twitch_

[在 Firefox Add-ons 安裝 / Install on Firefox Add-ons](https://addons.mozilla.org/zh-TW/firefox/addon/youtube-twitch-%E6%99%82%E9%96%93%E6%A8%99%E8%A8%98/) · [隱私權政策](PRIVACY_POLICY.md) · [服務條款](TERMS_OF_SERVICE.md)

**Version 1.4.3 — Firefox / AMO source**

「YouTube / Twitch 時間標記」是給剪輯師、實況精華整理、研究者與需要記錄影片時間軸的人使用的 Firefox WebExtension。

它支援 YouTube 與 Twitch，可直接在播放頁建立時間標記、輸入備註、微調時間、TXT 匯入／匯出，並在 v1.2.x 加入可選用的 Google Drive 雙向同步。

## 主要功能

- YouTube 一般影片與直播／直播回看時間標記。
- Twitch VOD 與直播時間標記；直播使用頁面直播時計與播放器相對校準。
- 按下 `🔖` 的瞬間立即建立標記。
- 備註欄自動聚焦與 450ms debounce 自動儲存。
- `Enter` 確認並關閉，`Shift+Enter` 換行。
- 標記 UI 開啟時可用 `+` / `-` 調整 ±5 秒。
- 標記時間依媒體時間軸由早到晚排列。
- Popup 依影片／直播分組，支援單筆、單片、批次與全部匯出／刪除。
- Popup 可直接對目前播放中的 YouTube／Twitch 新增標記。
- 可重新匯入本插件匯出的 TXT，並相容舊版輸出格式。
- 「開啟」優先重用已存在的同一媒體分頁。
- 繁中／簡中／英文介面。
- YouTube 一般模式與真正全螢幕有獨立、穩定的標記按鈕掛載策略。
- 不支援 YouTube Shorts 專用介面。

## v1.2.3 — Google Drive 同步

同步是**可選功能**，未連接 Google Drive 時，插件行為與 v1.1.7 一樣，所有標記仍只使用 `browser.storage.local`。

啟用同步後：

- 使用 Google OAuth 2.0 Desktop app + PKCE；正式 OAuth Client ID 已由開發者內建，一般使用者不需自行申請或輸入。
- 僅要求 `drive.appdata` scope。
- 同步檔存放於使用者自己的 Google Drive 隱藏 `appDataFolder`。
- 本機優先：新增／修改標記不等待網路。
- 依 marker ID 與 per-marker version 做雙向 merge。
- 使用 tombstone 同步刪除，避免另一台裝置把已刪除資料復活。
- 兩台裝置若首次同步同時建立雲端檔，會先合併所有同名 appData 檔，再回寫主要同步檔，避免首次競態遺漏標記。
- 自動同步：本機變更後、Firefox 啟動、Popup 開啟時、以及約每 15 分鐘。
- Google Drive JSON 無效、schema 不支援或網路失敗時，不會覆蓋本機標記。
- 中斷同步不會刪除本機標記。

Google Cloud / OAuth 維護與測試說明請看 [docs/GOOGLE_DRIVE_SYNC_SETUP.md](docs/GOOGLE_DRIVE_SYNC_SETUP.md)。

## 隱私

本擴充功能不使用分析、廣告、追蹤器或開發者後端。

預設狀態下，標記、備註與媒體資訊只存放於 Firefox `browser.storage.local`。只有使用者主動啟用 Google Drive 同步並通過 Firefox 與 Google 授權後，才會把時間軸資料傳送到該使用者自己的 Google Drive `appDataFolder`。開發者不會收到同步內容。

詳見 [PRIVACY_POLICY.md](PRIVACY_POLICY.md)。

## 權限

- `storage`：保存本機標記、同步版本資料與同步設定。
- `downloads`：使用者主動匯出時下載 TXT。
- `identity`：使用 Firefox WebExtension OAuth 流程連接 Google。
- `alarms`：低頻排程自動同步。
- `youtube.com` / `twitch.tv`：讀取目前媒體資訊與播放器時間並插入標記 UI。
- `www.googleapis.com` / `oauth2.googleapis.com`：只有啟用 Google Drive 同步後才用於 Drive API 與 OAuth token 更新。

Firefox data-collection consent 仍將核心功能標示為 `required: ["none"]`；Google Drive 同步所需的 `authenticationInfo`、`websiteActivity`、`websiteContent` 宣告為 optional，並在使用者按下連線時才要求同意。

## 開發與封裝

專案使用原生 HTML / CSS / JavaScript，沒有 bundler、minifier、remote code 或第三方 JavaScript library。AMO 上傳包中的 JavaScript 即為 source package 內的 JavaScript，不需要 build step。

## 作者

貳緹 (erttyouo)  
Support: Eric208311@gmail.com  
GitHub: https://github.com/ErttyOuO

## License

Mozilla Public License 2.0 (MPL-2.0). See [LICENSE](LICENSE).

## v1.1.7

- YouTube action-bar marker injection 增加多層 DOM fallback 與 SPA / player 更新後重掛檢查。
- Popup 可直接對目前支援的 YouTube/Twitch 播放頁新增標記。
- 插件全螢幕 UI 隔離鍵盤與 pointer 事件，避免 YouTube 快捷鍵穿透。

## v1.4.3 最新功能

- Popup 使用縮圖清單與可收合的平台／頻道篩選，記住上次的篩選選擇。
- 第二列工具列整合雲端、篩選、新增、匯出與批次選取；平常隱藏影片勾選框。
- 設定提供 TXT 匯入、縮圖儲存／顯示選項及可展開的垃圾桶。
- 標記可直接 −5 秒／+5 秒調整；影片標題與縮圖可展開標記。
- 刪除後顯示三秒復原提示，垃圾桶保留 30 天，提供永久清除。
- YouTube 一般模式標記按鈕提供深／淺色外觀。

本資料夾程式內容已與 Drive 主專案 v1.4.3 同步，保留 GitHub 安裝連結與專屬說明。
