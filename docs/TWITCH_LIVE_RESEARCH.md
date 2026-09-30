# Twitch Live Timeline Research — v0.1.2

## 實測問題

使用者在 Twitch Live 實測得到：

```text
video.currentTime ≈ 43.5
seekableEnd ≈ 9223372036854...
實際 Twitch 頁面直播時間 ≈ 2:33:20
```

這證明 Live 頁面的 `HTMLMediaElement.currentTime` / `seekableEnd` 絕對值不能直接當作未來 VOD offset。

## v0.1.2 策略

1. VOD：維持 `video.currentTime`。
2. Live：先讀 Twitch 頁面自身的直播經過時間。
3. 第一優先 selector：`.live-time`。
4. 備援：用 `[data-a-target="animated-channel-viewers-count"]` 當錨點，只在附近尋找格式嚴格的 `H:MM:SS` / `MM:SS`。
5. 取得直播時計後，以當下 `video.currentTime` 建立相對校準 anchor：

```text
anchorVodPosition = Twitch 頁面直播經過時間
anchorPlayerTime  = video.currentTime

之後推定位置 = anchorVodPosition
             + (currentPlayerTime - anchorPlayerTime)
```

此相對算法的目的不是相信 `currentTime` 的絕對值，而是利用其「相對秒數變化」追蹤暫停／續播。

6. 若 video source 改變、currentTime 大幅倒退／不合理跳躍，重新校準。
7. `seekableEnd` 若超過合理媒體長度直接視為 sentinel，絕不參與計算。
8. 若連 Twitch 頁面直播時計都讀不到，拒絕建立 Live 時間標記，避免保存錯誤數字。

## 尚需實測

- 一般直播最前端：標記值是否與頁面直播時間相同（±1～2 秒）。
- 暫停 20～30 秒後標記：相對校準是否停留在暫停畫面附近。
- 暫停後續播：是否繼續保持落後直播的差值。
- Twitch 自動重新連線／切換畫質：是否觸發 source/reset 後正確重新校準。
- 廣告開始與結束：是否需要凍結或拒絕標記。
- 直播結束產生 VOD 後：同一標記實際跳轉位置與當時畫面的秒數誤差。
