(() => {
  const ns = window.__VTM__;
  ns.platform.youtube = ns.platform.youtube || {};

  function getVideoId() {
    const url = new URL(location.href);
    if (url.pathname === "/watch") return url.searchParams.get("v");
    const shorts = url.pathname.match(/^\/shorts\/([^/?#]+)/);
    if (shorts) return shorts[1];
    const live = url.pathname.match(/^\/live\/([^/?#]+)/);
    if (live) return live[1];
    return null;
  }

  function getVideoElement() {
    return document.querySelector("video.html5-main-video") || document.querySelector("video");
  }

  function isLikelyLive() {
    const video = getVideoElement();
    const liveBadge = document.querySelector(".ytp-live-badge, .ytp-live, [class*='live-badge']");
    const liveTextVisible = liveBadge && liveBadge.getClientRects().length > 0;
    const noFiniteDuration = video && !Number.isFinite(video.duration);
    return Boolean(liveTextVisible || noFiniteDuration || location.pathname.startsWith("/live/"));
  }

  function isSupportedPage() {
    return Boolean(getVideoId() && getVideoElement());
  }

  ns.platform.youtube.detector = { getVideoId, getVideoElement, isLikelyLive, isSupportedPage };
})();
