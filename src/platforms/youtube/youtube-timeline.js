(() => {
  const ns = window.__VTM__;
  const yt = ns.platform.youtube;

  function getSeekable(video) {
    try {
      if (!video?.seekable?.length) return { start: null, end: null };
      const last = video.seekable.length - 1;
      return { start: video.seekable.start(last), end: video.seekable.end(last) };
    } catch {
      return { start: null, end: null };
    }
  }

  function capture() {
    if (document.querySelector(".html5-video-player.ad-showing")) {
      throw new Error("YouTube 廣告播放中，已暫停建立時間標記");
    }

    const video = yt.detector.getVideoElement();
    if (!video) throw new Error("找不到 YouTube 播放器 video 元素");

    const isLive = yt.detector.isLikelyLive();
    const seekable = getSeekable(video);
    const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : null;
    const behindLiveEdge = isLive && currentTime !== null && seekable.end !== null
      ? Math.max(0, seekable.end - currentTime)
      : null;

    return {
      mediaType: isLive ? "live" : "video",
      positionSeconds: currentTime,
      accuracy: isLive ? "calibrated" : "exact",
      timeline: {
        playerCurrentTime: currentTime,
        duration: Number.isFinite(video.duration) ? video.duration : null,
        seekableStart: seekable.start,
        seekableEnd: seekable.end,
        behindLiveEdge,
        liveElapsed: isLive ? seekable.end : null,
        estimatedVodPosition: currentTime
      },
      diagnostics: {
        paused: Boolean(video.paused),
        playbackRate: video.playbackRate,
        readyState: video.readyState
      }
    };
  }

  yt.timeline = { capture };
})();
