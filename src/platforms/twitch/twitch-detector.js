(() => {
  const ns = window.__VTM__;
  ns.platform.twitch = ns.platform.twitch || {};

  function getVideoElement() {
    return document.querySelector("video");
  }

  function getVodId() {
    const match = location.pathname.match(/^\/videos\/(\d+)/);
    return match ? match[1] : null;
  }

  function getBroadcasterLogin() {
    const first = location.pathname.split("/").filter(Boolean)[0] || "";
    if (!first || ["videos", "directory", "downloads", "settings", "subscriptions"].includes(first)) return "";
    return first;
  }

  function isSupportedPage() {
    return Boolean(getVideoElement() && (getVodId() || getBroadcasterLogin()));
  }

  ns.platform.twitch.detector = { getVideoElement, getVodId, getBroadcasterLogin, isSupportedPage };
})();
