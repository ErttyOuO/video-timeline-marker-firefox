# PROJECT_STRUCTURE.md

```text
video-timeline-marker-firefox-v1.2.3/
├─ manifest.json
├─ README.md
├─ PROJECT_STRUCTURE.md
├─ _locales/
│  ├─ en/messages.json
│  ├─ zh_TW/messages.json
│  └─ zh_CN/messages.json
├─ icons/
├─ docs/
│  ├─ TEST_PLAN.md
│  ├─ GOOGLE_DRIVE_SYNC_SETUP.md
│  └─ TWITCH_LIVE_RESEARCH.md
└─ src/
   ├─ background/background.js
   ├─ content/
   │  ├─ youtube-content.js
   │  ├─ twitch-content.js
   │  └─ popup-capture-bridge.js # popup 直接擷取目前播放時間；可按需補注入到既有分頁
   ├─ core/
   │  ├─ namespace.js
   │  ├─ i18n.js
   │  ├─ marker-store.js
   │  └─ time-format.js
   ├─ platforms/
   │  ├─ youtube/
   │  └─ twitch/
   ├─ import/
   │  ├─ import-utils.js       # TXT parse / metadata rebuild / safe merge
   │  ├─ import.html           # dedicated Firefox-safe file picker window
   │  ├─ import.css
   │  └─ import.js
   ├─ popup/
   │  ├─ popup.html
   │  ├─ popup.css
   │  └─ popup.js
   ├─ sync/
   │  ├─ google-auth.js        # Firefox identity + Google OAuth Desktop PKCE
   │  ├─ google-drive.js       # Drive appDataFolder file transport
   │  └─ sync-engine.js        # two-way merge, tombstones, scheduling
   └─ ui/
      ├─ marker-ui.css
      └─ marker-ui.js
```

## 編輯規則

- 全專案維持 UTF-8。
- 不要對繁體中文做不必要轉碼。
- 不要產生 mojibake／亂碼。
- 若不確定 YouTube/Twitch DOM 原文字或 selector，先讀取目前原始程式碼再做最小幅度修改。
- YouTube 與 Twitch 不共享平台 selector；平台邏輯必須維持隔離。
- Twitch Live 禁止把 `seekableEnd` 的巨大 sentinel 值當作直播秒數。
- Twitch VOD 與 Twitch Live 必須維持兩套時間策略：VOD 使用 `currentTime`；Live 使用 Twitch 頁面直播時計為基準。

## v0.1.3 UI 定位原則

- `#vtm-mark-button` 可以掛在 YouTube/Twitch 原生操作列。
- `#vtm-panel` 必須留在 document root 的 overlay portal，不可再插入原生操作列。
- 面板使用 `position: fixed`，優先覆蓋目前可見影片右上角。
- 開啟 textarea 時必須使用 `focus({ preventScroll: true })`；不得用會觸發頁面自動捲動的聚焦方式。
- 面板展開／收合不得改變頁面高度、播放器位置或操作列高度。
- YouTube Shorts 不在本專案支援範圍，不增加 Shorts 專用 selector。


## v0.1.5 Twitch 掛載規則

- Twitch `🔖` 必須掛在 Follow 所屬的真正水平 action row，不可直接假設 Follow 的父層就是水平列。
- action row 需檢查：寬而矮、非 column flex、同一 Y 軸附近存在至少兩個原生按鈕。
- 找不到可靠 row 時使用 fallback；不要為了「一定要 inline」而插進未知 wrapper。
- 穩定頁面不得以全頁 MutationObserver 維持掛載；採低頻狀態檢查與 SPA 事件。
- 修改 Twitch 掛載不得碰 Twitch VOD `currentTime` 與 Live timeline 計算。


## v0.1.6 面板淡出規則

- 自動淡出只能在標記成功寫入 `storage.local` 後啟用；v0.1.9 起點擊 `🔖` 即完成第一次寫入，因此面板開啟後即可進入 idle fade。
- idle delay 固定 2000ms；滑鼠位於面板內時不得開始 fade timer。
- `pointerenter` 必須清除既有 timer 並恢復 opacity；`pointerleave` 才重新安排 2000ms timer。
- `openCapturePanel()`、`closePanel()` 與「更新標記」必須清除／重排既有 timer，避免多個 timeout 疊加。
- 淡出效果只用 CSS opacity transition，不新增 MutationObserver、requestAnimationFrame loop 或 interval。
- `#vtm-mark-button` 不參與淡出，確保使用者隨時可以重新開啟標記面板。

## Twitch 按鈕定位規則（v0.2.0+）

- Twitch `🔖` 必須真正嵌入 `data-target="channel-header-right"` 內 Follow / Notification 共用的原生水平 action group。
- 優先以 Follow 與 Notification 的最低共同祖先找 action group，再把插件 slot 插在 Follow slot 前面。
- A/B 版面備援只允許沿 Follow 往上最多 8 層，且父層必須是水平 flex、包含至少兩個直接按鈕子槽。
- 找不到可靠 action group 時隱藏 `🔖`，不得改回 fixed viewport anchor、聊天室或右下角 fallback。
- `#vtm-twitch-button-slot` 只能存在一個；SPA 換頁不得建立重複 slot / button。
- 按鈕寬高與圓角繼續同步 Follow / Unfollow 的實際 bounding box；位置由 Twitch 原生 layout 處理，不做 `left/top` 輪詢。
- 穩定頁面不得新增全頁 MutationObserver 或高頻 DOM 掃描。

## v0.1.8 Twitch 原生尺寸同步

- Twitch 標記按鈕不再使用固定 64×40 尺寸。
- 直接同步目前可見 `follow-button` / `unfollow-button` 的 `getBoundingClientRect()` 寬高與 `border-radius`。
- Twitch 標記按鈕固定貼在追蹤按鈕左側 8px，垂直 top 完全對齊。
- Twitch 找不到追蹤錨點時仍維持隱藏，不使用 fallback。
- YouTube 樣式與時間邏輯不變。


## v0.2.0 YouTube 原生尺寸與主題規則

- YouTube `🔖 標記` 必須同步同一操作列可見 Share 按鈕的實際寬高與 border-radius；找不到 Share 時才使用合理尺寸的同列原生 button 作參考。
- YouTube 按鈕不得寫死固定外框尺寸。
- 深色主題以 `html[dark]` 為主要判斷；淺色為預設。
- 淺色與深色都使用「上半稍亮、下半稍深」的低對比漸層，不使用會明顯偏離 YouTube UI 的高亮光澤。
- YouTube inline 按鈕 hover 不使用 `translateY`，避免與原生控制列產生位移差。

## v0.1.9 即時標記與 i18n 規則

- `🔖` click 的 capture 結果必須先 `store.add()` 成功，才顯示本次標記面板；UI 不再承擔第一次儲存動作。
- 同一次面板的「更新標記」只能對 `activeMarkerId` 執行 `store.update()`，不得新增第二筆。
- 不自動 focus textarea；使用者要備註時以滑鼠移入喚醒面板。
- Popup 平台辨識：`data-platform="twitch"` 使用紫框，`data-platform="youtube"` 使用紅框。
- UI 語言以 Firefox `browser.i18n` 為唯一來源，不依 YouTube/Twitch 網站語言。
- 預設 locale 為 `en`；提供 `zh_TW` 與 `zh_CN`。
- 所有 locale JSON 與程式碼維持 UTF-8，不得產生 mojibake。

## v0.2.1 YouTube inline placement 修正规则

- YouTube `🔖` 禁止使用 fixed / viewport fallback；找不到可靠 `#top-level-buttons-computed` 时必须先隐藏。
- YouTube 低频 2 秒补偿检查必须验证 `isInlinePlacementValid("youtube")`，不能只判断 `#vtm-mark-button` 是否已经存在。
- 正确操作列稍晚建立后，必须自动重新 mount，不需要用户刷新页面。
- 优先以同列 Share 按钮作为尺寸与插入顺序锚点；`🔖` 应位于 Share 之后。
- YouTube 深／浅色上下半渐层只能维持低对比透明差，不得出现明显上白下黑的二分视觉。
- 不新增 MutationObserver、高频轮询或 requestAnimationFrame 定位循环。
- Twitch Live/VOD timeline、Popup、storage、fade 与 i18n 不得因本修正改变。


## v0.2.2 YouTube fullscreen / manual correction / TXT 規則

- YouTube 一般觀看模式 `🔖` 優先放在 `#flexible-item-buttons` 最後方，避免搶佔 top-level 主操作列並擠掉「儲存／加入播放清單」。
- YouTube 真正 fullscreen 時，同一顆 `#vtm-mark-button` 移入 `#movie_player .ytp-left-controls`；不得建立第二顆 fullscreen button。
- fullscreen 時 `#vtm-root` 可作為唯一例外暫時移入 `#movie_player`，退出 fullscreen 後必須搬回 `document.documentElement`。
- `fullscreenchange` 只觸發一次強制 placement refresh，不新增 MutationObserver 或 animation loop。
- `-5 / +5 秒` 必須更新既有 `activeMarkerId`，不可新增第二筆；快速連按需序列化，確保累加不因 async storage race 遺失。
- 手動微調只改最終 `positionSeconds` / `estimatedVodPosition`，保留原始 `playerCurrentTime` diagnostics。
- 刪除本次標記後自動切到本片清單。
- TXT 每組影片只輸出基本 metadata、`標註時間：` 與每筆 `[HH:MM:SS]`；備註為空時完全省略備註行。


## v0.2.3 YouTube responsive / fullscreen stability 規則

- YouTube 一般模式禁止把 VTM 插入 `#flexible-item-buttons`；該區塊是 YouTube 響應式自動收合區，會造成臨界寬度 feedback loop。
- 一般模式可掛在 Share 所在的 `#top-level-buttons-computed`，但不得以犧牲原生 flexible actions 為代價。
- v1.0.0 起禁止因 responsive 壓力直接隱藏 YouTube normal marker；改採 `full → compact → micro` 三段式降級。
- 若完整版讓原本可見的 flexible actions 收合或 marker 超出 `#actions` 邊界，只能在有限雙 RAF 檢查內降級尺寸，不得反覆插入／移除造成閃爍。
- Firefox zoom / resize 可用低成本 debounce 重新 mount，以重新評估 full/compact/micro；不得改成全頁 MutationObserver 或持續 RAF loop。
- 真正 YouTube fullscreen 只依 `document.fullscreenElement` 與 `#movie_player` 的包含關係判斷。
- fullscreen 按鈕必須使用白色播放器 SVG 圖示，位置在 `.ytp-time-display` 後方；不得顯示一般模式紅色 emoji。
- fullscreen 可套 `ytp-button` class 並同步原生 play/mute 控制尺寸，但不得使用 normal tonal gradient / pill radius。
- fullscreen 進出仍只使用同一顆 `#vtm-mark-button`，不得建立第二顆。
- 不得為 responsive/fullscreen 定位新增全頁 MutationObserver、持續 RAF loop 或高頻 DOM polling。


## v0.2.4 備註輸入與外部關閉規則

- 點 `🔖` 後標記先立即寫入 storage，再開啟面板。
- 面板開啟後 textarea 必須以 `focus({ preventScroll: true })` 自動聚焦，使用者可直接打字。
- 備註採 debounce 自動儲存；UI 不再要求第二次按「更新標記」。
- note autosave、±5 秒、刪除等 storage 寫入必須有順序，避免並行 read-modify-write 互相覆蓋。
- 備註輸入與 focus 事件應喚醒並重新安排 2 秒 fade timer；滑鼠 hover 面板時不得淡出。
- 點面板外即關閉。若 target 是影片播放表面，關閉面板的同一次 click 必須被攔截，不能改變播放/暫停狀態。
- 播放器真正控制元件（button、進度條、popup controls）不得被當成空白播放表面吞掉。
- click swallow 必須有短暫逾時保護，禁止旗標殘留到下一次正常使用者點擊。


## v0.2.5 YouTube fullscreen visibility fix

- Fullscreen `#vtm-mark-button` remains the same single button moved into `.ytp-left-controls`.
- Do not force `display:inline-flex` or `float:none` in fullscreen; YouTube player controls use the native `ytp-button` float layout.
- Fullscreen marker uses `float:left`, a native player-button footprint, explicit visibility, and a 24px white bookmark SVG.
- Normal YouTube mode and Twitch placement/timeline logic are unchanged.
- No MutationObserver, high-frequency polling, or continuous RAF loop was added.


## v0.2.6 Popup 分組匯出 / Enter 規則

- Popup 以 `platform + mediaId/canonicalUrl` 為 media group key；同一媒體的標記集中顯示。
- 群組匯出必須傳遞該媒體所有 marker IDs；批次匯出可傳多個群組 IDs，但 background 必須維持「每個 media group 一個 TXT」的分檔規則。
- 不可因批次匯出而把 YouTube 與 Twitch、或不同影片／直播合併成同一 TXT。
- 備註 textarea：Enter = flush note auto-save + close panel；Shift+Enter = newline。
- IME composition 中的 Enter 不得關閉面板。
- 修改 Popup / keyboard UX 不得碰 YouTube/Twitch timeline、播放器掛載、MutationObserver / polling 策略。


## v0.2.7 YouTube fullscreen DOM-grounded placement fix

- 依使用者提供的 2026-08-24 完整 YouTube fullscreen DOM 驗證：`#vtm-mark-button` 已存在於 `.ytp-left-controls`，因此問題不是 fullscreen 事件或 selector 掛載失敗。
- Delhi player 中，marker 位於 `.ytp-time-display` 後方時可能存在 DOM 但未穩定繪製；fullscreen 改為插在 `volume-area` 之後、`.ytp-time-display` 之前。
- Fullscreen bookmark SVG 改為 `button.ytp-button` 的直接 SVG 子節點，使用明確 `#fff` fill，不再以自訂 span 包住 SVG。
- Fullscreen button 加入 `data-vtm-placement="youtube-fullscreen-before-time"` 方便後續 DOM 診斷。
- 不新增 MutationObserver、RAF loop 或更高頻 polling；Twitch、timeline、storage、Popup、TXT export 不修改。

## v0.2.8 YouTube fullscreen vertical alignment / subtle underlay

- Fullscreen marker metrics must reference the direct `.ytp-play-button.ytp-button` first; do not prefer nested `.ytp-volume-icon`, because its 40px box belongs inside `.ytp-volume-area` and can place a direct child marker too high.
- Marker remains a direct child of `.ytp-left-controls`, between volume area and time display.
- Fullscreen hitbox follows the play button dimensions; bookmark SVG is centered inside that hitbox.
- Add only a very subtle translucent black 8px-rounded underlay behind the bookmark (`rgba(0,0,0,.14)`; hover `.20`) so it visually sits on the same control strip without becoming a heavy pill.
- No MutationObserver, interval, RAF positioning loop, timeline, Twitch, storage, Popup or export logic changes.


## v0.2.9 Timeline-based ordering

Marker ordering is based on the media timeline rather than marker creation order. `vodResolution.resolvedPositionSeconds`, `positionSeconds`, and `timeline.playerCurrentTime` are checked in that order. Lists and TXT output use ascending media time (earlier position first, later position last); capture time is only a tie-breaker/fallback and is also ordered oldest to newest.


## v0.3.0 YouTube fullscreen native visual-box alignment

- Fullscreen marker remains the same single `#vtm-mark-button` in `.ytp-left-controls`, between volume and time display.
- Root cause of the remaining visual height mismatch: VTM's custom translucent underlay was ~40px while the 2026 Delhi native Play/Pause SVG is 36×36; the underlay therefore began higher and made the marker look vertically oversized even when the outer 48px hitbox matched.
- Fullscreen Bookmark SVG now uses the same 36×36 SVG footprint as native Play/Pause. Its visible bookmark path uses y=4.5..31.5, matching the native Pause icon's vertical visual range.
- The subtle underlay is reduced to 36×36 and lower contrast (`rgba(0,0,0,.10)`, hover `.16`) so it stays inside the native icon footprint instead of visually increasing button height.
- Do not use hardcoded `top`/`translateY` compensation. No new MutationObserver, interval, RAF positioning loop, timeline, Twitch, Popup or export changes.

## v0.3.1 YouTube fullscreen native visual scale

- Keep the same native fullscreen hitbox and DOM placement between volume and time.
- Do not enlarge the bookmark to the 36×36 Play/Pause SVG footprint: a filled bookmark has much more perceived area.
- Use a 24×24 outline bookmark to match YouTube's 24×24 volume/previous/next visual family while keeping the outer `.ytp-button` hitbox unchanged.
- Use only a subtle 32×32 translucent black underlay; no `top`, `margin-top`, or `translateY` alignment compensation.
- No timeline, Twitch, Popup, export, ordering, autosave, observer or polling changes.

## v0.3.2 YouTube fullscreen title-right placement

- 放棄 `.ytp-left-controls` 底部控制列掛載，避免再與 Play / Volume / Time 的不同盒模型做視覺對齊。
- 依使用者提供的 2026-08-24 完整 YouTube fullscreen DOM，真正 fullscreen 時將同一顆 `#vtm-mark-button` 移入 `.ytp-overlay-top-right .ytp-chrome-top-buttons`。
- 該 host 是 YouTube 原生右上角 chrome 按鈕區，與左側影片標題 overlay 同層；VTM append 到尾端，視覺上位於影片標題列最右側。
- Fullscreen 使用 48×48 hitbox、24×24 白色線框 bookmark、淡黑圓形背景；不再使用底部控制列專用 float / player metric 同步。
- `data-vtm-placement` 改為 `youtube-fullscreen-title-right`，供後續 DOM 診斷。
- Fullscreen 退出後仍將同一顆按鈕移回一般 YouTube action row；不得建立第二顆。
- 不新增 MutationObserver、高頻 polling、持續 RAF；YouTube/Twitch timeline、Popup、TXT、storage、排序均不修改。



## v0.3.4 YouTube fullscreen legacy cleanup

- Fullscreen uses a dedicated `#vtm-mark-button-fullscreen` mounted only in `.ytp-overlay-top-right .ytp-chrome-top-buttons`.
- The normal `#vtm-mark-button` is parked outside the fullscreen player and hidden while fullscreen is active.
- Explicit CSS kill-switch hides any stale/legacy VTM marker under `.ytp-left-controls`, covering temporary-extension hot reloads where an older content script can survive in an already-open YouTube tab.
- No timeline, Twitch, Popup, export, ordering or storage changes.


## v0.3.5 Fullscreen button dormant-state fix

- The dedicated YouTube fullscreen marker is now truly dormant outside browser fullscreen.
- Dormant state removes `vtm-youtube-fullscreen-mounted`, sets `hidden`, `disabled`, `aria-hidden="true"`, and `tabIndex=-1`.
- Active fullscreen state is allowed only while mounted in `.ytp-chrome-top-buttons` with `data-vtm-placement="youtube-fullscreen-title-right"`.
- CSS hard-blocks any non-mounted/dormant fullscreen marker from rendering or receiving pointer input.
- Fixes the top-left ghost marker visible on normal YouTube watch pages.


## v1.0.0 Timeline ordering

- 同一影片／直播內的標記統一改為時間軸由早到晚：最上方最舊（較早時間），最下方最新（較晚時間）。
- 套用範圍：Popup、本片／本直播清單、單片匯出、批次匯出、匯出全部 TXT。
- 優先排序欄位依序為 `vodResolution.resolvedPositionSeconds`、`positionSeconds`、`timeline.playerCurrentTime`；沒有可用時間時才以 `capturedAt` 由舊到新排序。
- 影片／直播群組之間的排序不變，仍依最近標記活動排序。


## v1.1.0 Popup 批次刪除與 TXT 回入規則

- 正式 Add-on ID 必須維持 `video-timeline-marker@erttyouo`，不得因版本更新再次更換，避免 Firefox 建立新的 `storage.local` namespace。
- Storage Key 必須維持 `vtm_markers_v1`，v1.0.0 → v1.2.3 不做破壞性 marker migration。
- Popup 勾選框同時服務「批次匯出」與「批次刪除」；刪除選取必須一次 `storage.local.set()` 完成，不逐筆反覆寫入。
- 每個媒體群組提供「刪除本片／直播」，只刪該 group 內 marker IDs。
- 批次刪除與群組刪除都必須先顯示不可復原確認訊息與受影響數量。
- `import-utils.js` 只解析本插件既有 TXT 格式，不執行遠端請求，不新增 host permission。
- TXT 回入需支援 UTF-8 BOM、CRLF/LF、繁中／簡中／英文欄位名稱、多行備註。
- 匯入 merge 不可覆寫同影片同秒已有的不同非空備註；完全重複則略過，既有備註空白時才允許補回匯入備註。
- 匯入後 marker 必須仍能被 Popup、本片清單與既有 TXT exporter 正常讀取。


## v1.1.6 Popup 匯入與 Open 規則

- Firefox 的 toolbar action popup 不直接放 `<input type="file">`；「匯入 TXT」改為開啟 `src/import/import.html` 的獨立 extension popup window，避免原生檔案選擇器讓 action popup 失焦關閉後 `change` 事件遺失。
- `src/import/import-utils.js` 同時解析目前 TXT、舊版 v0.1.x～v0.2.1 verbose TXT 與簡化時間行。
- 匯入結果保存於獨立 key `vtm_last_import_report_v1`，不改動 marker key `vtm_markers_v1`。使用者關閉匯入結果後才刪除 report key。
- `Open` 以媒體 identity 比對既有 tab：YouTube `v`、Twitch `/videos/{id}`、Twitch live channel。匹配時 `tabs.update()` 同一 tab；無匹配才 `tabs.create()`。
- 分頁查詢只限定 manifest 已有 host permissions 的 YouTube / Twitch，不新增廣泛 `tabs` 權限。


## v1.1.6 YouTube Fullscreen Autohide Rule

- The fullscreen marker does not run an independent inactivity timer.
- `marker-ui.css` follows YouTube player states `ytp-autohide`, `ytp-autohide-active`, and `ytp-hide-controls`.
- In those states the dedicated fullscreen marker uses `opacity: 0`, `visibility: hidden`, and `pointer-events: none`; removing the state restores it through the normal mounted style.
- This affects only `#vtm-mark-button-fullscreen` inside `#movie_player`; normal-page and Twitch buttons are outside this rule.


## v1.2.0 Google Drive 同步架構

- `vtm_markers_v1` 仍是 local-first marker 資料來源；不得讓新增標記等待網路。
- `vtm_sync_meta_v1` 只保存 per-marker update version 與 deletion tombstone，不改寫既有 marker schema。
- Google OAuth 使用 Desktop app + PKCE；Desktop client 的 client secret（Google 定義為非機密）內建於 google-auth.js，token 交換必須帶入。refresh token 留在 `storage.local`；access token 僅保存在 background memory。
- Drive 只使用 `drive.appdata` scope，檔案固定為 `video-timeline-marker-sync.json`。
- 雲端 JSON/schema 驗證失敗時禁止覆蓋本機 markers。
- 同一 marker 以較新的 version 勝出；較新的 tombstone 必須勝過較舊 live record。
- 本機 marker 變更使用 monotonic version：版本時間至少比該 ID 先前已知 updated/deleted version 多 1ms，降低裝置時鐘偏差造成的新編輯被舊版壓回。
- 使用者移除 Firefox optional data-collection consent 時，背景同步必須停止並清除本機 OAuth credential。
- 同步網路邏輯只能位於 `src/sync/`，不得散入 YouTube/Twitch detector/timeline。

### v1.2.0 concurrent first-sync safety
- Drive may briefly contain multiple same-name appData sync files if two devices perform the very first sync concurrently.
- `google-drive.js` therefore returns every matching sync file, not only the newest one.
- `sync-engine.js` merges all matching cloud payloads first, then merges that combined cloud state with local state.
- The newest cloud file is the primary write target and is updated with the combined state. Older duplicates are left untouched rather than deleted automatically; their older events cannot override newer versions/tombstones on subsequent merges.


## v1.2.3 OAuth release identity

- `src/sync/google-auth.js` 內建單一正式 Desktop OAuth Client ID；該 ID 是公開 application identifier，不是 secret。
- Popup 不提供 Client ID 輸入或 runtime override。
- 禁止把 client_secret_*.json 檔案本身、API key、service-account private key 或任何使用者 token 打包進 XPI。
- 若本機舊 refresh token 的 `clientId` 與正式 Client ID 不同，必須重新授權，不可跨 client 重用。
