# Phase 0 Timeline Probe 測試表 — v0.2.6

## YouTube

- [ ] 一般影片播放中：標記時間與播放器畫面一致。
- [ ] 一般影片暫停：標記時間不漂移。
- [ ] Live 最前端：記錄 `playerCurrentTime / seekableEnd / behindLiveEdge`。
- [ ] Live 倒退 5 分鐘：`behindLiveEdge` 約增加 300 秒。
- [ ] Live 暫停再播放：診斷資料符合實際。
- [ ] SPA 切換影片後仍可標記新影片。

## Twitch VOD

- [ ] VOD ID 正確。
- [ ] 標題與實況主名稱正確。
- [ ] `video.currentTime` 與畫面時間接近。
- [ ] 匯出網址可跳到指定時間。

## Twitch Live — v0.1.2 重點

- [ ] `🔖` 出現在愛心追蹤按鈕左側，同一排且不破壞原 Twitch 版面。
- [ ] 點標記時顯示的時間接近 Twitch 頁面觀看人數旁的直播時間（例如頁面 2:33:58，插件也應約 2:33:58）。
- [ ] 診斷文字顯示 `直播計時來源：.live-time` 或 `near-viewer-count`，不再把巨大的 `seekableEnd` 當作時間。
- [ ] 正常直播 30 秒後再次標記，兩筆標記約相差 30 秒。
- [ ] 暫停 20～30 秒後再標記：如果已建立 relative anchor，標記位置應接近暫停畫面，而不是持續跟著直播最前端增加。
- [ ] 暫停後續播 20 秒再標記：相對位置應從暫停點繼續增加。
- [ ] 切換畫質後仍能標記；如果 player source/reset，應自動重新校準。
- [ ] Twitch 自動重新連線後仍能標記。
- [ ] 廣告開始／結束時記錄時間是否出現跳動；若有，下一版加入廣告阻擋標記。
- [ ] 切換頻道後按鈕會重新掛到新頻道的愛心按鈕左側。

## 直播結束後的人工核對

請至少留 2～3 筆 Twitch Live 標記，等該場直播產生 VOD 後人工打開 VOD：

- [ ] 標記 A：直播最前端建立。
- [ ] 標記 B：與 A 間隔至少 2～5 分鐘。
- [ ] 若有使用暫停，標記 C：暫停期間建立。
- [ ] 對照 VOD 中真正畫面，記錄每筆誤差秒數。

這組資料會決定後續是否需要固定 latency correction，或只需保留目前的 page-clock + relative-player 校準。

## TXT

- [ ] Windows 11 記事本開啟繁體中文無亂碼。
- [ ] 換行為 CRLF。
- [ ] 檔名非法字元已替換。
- [ ] YouTube 時間網址正確。
- [ ] Twitch VOD 時間網址正確。
- [ ] 尚未配對 VOD 的 Twitch Live 仍保存直播網址、直播標記秒數與 pending 狀態。

## v0.1.2 通過條件

1. YouTube 既有功能不回歸。
2. Twitch VOD 保持正常。
3. Twitch Live 不再出現 43 秒或 `9223372036854...` 被當作未來 VOD 時間。
4. Twitch Live 最前端標記能以頁面直播時計得到合理的 2h+ 時間值。
5. Twitch 按鈕位置符合「追蹤愛心左側」需求。


## v0.1.3 浮動面板回歸測試

1. YouTube 一般影片保持影片可見，點擊 `🔖 標記`。
   - 頁面 `scrollY` 不應改變。
   - 播放器與操作列不應被往下推。
   - 面板應直接覆蓋影片右上區域。
2. 在備註欄直接輸入文字。
   - textarea 聚焦時頁面不得自動捲動。
3. 切換「本片清單」再切回「新增標記」。
   - 面板仍維持 viewport overlay，不得改變文件高度。
4. Twitch Live / VOD 重複上述測試。
5. 改變視窗大小或劇院模式後再次開啟。
   - 面板應重新限制在可視範圍內。
6. YouTube Shorts：不測試、不提供專用掛載。

## v0.1.4 Twitch loading performance regression test

1. Disable the extension and open a Twitch live channel; confirm the stream can load.
2. Enable/reload v0.1.4 and open the same live channel.
3. Leave the page untouched for at least 2 minutes while chat is active.
4. Confirm video playback does not freeze merely because chat/player DOM continues updating.
5. Confirm the marker button appears without repeated visible repositioning.
6. Press the marker button once and verify Live time is read only at interaction time.
7. Close the marker panel and confirm playback remains smooth.
8. Open a Twitch VOD and verify timestamp marking remains exact.


## v0.1.5 Twitch action-row / performance regression

1. Twitch Live：`🔖` 應與 Follow/通知/訂閱控制位於同一水平列，不可與愛心上下堆疊。
2. 視窗縮放後重新整理：`🔖` 不應落入直向 wrapper；找不到 row 時允許暫時 fallback。
3. Twitch SPA 切換另一頻道：只能存在一個 `#vtm-mark-button`，且可重新掛到新 action row。
4. 未操作插件播放直播 2 分鐘：不得因插件造成播放器轉圈、卡死或明顯主執行緒延遲。
5. 聊天室大量更新時：插件不得使用全頁 MutationObserver，也不得因每則聊天訊息重新 mount。
6. Twitch VOD：既有 `video.currentTime` 標記結果不可改變。
7. Twitch Live：既有頁面時計/校準策略不可因 UI 掛載修改而改變。
8. YouTube：一般影片/直播按鈕仍可掛載；不再使用全頁 MutationObserver。
9. 全頁確認沒有重複按鈕、重複 root、重複 popup event listener。
10. UTF-8 / mojibake / manifest / JS syntax 全部通過。


## v0.1.6 儲存後淡出回歸測試

1. 開啟 YouTube 一般影片，建立一筆標記並按「儲存標記」。
   - 儲存成功後應切到「本片清單」。
   - 若滑鼠已離開面板，約 2 秒後才開始漸淡。
2. 淡出進行中或完成後把滑鼠移回面板。
   - 面板應立即恢復完整 opacity。
   - 不應重新開啟/關閉面板，不應改變頁面 scrollY。
3. 滑鼠停留在面板內超過 5 秒。
   - 面板不得淡出。
4. 滑鼠再次移出面板。
   - 應重新等待約 2 秒，而不是立即淡掉。
5. 連續建立並儲存 5 筆標記。
   - 同一時間最多只有一個 fade timeout；不得出現忽明忽暗或多次 transition 疊加。
6. 面板淡出前按右上角關閉，再重新按 `🔖`。
   - 舊 timer 不得在新面板開啟後突然把它淡掉。
7. Twitch Live 與 Twitch VOD 重複測試。
   - fade 不得影響播放器、Live timer、VOD `currentTime` 或 action-row 掛載。
8. 確認 `🔖` 按鈕本身不會淡出。
9. 確認沒有新增 MutationObserver 或額外 setInterval；fade 只能使用單一可清理 `setTimeout`。
10. Firefox `prefers-reduced-motion` 啟用時允許取消 transition，但 idle 狀態切換仍需正常。

## v0.1.7 Twitch Follow 錨點回歸測試

1. Twitch Live 正常載入後，`🔖` 必須出現在 Follow / 愛心按鈕左側，且保持同一水平中心線。
2. 切換聊天室開關、改變視窗寬度、縮放頁面後，最多 1.5 秒內重新貼齊 Follow 按鈕。
3. 找不到 Follow 按鈕時，`🔖` 必須隱藏；不得出現在聊天室輸入框、右下角或其他 fallback 位置。
4. Twitch SPA 切換頻道後不得產生第二顆 `#vtm-mark-button`。
5. Twitch Live 播放期間不得新增 MutationObserver 或高頻 DOM polling。
6. Twitch VOD 的 `video.currentTime`、Live 時計校準、儲存後 2 秒淡出不得因定位修改而回歸。

## v0.1.8 Twitch 按鈕尺寸回歸

- [ ] 未追蹤頻道：🔖 外框寬高與 Follow 愛心一致。
- [ ] 已追蹤頻道：🔖 外框寬高與 Unfollow 愛心一致。
- [ ] 🔖 與愛心 top 對齊，間距約 8px。
- [ ] Twitch 瀏覽器縮放後重新同步尺寸與位置。
- [ ] 找不到 Follow/Unfollow 時 🔖 不顯示 fallback。
- [ ] VOD / Live timeline、2 秒淡出、TXT 匯出不受影響。


## v0.1.9 即時儲存 / 淡出 / 平台色 / 語系回歸

1. YouTube 一般影片點一次 `🔖`：
   - [ ] `storage.local` 立即增加且只增加 1 筆。
   - [ ] 不需要按「更新標記」也能在 Popup 看見新標記。
2. 浮動面板：
   - [ ] 主按鈕文字為「更新標記」／`Update marker`，不是「儲存標記」。
   - [ ] 不自動 focus textarea，頁面 scrollY 不改變。
   - [ ] 滑鼠未進入面板時，約 2 秒後開始漸淡。
   - [ ] 淡出後滑鼠移入立即恢復；移出後重新等待約 2 秒。
3. 備註：
   - [ ] 輸入備註按「更新標記」後，標記總數不增加。
   - [ ] Popup 與本片清單顯示同一筆已更新備註。
4. 快速連點：
   - [ ] 非同步 capture/store 尚未完成時重複 click 不會因同一 click 流程建立重複資料。
5. Popup 平台框：
   - [ ] Twitch 每筆卡片顯示紫色外框。
   - [ ] YouTube 每筆卡片顯示紅色外框。
6. Firefox UI 語言：
   - [ ] `zh-TW`：面板、Popup、匯出標籤為繁中。
   - [ ] `zh-CN`：面板、Popup、匯出標籤為簡中。
   - [ ] `en-US`：面板、Popup、匯出標籤為英文。
   - [ ] Twitch/YouTube 網站語言切換不得改變插件語言；只跟 Firefox UI 語言。
7. 回歸：
   - [ ] Twitch Follow 錨點尺寸與位置不變。
   - [ ] Twitch VOD `currentTime` 不變。
   - [ ] Twitch Live page-clock calibration 不變。
   - [ ] YouTube 一般影片／Live 時間擷取不變。
   - [ ] 無新增 MutationObserver 或高頻 DOM polling。


## v0.2.0 原生掛載 / YouTube 主題回歸

1. Twitch 未追蹤頻道：
   - [ ] `🔖` 與 Follow 愛心在同一原生 action group，捲動頁面時兩者完全同步，沒有 1.5 秒追位延遲。
2. Twitch 已追蹤頻道：
   - [ ] `🔖` 與 Unfollow 愛心同列，切換聊天室、視窗寬度與 Firefox 縮放時不漂移。
3. Twitch SPA 切換頻道：
   - [ ] 只能存在一個 `#vtm-mark-button` 與一個 `#vtm-twitch-button-slot`。
   - [ ] 找不到可靠 action group 時按鈕隱藏，不顯示 fixed fallback。
4. Twitch 效能：
   - [ ] 沒有新增全頁 MutationObserver。
   - [ ] 沒有為按鈕位置新增 `requestAnimationFrame` loop 或 left/top polling。
   - [ ] Live / VOD timeline 檔案與 v0.1.9 一致。
5. YouTube 深色主題：
   - [ ] `🔖 標記` 外框寬高、圓角與同列 Share 原生按鈕一致。
   - [ ] 上半稍亮、下半稍深；hover 不上移。
6. YouTube 淺色主題：
   - [ ] 尺寸仍與 Share 一致。
   - [ ] 文字為深色、按鈕為淺灰立體漸層，不出現黑底或低對比。
7. YouTube SPA / 劇院模式：
   - [ ] 換影片後按鈕重新嵌入正確操作列，不重複建立。
8. 共通回歸：
   - [ ] 點 `🔖` 立即儲存仍正常。
   - [ ] 更新備註不新增第二筆。
   - [ ] 2 秒 idle fade 不變。
   - [ ] Popup Twitch 紫框 / YouTube 紅框不變。
   - [ ] Firefox i18n 中文 / 英文不變。


## v0.2.1 YouTube placement / gradient 回歸

1. YouTube 首次进入 watch 页面，故意在操作列尚未完整出现时载入扩充功能：
   - [ ] `🔖` 不得出现在右下角、推荐影片卡片或 viewport fallback。
   - [ ] 操作列建立后，最多约 2 秒内自动嵌入原生按钮列。
2. DOM 顺序：
   - [ ] `🔖` 应位于 Share 后方。
   - [ ] `#flexible-item-buttons` 的储存／下载继续维持 YouTube 原生布局。
3. YouTube SPA 换影片／剧院模式／视窗缩放：
   - [ ] `isInlinePlacementValid("youtube")` 失效时能自动重新挂载。
   - [ ] 不产生第二颗 `#vtm-mark-button`。
4. 深色主题：
   - [ ] 上下半明暗差仅轻微可见，不再有明显上白下黑。
   - [ ] 文字、图示与 YouTube tonal control 保持足够对比。
5. 浅色主题：
   - [ ] 渐层同样低对比；hover 只轻微变化。
6. 效能：
   - [ ] 不新增全页 MutationObserver。
   - [ ] 不新增高频 polling；沿用既有 2 秒低频 placement check。
7. 回归：
   - [ ] Twitch inline Follow action-group 挂载不变。
   - [ ] Twitch Live/VOD timeline 檔案不变。
   - [ ] 即时储存、更新备注、2 秒淡出、Popup 平台色、i18n 不变。


## v0.2.2 Fullscreen / ±5 秒 / 刪除 / TXT 回歸

1. YouTube 一般觀看：
   - [ ] `🔖` 位於 `#flexible-item-buttons` 低優先區，不把原生「儲存／加入播放清單」擠掉。
2. YouTube fullscreen：
   - [ ] 進入 fullscreen 後最多立即/一次 refresh，`🔖` 出現在 `.ytp-left-controls` 左下控制列。
   - [ ] 同時只能有一顆 `#vtm-mark-button`。
   - [ ] 點 `🔖` 後浮動面板在 fullscreen 畫面內可見。
   - [ ] 退出 fullscreen 後 root 搬回 document，按鈕回到一般低優先操作列。
3. 手動時間微調：
   - [ ] 建立 00:30 標記，連按 `+5` 三次後為 00:45，storage 仍只有同一筆。
   - [ ] 連按 `-5` 不得低於 00:00。
   - [ ] 已知 duration 時 `+5` 不得超過影片總長。
   - [ ] 快速連按 10 次不因 async race 少算。
   - [ ] 原始 `timeline.playerCurrentTime` diagnostics 保持 capture 值。
4. 刪除本次標記：
   - [ ] 點 `🔖` 自動儲存後，按「刪除此標記」會刪除 activeMarkerId。
   - [ ] 刪除後自動切到本片清單，列表不再顯示該筆。
5. TXT：
   - [ ] header 只保留標題、平台、頻道／實況主、影片類型、日期、原始網址。
   - [ ] 分隔線後顯示 `標註時間：`。
   - [ ] 每筆顯示 `[時間]`。
   - [ ] note 為空時完全不輸出 `備註:` 行。
   - [ ] 不再輸出時間網址、標記時間、準確度、VOD status。
   - [ ] UTF-8 BOM + CRLF 不變。
6. 效能與回歸：
   - [ ] 無新增 MutationObserver。
   - [ ] 無新增高頻 setInterval / requestAnimationFrame loop。
   - [ ] Twitch Live/VOD timeline 檔案與 v0.2.1 不變。
   - [ ] Popup 平台色、i18n、2 秒淡出不回歸。


## v0.2.3 → v1.0.0 YouTube responsive / fullscreen 回歸

> v1.0.0 已取代舊版「suppression + 120px hysteresis」策略；fullscreen 也已改為影片標題列右上角。

1. 一般觀看模式，在瀏覽器寬度或 Firefox zoom 慢慢跨過 YouTube action row 臨界點：
   - [ ] `🔖` 不得每 2 秒反覆出現／消失。
   - [ ] 空間足夠時顯示完整 `🔖 標記`。
   - [ ] 空間不足時降為 compact icon，再必要時降為 micro icon；不得整顆隱藏。
   - [ ] 原生 Share / More 不得被 VTM 覆蓋。
2. 在窄寬度維持視窗 10 秒：
   - [ ] compact/micro 狀態保持穩定且可點。
   - [ ] 不得因 2 秒 placement check 反覆插入/移除。
3. 調小 Firefox zoom 或加寬視窗：
   - [ ] resize debounce 後可重新評估完整按鈕。
   - [ ] 全程只能存在一顆 normal `#vtm-mark-button`。
4. SPA 換另一部影片：
   - [ ] responsive 模式可重新評估，不能殘留上一影片的 responsive state。
5. 真正 Browser Fullscreen：
   - [ ] fullscreen 狀態只依 `document.fullscreenElement` 判斷。
   - [ ] 專用 `#vtm-mark-button-fullscreen` 只出現在 `.ytp-chrome-top-buttons`。
   - [ ] `.ytp-left-controls` 不得出現任何 VTM marker。
6. 退出 fullscreen：
   - [ ] fullscreen 專用按鈕立即 dormant/hidden/disabled。
   - [ ] normal marker 回到影片資訊 action row，panel portal 回到 document root。

## v0.2.4 備註自動儲存 / 外部點擊回歸

1. YouTube / Twitch 按 `🔖`：面板開啟後 textarea 應立即取得焦點，可以直接輸入，不得造成頁面 scrollY 改變。
2. 連續輸入備註後停 450ms 以上：同一筆 marker 的 note 應自動更新，不需按任何儲存按鈕。
3. 輸入後立刻點 `+5 秒` / `-5 秒`：最新備註與時間微調都必須保留，不得互相覆蓋。
4. 輸入後立刻切到「本片清單」：清單需顯示最新備註。
5. 輸入後立刻點面板外：面板立即消失，最新備註仍需完成儲存。
6. YouTube 全螢幕播放中，面板開啟後點影片空白畫面一次：面板消失，影片應繼續播放，不得因同一次 click 暫停。
7. 面板關閉後再次正常點影片：播放器原本的 play/pause 行為應恢復，不能持續吞 click。
8. 點 YouTube progress bar / player control button：面板可關閉或保留依實際目標，但不得吞掉真正控制操作。
9. 持續輸入備註時每次 input 都應重排 2 秒 fade；停止輸入且滑鼠不在面板上約 2 秒後才淡出。
10. 確認沒有新增 MutationObserver、高頻 interval、重複 note autosave timer 或殘留 click-swallow 狀態。


## v0.2.5 fullscreen visibility regression

- Enter real YouTube fullscreen and verify the marker is visible in `.ytp-left-controls`.
- Verify the same `#vtm-mark-button` has `ytp-button` and `vtm-youtube-fullscreen-mounted`, with a non-zero bounding rect.
- Verify the white bookmark SVG is visible next to the time display and normal red emoji/label are hidden.
- Exit fullscreen and verify the same button returns to the normal YouTube action row.
- Repeat fullscreen enter/exit 5 times; confirm no duplicate button, observer, interval, or event-listener accumulation.


## v0.2.6 Popup 分組／批次匯出／Enter 回歸

1. Popup 同一 YouTube 影片建立 3 筆標記：
   - [ ] 只出現一個媒體群組標題，群組內顯示 3 筆時間。
   - [ ] 群組外框維持 YouTube 紅色。
2. Twitch 直播／VOD 群組：
   - [ ] 群組外框維持 Twitch 紫色。
   - [ ] 「匯出本片／直播」只輸出該群組全部標記，且只有一個 TXT。
3. 批次匯出：
   - [ ] 勾選 2 個不同媒體群組後，按「匯出選取（2）」；background 產生 2 個分開的 TXT，不合併。
   - [ ] 全選後批次匯出，每個 media group 各自一檔。
   - [ ] 編輯／刪除單筆後重新 render，仍存在的群組選取狀態不應無故丟失。
4. 單筆匯出：
   - [ ] 每筆標記仍可使用「匯出此標記」，只輸出該筆。
5. 備註 Enter：
   - [ ] textarea 聚焦時輸入文字後按 Enter：最新 note 先保存，面板關閉，不產生換行。
   - [ ] Shift+Enter：插入換行，面板保持開啟。
   - [ ] 繁中／日文 IME 正在 composition 時按 Enter 確認候選字：面板不得關閉。
   - [ ] composition 結束後再按 Enter：才關閉面板。
6. 回歸：
   - [ ] YouTube fullscreen / normal marker placement 與 v0.2.5 相同。
   - [ ] Twitch inline Follow placement 與 Live/VOD timeline 未修改。
   - [ ] 無新增 MutationObserver、setInterval 或高頻 DOM 掃描。
   - [ ] UTF-8 / i18n / TXT BOM + CRLF 維持。


## v0.2.7 YouTube fullscreen visibility regression

- [ ] 真正 fullscreen 後 `#vtm-mark-button` 是 `.ytp-left-controls` 的直接子節點。
- [ ] DOM 順序為 `volume-area -> #vtm-mark-button -> .ytp-time-display`。
- [ ] `#vtm-mark-button[data-vtm-placement="youtube-fullscreen-before-time"]` 存在。
- [ ] Fullscreen 顯示白色 24x24 bookmark SVG，不顯示紅色 emoji 或文字。
- [ ] 退出 fullscreen 後回到一般 YouTube inline 位置與原本 tonal 樣式。
- [ ] 連續進出 fullscreen 5 次仍只有一個 `#vtm-mark-button`。
- [ ] 不新增 MutationObserver／持續 RAF；既有 2 秒低頻 placement check 不提高頻率。
- [ ] Twitch Live/VOD timeline 與 Twitch 按鈕掛載不變。

## v0.2.8 YouTube fullscreen alignment / underlay
- [ ] Fullscreen marker top/bottom aligns with the native play/pause hitbox; it must not sit visibly higher than Play or Volume.
- [ ] DOM order remains `volume-area -> #vtm-mark-button -> .ytp-time-display`.
- [ ] `--vtm-yt-player-width/height` are sourced from `.ytp-play-button.ytp-button` when visible.
- [ ] Bookmark has a subtle translucent black underlay; normal state must remain low contrast and hover only slightly darker.
- [ ] Fullscreen enter/exit 5 times keeps exactly one `#vtm-mark-button`.
- [ ] No new MutationObserver / setInterval / continuous RAF loop.
- [ ] Twitch and YouTube timeline files remain unchanged from v0.2.7.


## v0.2.9 timeline-order regression

- [ ] Add markers while jumping around: 49:21, 02:21:54, 58:39, 01:28:55. Popup order must be 02:21:54 → 01:28:55 → 58:39 → 49:21.
- [ ] In-page current-media list uses the same order.
- [ ] Single-media TXT uses the same order.
- [ ] Batch and export-all keep separate TXT files and sort each file by timeline ascending (earliest at top, latest at bottom).
- [ ] Equal positions use newest `capturedAt` first.
- [ ] Missing/invalid positions appear after valid positions, newest captured first.
- [ ] No timeline capture, fullscreen placement, autosave, MutationObserver, or polling behavior changes in this release.


## v0.3.0 fullscreen visual alignment regression

1. Enter real YouTube fullscreen and compare Pause, Volume and VTM Bookmark vertically.
2. Bookmark outer hitbox may remain 48px, but visible SVG/underlay must be 36×36 and centered; it must not start higher than the native control icons.
3. Verify the subtle black underlay is low-contrast and does not visually create a taller pill.
4. Enter/exit fullscreen five times: exactly one `#vtm-mark-button`; normal-mode styles restore correctly.
5. Confirm no new MutationObserver, interval, continuous RAF positioning loop, or Twitch/timeline changes.

## v0.3.1 YouTube fullscreen native visual-scale regression

- [ ] Fullscreen `#vtm-mark-button` remains one native-size `.ytp-button` hitbox between volume and time.
- [ ] Visible bookmark SVG is 24×24 and outline-only; it must not look taller/heavier than Pause/Volume.
- [ ] Underlay is 32×32, subtle, centered, and does not visually enlarge the control.
- [ ] No `top`, `margin-top`, or alignment `translateY` compensation is introduced.
- [ ] Enter/Shift+Enter, autosave, ±5s, Popup grouping/export, timeline ordering, Twitch Live/VOD remain unchanged.

## v0.3.2 YouTube fullscreen title-right regression

- [ ] 進入真正 YouTube fullscreen 後，底部 `.ytp-left-controls` 不再包含 `#vtm-mark-button`。
- [ ] `#vtm-mark-button` 應是 `.ytp-overlay-top-right .ytp-chrome-top-buttons` 的子節點。
- [ ] `data-vtm-placement="youtube-fullscreen-title-right"` 存在。
- [ ] 按鈕位於上方影片標題列最右側，使用 48×48 hitbox、24×24 白色線框 bookmark、淡黑圓形背景。
- [ ] YouTube controls 自動隱藏／再顯示時，VTM 與 top chrome 一起隱藏／顯示，不獨立漂浮。
- [ ] 進出 fullscreen 5 次仍只有一顆 `#vtm-mark-button`，退出後回到 normal action row。
- [ ] Fullscreen 按下標記仍能顯示 panel；panel portal 仍位於 `#movie_player`，備註 focus / autosave / Enter 行為不變。
- [ ] 無新增 MutationObserver、setInterval、持續 RAF 或 Twitch/Timeline 修改。



## v0.3.4 fullscreen legacy regression

1. Load an older development build that places VTM in `.ytp-left-controls`, enter fullscreen, then reload the temporary add-on to v0.3.4 without closing the YouTube tab.
2. Confirm no VTM button is visible in `.ytp-left-controls`.
3. Confirm exactly one visible fullscreen marker exists in `.ytp-chrome-top-buttons` as `#vtm-mark-button-fullscreen`.
4. Exit fullscreen and confirm the dedicated fullscreen button is hidden/parked while the normal action-row marker is restored.
5. Repeat fullscreen enter/exit five times and confirm no duplicate visible marker buttons.


## v0.3.4 Keyboard ±5s shortcut

- With the marker panel open, pressing `+` adjusts the active marker by +5 seconds.
- Pressing `-` adjusts the active marker by -5 seconds.
- The shortcut works while the note textarea is focused; `+` / `-` are not inserted into the note.
- Repeated discrete presses accumulate. Key auto-repeat is ignored to prevent accidental large jumps.
- During IME composition (`isComposing` / keyCode 229), shortcuts are ignored.
- Ctrl/Alt/Meta combinations are ignored so browser/system shortcuts remain available.
- Existing on-screen ±5 second buttons continue to use the same serialized adjustment queue.


## v0.3.5 Fullscreen-only visibility regression

1. Open a normal YouTube watch page without entering fullscreen.
2. Verify `#vtm-mark-button-fullscreen` is hidden, disabled, `aria-hidden=true`, `tabIndex=-1`, and cannot be clicked or focused.
3. Verify only the regular in-page VTM marker is visible.
4. Enter browser fullscreen.
5. Verify the dedicated fullscreen marker becomes enabled and is mounted only in `.ytp-chrome-top-buttons`.
6. Exit fullscreen and verify it immediately returns to dormant state and cannot appear at the page top-left.
7. Repeat enter/exit fullscreen five times and confirm there is still only one fullscreen marker node and one normal marker node.


## v1.0.0 Timeline ascending-order regression

- [ ] Popup：同一影片標記依時間軸由早到晚顯示，最早在最上方、最晚在最下方。
- [ ] 本片／本直播清單使用相同的由早到晚順序。
- [ ] 單片匯出 TXT 使用相同的由早到晚順序。
- [ ] 批次匯出與匯出全部：每個 TXT 各自使用由早到晚順序，不跨影片混排。
- [ ] Twitch 已解析 VOD 時優先使用 `resolvedPositionSeconds`。
- [ ] 沒有有效 timeline 秒數的標記放在有效時間標記之後，並以 `capturedAt` 由舊到新排序。
- [ ] 影片／直播群組之間仍按最近活動排序，不因本次修改反轉。


## v1.0.0 YouTube zoom / responsive marker

1. 以 Firefox 80% / 90% / 100% / 110% / 125%（依可用比例）切換同一影片：
   - [ ] `#vtm-mark-button` 在 normal mode 始終存在且可點。
   - [ ] 空間足夠時顯示 `🔖 標記`。
   - [ ] 空間不足時只縮成 icon，不整顆隱藏。
   - [ ] YouTube 原生 Share / More 不得被 VTM 覆蓋。
2. 快速拖曳視窗寬度：
   - [ ] 只在 resize 停止約 160ms 後重新評估。
   - [ ] 不得產生閃爍 loop、全頁 MutationObserver 或持續 RAF loop。
3. 若原本可見的 flexible native actions 因 full marker 收合：
   - [ ] VTM 應先 compact，再必要時 micro。
   - [ ] 不得再使用舊版 suppression + 120px hysteresis 把整顆 VTM 隱藏。


## v1.1.0 — 批次刪除 / TXT 回入

### Popup 批次刪除
1. 建立至少 3 個媒體群組，每組 2 筆以上標記。
2. 勾選 2 個群組，確認「刪除選取（2）」啟用。
3. 取消確認：資料不得改變。
4. 再次刪除並確認：只刪選取群組，其餘群組完整保留。
5. 使用「全選影片／直播」＋「刪除選取」：確認可一次刪除全部群組。

### 單一媒體整組刪除
1. 點某群組「刪除本片／直播」。
2. 確認提示包含影片標題與 marker 數量。
3. 確認後該群組全部消失，其他群組不變。

### TXT Round-trip
1. 建立 YouTube video：無備註、單行備註、多行備註各至少 1 筆。
2. 匯出本片 TXT。
3. 刪除該群組。
4. Popup → 匯入 TXT，選剛匯出的檔案。
5. 確認標題、平台、頻道、日期、URL、時間點、備註還原，並依時間由早到晚顯示。
6. 編輯匯入後的備註，再次匯出，確認新內容存在。
7. 重複匯入同一 TXT：完全重複 marker 應略過，不增加重複筆數。
8. 若現有同秒 marker 備註空白、TXT 有備註：應補上備註。
9. 若現有同秒 marker 與 TXT 都有不同非空備註：不得覆寫，匯入結果顯示 conflict。
10. 分別測試繁中、簡中、英文 Firefox 匯出的 TXT。
11. 一次選取多個 TXT：各媒體應分組還原。

### 回歸
- Add-on ID 仍為 `video-timeline-marker@erttyouo`。
- Storage Key 仍為 `vtm_markers_v1`。
- YouTube/Twitch timeline、fullscreen、±5 秒、Enter、autosave 不因 Popup 新功能改變。
- 不新增 MutationObserver、輪詢 interval、遠端 API、網路權限。
- 全專案 UTF-8，無 mojibake。


## v1.1.4 — TXT 匯入回報 / 舊格式相容 / 智慧分頁重用

- 匯入目前格式 TXT：結果卡必須顯示讀取／新增／補備註／重複／衝突數。
- 重複匯入同檔：顯示成功但新增 0、重複 N，不可沒有提示。
- 匯入空檔或無時間軸文字：顯示失敗與具體原因。
- 匯入 v0.1.x～v0.2.1：`[暫定 49:29]`、`[Estimated 49:29]` 可解析，且 `時間網址／Timestamp URL`、`標記時間／Marked at`、`準確度／Accuracy`、VOD 狀態不可混入 note。
- 選檔後關閉並重新開啟 Popup：上一筆匯入結果仍可見，直到使用者按 × 關閉。
- YouTube：第一次 Open（無同片 tab）建立新分頁；第二個同片 marker Open 必須更新同 tab URL 與時間，不新增第二個 tab。
- Twitch VOD：同 VOD ID 重用既有 tab。
- Twitch Live：同頻道重用既有 tab。
- 不新增 `tabs` permission；只使用既有 YouTube/Twitch host permissions 查詢匹配 URL。


## v1.1.4 Popup group collapse regression

- Each video/stream group exposes an accessible chevron toggle.
- The newest group defaults expanded; older groups default collapsed when no saved preference exists.
- Collapse/expand state persists in `browser.storage.local` under `vtm_popup_group_collapse_v1`.
- Collapsing hides only `.group-markers`; selection, group metadata, export and delete controls remain available.
- Group state is pruned when a media group no longer exists.
- No MutationObserver, polling loop, timeline code or content-script behavior is added.


## v1.1.4 marker panel visual regression

- Header shows extension icon + localized marker title + close button; no legacy kicker is visible.
- Current-marker view shows pill tabs, large timestamp, accuracy badge, ±5-second buttons, autosave hint, note field, up to three compact marker rows, and footer actions.
- Preview shows the active marker when possible and remains sorted by media timeline.
- Preview row Edit/Delete work; deleting the active marker disables current-marker controls.
- Full list still exposes Open/Edit/Export/Delete via icon buttons.
- YouTube uses red/purple accent; Twitch uses purple accent.
- Non-live raw diagnostic text is not shown; Twitch Live diagnostics remain visible.
- Confirm current-marker delete before removal.
- Autosave focus, Enter, Shift+Enter, keyboard +/- handling, idle fade, outside click swallowing over player, fullscreen marker, Twitch/YouTube timeline logic remain regression-tested.


## v1.1.4 — Marker list timeline rail

- Capture preview and full current-video list must each show exactly one timeline node per marker row.
- The old three-dot rail must not exist in generated DOM/CSS.
- Non-current nodes are visually subdued; `.is-current` receives only a soft ring/glow.
- The vertical guide stays inside the marker card and does not affect row height or hit targets.
- YouTube/Twitch accent variables remain platform-specific.
- No marker-store, timeline, content-script, autosave, fade, TXT import/export, or popup behavior changes.


## v1.1.5 Popup long-title layout

- Test long Traditional Chinese, Japanese and English media titles in expanded and collapsed groups.
- Title should receive the main content width and should not collapse into a one-character-wide vertical column.
- Platform/type/marker count appears beneath the title.
- Group export/delete actions remain visible on their own row and do not reduce title width.
- Batch checkbox, collapse toggle, group metadata and marker list behavior remain functional.


## v1.1.6 — YouTube fullscreen native autohide sync

1. Open a supported YouTube video and enter true browser/player fullscreen.
2. Confirm the VTM top-right marker is visible while YouTube's native controls are visible.
3. Stop moving the mouse until YouTube hides Play/Pause/progress/top chrome.
4. Confirm the VTM fullscreen marker fades out and cannot receive pointer input.
5. Move the mouse. When YouTube native controls return, confirm VTM returns as well.
6. Repeat while paused and while playing.
7. Exit fullscreen: the dedicated fullscreen button must become dormant and the normal metadata-row button must remain unchanged.
8. Confirm no new MutationObserver, setInterval, or requestAnimationFrame usage was introduced.


## v1.1.7 — YouTube action injection / Popup add / UI isolation

- [ ] YouTube cold load: VTM action button appears after Like/Dislike even if Share has not rendered yet.
- [ ] YouTube SPA navigation between videos: VTM action button is reattached without reloading the tab.
- [ ] Resize / responsive action bar: VTM button remains attached or remounts without duplicate buttons.
- [ ] Popup on supported YouTube video: “＋ Add marker” is enabled and creates a marker at current playback time.
- [ ] Popup on supported Twitch live/VOD: “＋ Add marker” is enabled and creates a marker.
- [ ] Popup on unsupported tab: add-marker button remains disabled.
- [ ] YouTube fullscreen note typing: J/K/L, arrows, digits and Space do not control playback.
- [ ] Enter saves/closes VTM note as designed; Shift+Enter still inserts a newline.
- [ ] Clicking/pressing buttons inside the fullscreen VTM panel does not toggle YouTube playback.
- [ ] v1.1.7 regression behavior remains unchanged; v1.2.x additionally uses `identity` and `alarms` only for optional Google Drive sync.

## v1.2.0 — Google Drive two-way synchronization

### OAuth / consent

- [ ] Firefox popup remains fully usable before Google Drive is configured.
- [ ] Clicking **Connect Google Drive** requests optional Firefox data-collection consent for `authenticationInfo`, `websiteActivity`, and `websiteContent`.
- [ ] Denying optional data consent leaves all local marker functions working and does not launch Drive sync.
- [ ] OAuth uses the Desktop-app PKCE code flow and requests only `https://www.googleapis.com/auth/drive.appdata`.
- [ ] OAuth Client ID validation rejects values that do not end in `.apps.googleusercontent.com`.
- [ ] A successful connection stores a refresh token locally but does not persist the short-lived access token.
- [ ] Disconnect revokes OAuth when possible, removes the local credential, stops alarms, and leaves `vtm_markers_v1` intact.
- [ ] Removing the optional data-collection permission from about:addons stops sync and clears the local OAuth credential.

### First sync / appDataFolder

- [ ] First sync creates exactly one `video-timeline-marker-sync.json` inside Drive `appDataFolder`.
- [ ] The sync file contains `schemaVersion: 1`, `markers`, `versions`, and `tombstones`.
- [ ] No sync file appears in the normal My Drive file list.
- [ ] Existing local markers receive sync versions without changing the marker object schema or `vtm_markers_v1` key.

### Two-device merge

- [ ] Device A marker A + Device B marker B -> after sync both devices contain A and B.
- [ ] Edit the same marker on A and B with different update times -> the newer version wins on both devices.
- [ ] Delete a marker on A after B last edited it -> deletion wins if its tombstone is newer.
- [ ] Keep B offline, delete on A, sync A, then reconnect B -> B must not resurrect the deleted marker.
- [ ] Equal-version live conflicts resolve deterministically and repeated sync becomes stable (no ping-pong rewrite).

### Failure safety

- [ ] Invalid cloud JSON produces an error and leaves local markers unchanged.
- [ ] A cloud file with unsupported `schemaVersion` produces an error and leaves local markers unchanged.
- [ ] A Drive 401 triggers one access-token refresh and retry.
- [ ] A Drive 412 / ETag conflict rereads the cloud state, merges again, and retries without dropping either side's independent marker.
- [ ] Network failure never blocks creation/edit/delete of local markers.
- [ ] Automatic sync failure is recorded in status but does not disable local marker capture.

### Scheduling

- [ ] Local marker changes schedule one debounced sync rather than one request per keystroke.
- [ ] Periodic sync is approximately every 15 minutes only while `enabled && autoSync`.
- [ ] Popup stale refresh pulls remote changes and rerenders the marker list when local state changes.
- [ ] Turning Auto sync off clears periodic/debounce alarms but keeps manual **Sync now** available.

### Regression

- [ ] Add-on ID remains `video-timeline-marker@erttyouo`.
- [ ] Marker storage key remains `vtm_markers_v1`.
- [ ] YouTube/Twitch capture, fullscreen isolation, TXT import/export, tab reuse, and timeline ordering still work with sync disconnected.
- [ ] No new MutationObserver or requestAnimationFrame loop is introduced by sync.

### Concurrent first-sync duplicate race
- [ ] Simulate two Firefox profiles both seeing no sync file and creating `video-timeline-marker-sync.json` at nearly the same time.
- [ ] On the next sync, every same-name appData file is read and merged before local/cloud reconciliation.
- [ ] Unique markers from both files survive and the newest event for the same marker ID wins.
- [ ] A newer tombstone in either duplicate file wins over an older live record.
- [ ] The newest file remains the primary write target and absorbs the fully merged state; duplicate appData files are not destructively removed automatically.

### Device clock skew
- [ ] Seed a marker sync version newer than the local machine clock, then edit that marker locally.
- [ ] The new local `updatedAt` version must advance beyond the previously known version (minimum +1 ms), not regress to the slower wall clock.
- [ ] Repeat for deletion; the inferred/recorded tombstone must advance beyond the previous live version.


## v1.2.1 — production OAuth Client ID

- [ ] Popup disconnected state has no OAuth Client ID input and no redirect-URI field.
- [ ] **Connect Google Drive** sends `VTM_SYNC_CONNECT` without a runtime Client ID override.
- [ ] `DEFAULT_CLIENT_ID` is the production Desktop OAuth Client ID and validates as `.apps.googleusercontent.com`.
- [ ] No API key, service-account key, access token, or refresh token exists in runtime source.
- [ ] A v1.2.0 refresh token whose stored `clientId` differs from `DEFAULT_CLIENT_ID` is treated as disconnected and requires reauthorization.
- [ ] A refresh token issued by the same production Client ID remains usable after upgrade.
- [ ] Existing marker storage key remains `vtm_markers_v1`; no marker migration occurs.
