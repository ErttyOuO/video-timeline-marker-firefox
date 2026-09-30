# AMO Listing — 繁體中文

## 正式名稱

YouTube / Twitch 時間標記

## 英文正式名稱

Video Timeline Marker for YouTube & Twitch

## 建議 AMO URL slug

`video-timeline-marker-youtube-twitch`

> 最終是否可用仍以 AMO 建立頁面當下的 slug 可用性為準。

## 摘要（Summary）

為 YouTube／Twitch 快速建立時間標記與備註，支援 ±5 秒微調、批次管理、TXT 匯出／回入，並可選用自己的 Google Drive 跨裝置同步。

## 完整說明（Description）

**給剪輯師、精華剪輯、實況整理，以及所有需要記錄影片時間軸的人。**

觀看 YouTube 或 Twitch 時，常常會遇到某一段之後想剪輯、回看、整理或補充筆記。Video Timeline Marker 讓你不用另外開記事本抄時間，只要在播放頁面按下 `🔖 標記`，就能立即保存目前時間點與影片資訊。

### 一按就記錄

按下標記按鈕的瞬間就會建立標記，不需要再按第二次儲存。介面開啟後游標會直接進入備註欄，可以立即輸入內容；停止輸入後備註會自動保存。

### 快速鍵盤流程

- `Enter`：確認並關閉標記介面
- `Shift + Enter`：備註換行
- `+`：目前標記 +5 秒
- `-`：目前標記 -5 秒

即使正在備註欄輸入，`+` / `-` 仍可直接調整時間。中文／日文輸入法組字時則不會誤攔截確認鍵。

### 支援 YouTube 與 Twitch

目前支援：

- YouTube 一般影片
- YouTube 直播／直播回看
- Twitch VOD
- Twitch 直播

Twitch VOD 使用播放器實際時間；Twitch Live 依頁面直播經過時間搭配播放器相對變化進行校準，因此會顯示相應的校準狀態。

### 時間軸清單

同一部影片／直播的標記會依媒體本身的時間軸由早到晚排列。即使你在影片裡前後跳著看、以不同順序建立標記，最後仍會得到容易交給剪輯工作的時間清單。

### 匯出 TXT

支援：

- 單一標記匯出
- 單一影片／直播匯出
- 勾選多部影片批次匯出
- 全部匯出

每部影片／直播會產生自己的 TXT 檔案，不會把不同影片混在一起。

### TXT 回入與批次刪除

匯出的 TXT 可重新匯入 Popup，還原時間點與備註後繼續補充內容。Popup 也支援一次刪除勾選的多個影片／直播群組，或一次刪除某一整部影片／直播的全部標記，不必逐筆處理。 匯入後會顯示逐檔成功／失敗與原因，並可讀取早期版本的 VTM TXT。按下「開啟」時，若同一部 YouTube 影片或 Twitch 媒體已在瀏覽器分頁中，會直接重用該分頁切換到指定時間，避免重複開很多分頁。

TXT 範例：

```text
標題: Example Video
平台: youtube
頻道／實況主: Example Channel
影片類型: video
上傳／直播日期: 2026-08-25
原始網址: https://www.youtube.com/watch?v=...

────────────────────────
標註時間：
[49:29]
備註: 這裡開始介紹主要功能

[58:39]

[01:02:49]
備註: 這段之後要剪進精華
```

沒有備註的標記不會輸出空白 `備註:` 欄位。TXT 使用 UTF-8 BOM + CRLF，適合 Windows 記事本與繁體中文環境。

### 為不同畫面尺寸設計

YouTube 一般觀看模式會依可用空間自動使用完整版、精簡圖示或極精簡圖示，減少因瀏覽器縮放或視窗寬度不同而整顆按鈕消失的情況。YouTube 真正全螢幕則使用獨立的右上角標記按鈕。

### 中文與英文介面

依 Firefox UI 語言自動支援繁體中文、簡體中文與 English。

### 可選用 Google Drive 同步

v1.2.1 可將時間軸同步到使用者自己的 Google Drive `appDataFolder`。同步採本機優先、per-marker version 與刪除 tombstone；中斷同步不會刪除本機標記。只有使用者主動啟用後才會連接 Google。

### 隱私優先

未啟用 Google Drive 同步時，標記與備註都只儲存在 Firefox 本機 `browser.storage.local`。本擴充功能不使用分析、遙測、廣告 SDK、追蹤器、遠端 JavaScript 或開發者後端。若使用者選擇開啟 Google Drive 同步，媒體資訊、時間標記與備註只會傳送到該使用者自己的 Google OAuth／Drive 帳戶；開發者不會收到同步內容。

### 權限用途

- **Storage**：保存本機標記、備註、同步版本與設定。
- **Downloads**：只有使用者主動匯出時下載 TXT。
- **Identity**：處理可選用的 Google OAuth 連線。
- **Alarms**：啟用同步後執行低頻自動同步排程。
- **YouTube / Twitch 網站存取**：讀取播放頁必要資訊並加入標記 UI。
- **Google API 網站存取**：只有使用者啟用 Google Drive 同步後才使用。

Google Drive 同步需要的 Firefox 資料傳輸類型（`authenticationInfo`、`websiteActivity`、`websiteContent`）均宣告為 optional，使用者按下連線時才會要求同意。

### 目前限制

- 不支援 YouTube Shorts 專用介面。
- Twitch Live 採頁面直播時計校準，與 VOD 的直接播放器時間模式不同。
- 尚未使用 Twitch OAuth / Helix API 自動將 Live 標記與直播結束後的 VOD 配對。

本擴充功能為獨立開發工具，與 YouTube、Google 或 Twitch 無官方關係。

## 建議分類

1. Photos, Music & Videos（相片、音樂、影片）
2. Bookmarks（書籤）

## 作者

貳緹 (erttyouo)

## Support Email

Eric208311@gmail.com

## Support Website

https://github.com/ErttyOuO

## License

Mozilla Public License 2.0 (MPL-2.0)
