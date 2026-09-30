(() => {
  const twitch = window.__VTM__.platform.twitch;

  // Twitch Live 的 HTMLMediaElement seekable 可能回傳接近 2^63 的 sentinel 值，
  // 這類數字不是實際直播／VOD 時間，一律排除。
  const MAX_REASONABLE_MEDIA_SECONDS = 60 * 60 * 24 * 30;
  const MAX_CLOCK_SECONDS = 60 * 60 * 24 * 14;

  let liveCalibration = null;
  let attachedVideo = null;

  function normalizeMediaTime(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > MAX_REASONABLE_MEDIA_SECONDS) return null;
    return number;
  }

  function rawRangeEnd(range) {
    try {
      if (!range?.length) return null;
      const value = Number(range.end(range.length - 1));
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  function rangeEnd(range) {
    return normalizeMediaTime(rawRangeEnd(range));
  }

  function rangeStart(range) {
    try {
      if (!range?.length) return null;
      return normalizeMediaTime(range.start(range.length - 1));
    } catch {
      return null;
    }
  }

  function parseClock(text) {
    const value = String(text || "").replace(/\s+/g, "").trim();
    if (!/^\d{1,3}:\d{2}(?::\d{2})?$/.test(value)) return null;
    const parts = value.split(":").map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return null;

    let seconds;
    if (parts.length === 2) {
      const [minutes, sec] = parts;
      if (sec >= 60) return null;
      seconds = minutes * 60 + sec;
    } else {
      const [hours, minutes, sec] = parts;
      if (minutes >= 60 || sec >= 60) return null;
      seconds = hours * 3600 + minutes * 60 + sec;
    }

    return seconds >= 0 && seconds <= MAX_CLOCK_SECONDS ? seconds : null;
  }

  function directLiveElapsed() {
    const selectors = [
      ".live-time",
      '[data-a-target="stream-time"]',
      '[data-test-selector="stream-time"]',
      '[data-a-target="live-time"]'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (!element.getClientRects().length) continue;
        const seconds = parseClock(element.textContent);
        if (seconds !== null) {
          return { seconds, source: selector, text: element.textContent.trim() };
        }
      }
    }
    return null;
  }

  function leafClockCandidate(element, source) {
    if (!element || !element.getClientRects().length || element.children.length) return null;
    const text = element.textContent?.trim() || "";
    const seconds = parseClock(text);
    return seconds === null ? null : { seconds, source, text, element };
  }

  function boundedClockSearch(root, source, maxNodes = 120) {
    if (!root) return null;
    const candidates = [];
    let visited = 0;

    for (const element of root.querySelectorAll("span, strong, p, div")) {
      visited += 1;
      if (visited > maxNodes) break;
      const candidate = leafClockCandidate(element, source);
      if (candidate) candidates.push(candidate);
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.seconds - a.seconds);
    return candidates[0];
  }

  function readLiveElapsedFromPage() {
    // 快速路徑：正常 Twitch 版面只需要幾個 selector，不做任何全頁掃描。
    const direct = directLiveElapsed();
    if (direct) return direct;

    // 備援搜尋限定在觀看人數附近，而且限制最多檢查 120 個節點。
    const viewers = document.querySelector('[data-a-target="animated-channel-viewers-count"]');
    let region = viewers?.parentElement || null;
    for (let depth = 0; region && depth < 4; depth += 1, region = region.parentElement) {
      const candidate = boundedClockSearch(region, "near-viewer-count");
      if (candidate) return candidate;
    }

    // 第二備援只檢查標題附近，不再向大範圍 DOM 擴散。
    const title = document.querySelector('[data-a-target="stream-title"]');
    region = title?.parentElement || null;
    for (let depth = 0; region && depth < 3; depth += 1, region = region.parentElement) {
      const candidate = boundedClockSearch(region, "near-stream-title");
      if (candidate) return candidate;
    }

    return null;
  }

  function sampleLiveState(video = twitch.detector.getVideoElement()) {
    if (twitch.detector.getVodId() || !video) return null;
    const pageLiveTime = readLiveElapsedFromPage();
    if (!pageLiveTime) return null;

    const playerTime = normalizeMediaTime(video.currentTime);
    if (playerTime === null) return null;

    return {
      at: Date.now(),
      src: video.currentSrc || video.src || "",
      playerTime,
      liveElapsed: pageLiveTime.seconds,
      liveSource: pageLiveTime.source,
      liveText: pageLiveTime.text,
      paused: Boolean(video.paused)
    };
  }

  function setCalibration(sample) {
    if (!sample) return;
    liveCalibration = {
      src: sample.src,
      anchorPlayerTime: sample.playerTime,
      anchorLiveElapsed: sample.liveElapsed,
      anchoredAt: sample.at,
      source: sample.liveSource
    };
  }

  function resetCalibration() {
    liveCalibration = null;
  }

  function maybeAnchorFromPlayback() {
    if (!attachedVideo || twitch.detector.getVodId()) return;
    const src = attachedVideo.currentSrc || attachedVideo.src || "";

    // 同一個 MediaSource 已有基準時，不因 pause/play 反覆做 DOM 搜尋。
    if (liveCalibration && liveCalibration.src === src) return;

    const sample = sampleLiveState(attachedVideo);
    if (sample && !sample.paused) setCalibration(sample);
  }

  function onEmptied() {
    resetCalibration();
  }

  function attach(video) {
    if (!video || video === attachedVideo) return;
    detach();
    attachedVideo = video;
    attachedVideo.addEventListener("playing", maybeAnchorFromPlayback, { passive: true });
    attachedVideo.addEventListener("loadedmetadata", maybeAnchorFromPlayback, { passive: true });
    attachedVideo.addEventListener("emptied", onEmptied, { passive: true });

    // 若掛載時影片已經在播放，只做一次延後校準；不建立背景輪詢。
    if (!attachedVideo.paused && !twitch.detector.getVodId()) {
      window.setTimeout(() => {
        if (attachedVideo === video) maybeAnchorFromPlayback();
      }, 250);
    }
  }

  function detach() {
    if (!attachedVideo) return;
    attachedVideo.removeEventListener("playing", maybeAnchorFromPlayback);
    attachedVideo.removeEventListener("loadedmetadata", maybeAnchorFromPlayback);
    attachedVideo.removeEventListener("emptied", onEmptied);
    attachedVideo = null;
    resetCalibration();
  }

  function calibratedLivePosition(sample) {
    if (!sample) return null;
    if (!liveCalibration || liveCalibration.src !== sample.src) return sample.liveElapsed;

    const relative = sample.playerTime - liveCalibration.anchorPlayerTime;
    const position = liveCalibration.anchorLiveElapsed + relative;
    if (!Number.isFinite(position) || position < 0) return sample.liveElapsed;

    // 如果播放器時間軸重置／跳動，寧可退回 Twitch 頁面時計，不使用可疑差值。
    if (relative < -3 || position > sample.liveElapsed + 5) return sample.liveElapsed;
    return position;
  }

  function capture() {
    const video = twitch.detector.getVideoElement();
    if (!video) throw new Error("找不到 Twitch 播放器 video 元素");
    attach(video);

    const vodId = twitch.detector.getVodId();
    const isVod = Boolean(vodId);
    const currentTime = normalizeMediaTime(video.currentTime);
    const seekableStart = rangeStart(video.seekable);
    const seekableEnd = rangeEnd(video.seekable);
    const bufferedEnd = rangeEnd(video.buffered);

    if (isVod) {
      return {
        mediaType: "vod",
        positionSeconds: currentTime,
        accuracy: "exact",
        timeline: {
          playerCurrentTime: currentTime,
          duration: normalizeMediaTime(video.duration),
          seekableStart,
          seekableEnd,
          bufferedEnd,
          behindLiveEdge: null,
          liveElapsed: null,
          estimatedVodPosition: currentTime,
          source: "html-media-currentTime"
        },
        diagnostics: {
          paused: Boolean(video.paused),
          playbackRate: video.playbackRate,
          readyState: video.readyState,
          note: "Twitch VOD：使用 HTMLMediaElement currentTime。"
        }
      };
    }

    // Live 頁面只在使用者真正按下標記時取一次 DOM 時計。
    const sample = sampleLiveState(video);
    if (!sample) {
      throw new Error("目前無法讀取 Twitch 頁面的直播經過時間；為避免記錄錯誤時間，本次不建立標記。");
    }

    // 若尚未建立播放基準且目前正在播放，這次點擊順便建立基準，供下一次標記判斷暫停／相對位置。
    if ((!liveCalibration || liveCalibration.src !== sample.src) && !sample.paused) {
      setCalibration(sample);
    }

    const position = calibratedLivePosition(sample);
    const hasRelativeCalibration = Boolean(liveCalibration && liveCalibration.src === sample.src);
    const estimatedLiveStartedAt = new Date(Date.now() - sample.liveElapsed * 1000).toISOString();
    const rawSeekableEnd = rawRangeEnd(video.seekable);

    return {
      mediaType: "live",
      positionSeconds: position,
      accuracy: hasRelativeCalibration ? "calibrated" : "estimated",
      liveStartedAt: estimatedLiveStartedAt,
      timeline: {
        playerCurrentTime: currentTime,
        duration: normalizeMediaTime(video.duration),
        seekableStart,
        seekableEnd,
        bufferedEnd,
        behindLiveEdge: position !== null ? Math.max(0, sample.liveElapsed - position) : null,
        liveElapsed: sample.liveElapsed,
        estimatedVodPosition: position,
        source: hasRelativeCalibration ? `${sample.liveSource}+player-relative` : sample.liveSource,
        displayedLiveTime: sample.liveText
      },
      diagnostics: {
        paused: Boolean(video.paused),
        playbackRate: video.playbackRate,
        readyState: video.readyState,
        rawPlayerCurrentTime: Number.isFinite(Number(video.currentTime)) ? Number(video.currentTime) : null,
        rawSeekableEnd,
        rejectedSeekableSentinel: rawSeekableEnd !== null && seekableEnd === null,
        calibration: liveCalibration ? {
          anchorPlayerTime: liveCalibration.anchorPlayerTime,
          anchorLiveElapsed: liveCalibration.anchorLiveElapsed,
          anchoredAt: new Date(liveCalibration.anchoredAt).toISOString()
        } : null,
        performanceMode: "event-driven-no-polling",
        note: hasRelativeCalibration
          ? "Twitch Live：事件驅動校準；頁面平時不輪詢 DOM，只在播放事件或使用者按標記時讀直播時計。"
          : "Twitch Live：使用 Twitch 頁面顯示直播時間；HTML video seekable 絕對值不參與直播位置。"
      }
    };
  }

  twitch.timeline = { capture, readLiveElapsedFromPage, attach, detach };
})();
