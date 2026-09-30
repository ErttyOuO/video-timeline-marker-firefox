(() => {
  const yt = window.__VTM__.platform.youtube;

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
      "ytd-watch-metadata h1 yt-formatted-string",
      "h1.ytd-watch-metadata yt-formatted-string",
      "h1 yt-formatted-string"
    ]) || document.title.replace(/\s*-\s*YouTube\s*$/, "").trim();
  }

  function getCreatorName() {
    return text([
      "ytd-watch-metadata ytd-channel-name a",
      "#owner ytd-channel-name a",
      "#channel-name a"
    ]);
  }

  function getCanonicalUrl(videoId) {
    return videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : location.href;
  }

  function getPublishedAt() {
    const selectors = [
      "meta[itemprop='datePublished']",
      "meta[itemprop='uploadDate']"
    ];
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.getAttribute("content")?.trim();
      if (value && !Number.isNaN(new Date(value).getTime())) return value;
    }
    return null;
  }

  function read() {
    const videoId = yt.detector.getVideoId();
    return {
      mediaId: videoId,
      title: getTitle(),
      creatorName: getCreatorName(),
      originalUrl: location.href,
      canonicalUrl: getCanonicalUrl(videoId),
      publishedAt: getPublishedAt(),
      liveStartedAt: null
    };
  }

  yt.metadata = { read };
})();
