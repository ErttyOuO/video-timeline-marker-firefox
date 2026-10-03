# AI_HANDOFF

## Current version

- Version: 1.4.3
- Scope: YouTube inline marker button visual styling

## Implementation notes

- Source of truth: `src/ui/marker-ui.css`
- The YouTube button keeps the existing DOM, click handling, placement logic, responsive classes, and marker workflow.
- Applied measured base values: 40px height, 20px radius, 16px horizontal padding, `rgba(255, 255, 255, 0.1)` background, `#f1f1f1` foreground, Roboto 14px/500, no border or shadow.
- Hover and light/dark selectors intentionally preserve the same measured base values because no separate hover capture was provided.

## Do not regress

- Do not change YouTube/Twitch selectors or placement logic while adjusting this visual style.
- Do not use the 92px width measured for the icon-only YouTube notification control; this plugin button contains icon and text.

## v1.4.0 changes

- TXT import is available from the settings gear.
- The funnel button toggles the persisted platform/channel filter toolbar.
- Marker rows use −5/+5 second controls; title and thumbnail clicks toggle group expansion.

- Settings rows use icon plus text; trash contents stay collapsed until requested.
- Batch selection is opt-in and exposes select-all/cancel controls.

- Header actions intentionally wrap to a second row.
- YouTube inline button bevel styles are explicit for light and YouTube dark themes.

- Batch selection controls are inside the same second-row header toolbar as sync/filter/add/export actions.
- Secondary controls intentionally use reduced contrast.

## GitHub 上傳資料夾同步 — 2026-10-03

- 主專案與 GitHub 上傳資料夾維持 v1.4.3；本次僅同步，未新增程式功能。
- 檢查 Git 版全部 src、icons、_locales 與 manifest，逐檔比對。
- 同步檔案：manifest.json、src/ui/marker-ui.css、src/sync/sync-engine.js、src/popup/popup.js、src/popup/popup.html、src/popup/popup.css。原因：Git 版仍為 v1.3.1，需要包含主專案現有功能。
- README.md 保留 GitHub 版既有內容，更新版本與最新功能。
- 補上 AI_HANDOFF.md、CHANGELOG.md、VALIDATION_REPORT.md，並重建原有 github-upload.zip。
- 驗證：全部執行檔案 SHA-256 與主專案一致，JavaScript 語法檢查與 ZIP 完整性通過。
- 不需重新測試新功能，因本次未變更主專案程式；實際 Firefox 功能與視覺測試仍未執行。
- 本次同步 Drive 的 Git 上傳資料夾，未執行 GitHub push。
