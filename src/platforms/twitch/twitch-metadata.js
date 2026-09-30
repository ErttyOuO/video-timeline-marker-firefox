(() => {
  const twitch = window.__VTM__.platform.twitch;

  function text(selectorList) {
    for (const selector of selectorList) {
      const el = document.querySelector(selector);
      const value = el?.textContent?.trim();
      if (value) return value;
    }
    return "";
  }

  function getTitle() {
    return text([
      "[data-a-target='stream-title']",
      "h2[data-a-target='stream-title']",
      "h1"
    ]) || document.title.replace(/\s*-\s*Twitch\s*$/, "").trim();
  }

  function getCreatorName() {
    return text([
      "[data-a-target='streamer-name']",
      "[data-a-target='channel-header-display-name']",
      "a[href^='/'][data-a-target='channel-name']"
    ]) || twitch.detector.getBroadcasterLogin();
  }

  function read() {
    const vodId = twitch.detector.getVodId();
    const login = twitch.detector.getBroadcasterLogin();
    return {
      mediaId: vodId || login || null,
      streamId: null,
      broadcasterId: null,
      title: getTitle(),
      creatorName: getCreatorName(),
      originalUrl: location.href,
      canonicalUrl: vodId ? `https://www.twitch.tv/videos/${vodId}` : (login ? `https://www.twitch.tv/${login}` : location.href),
      publishedAt: null,
      liveStartedAt: null
    };
  }

  twitch.metadata = { read };
})();
