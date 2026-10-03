# Changelog

## 1.3.9 - 2026-10-02

- Updated the YouTube inline marker button to match the measured YouTube button base style.
- Preserved existing button DOM, placement, responsive behavior, and marker actions.
- Removed the previous custom gradient and inset shadow from the YouTube inline marker button.

## 1.3.9 - 2026-10-03

- Fixed later owner-slot CSS overrides that prevented the measured YouTube button style from appearing.
- Added optional popup medium-quality thumbnail storage/display setting with a gear button.

## 1.3.9 - 2026-10-03

- Redesigned popup media cards into a compact thumbnail-led layout.
- Added All, YouTube, Twitch, and channel filters.
- Moved selection and collapse controls into the thumbnail column to reduce scrolling.

## 1.3.9 - 2026-10-03

- Kept channel name on the same metadata row as marker count.
- Moved per-video export/delete actions into a bottom-right hamburger menu.
- Fixed expand arrow contrast and background.
- Persisted platform/channel filter selection across popup sessions.
- Vertically centered footer version and settings controls; added GitHub and reference notes.

## 1.3.9 - 2026-10-03

- Removed excess vertical space under expanded media cards and compacted marker rows.

## 1.3.9 - 2026-10-03

- Vertically centered thumbnail, title, metadata, and menu controls within compact media cards.

## 1.3.9 - 2026-10-03

- Reworked media-card layout into a single aligned row so the card height is used by the thumbnail and metadata instead of an empty bottom strip.

## 1.3.9 - 2026-10-03

- Added a three-second delete-success toast with undo.
- Added a 30-day trash section in Settings with permanent deletion.
- Permanent deletion sends a purge request that removes local sync metadata and cloud marker records when Drive sync is connected.

## 1.4.3 - 2026-10-02

- 將 TXT 匯入移入設定面板，新增雲端旁漏斗按鈕控制篩選列。
- 單筆標記改用 −5 秒／+5 秒調整並保存時間。
- 影片標題與縮圖可觸發展開／收合。

## 1.4.1 - 2026-10-03

- 重整設定列為圖示加文字，垃圾桶改為按鈕並按需展開。
- 主 Popup 新增批次選取模式；平常隱藏影片勾選框，模式中提供全選影片與取消選取。

## 1.4.2 - 2026-10-03

- 將 Popup 標題列右側操作按鈕移到第二列。
- 設定介面改用線條 SVG 圖示。
- 重做 YouTube 標記按鈕的淺色／深色立體高光與下緣陰影。

## 1.4.3 - 2026-10-03

- 將批次選取控制合併到標題下方第二列的同一個工具列。
- 降低新增、匯出與批次操作按鈕的對比與視覺重量。

## GitHub 上傳資料夾同步 — 2026-10-03

- 主專案與 GitHub 上傳資料夾維持 v1.4.3；本次僅同步，未新增程式功能。
- 檢查 Git 版全部 src、icons、_locales 與 manifest，逐檔比對。
- 同步檔案：manifest.json、src/ui/marker-ui.css、src/sync/sync-engine.js、src/popup/popup.js、src/popup/popup.html、src/popup/popup.css。原因：Git 版仍為 v1.3.1，需要包含主專案現有功能。
- README.md 保留 GitHub 版既有內容，更新版本與最新功能。
- 補上 AI_HANDOFF.md、CHANGELOG.md、VALIDATION_REPORT.md，並重建原有 github-upload.zip。
- 驗證：全部執行檔案 SHA-256 與主專案一致，JavaScript 語法檢查與 ZIP 完整性通過。
- 不需重新測試新功能，因本次未變更主專案程式；實際 Firefox 功能與視覺測試仍未執行。
- 本次同步 Drive 的 Git 上傳資料夾，未執行 GitHub push。
