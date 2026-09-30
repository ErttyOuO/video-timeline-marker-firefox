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
    const fromDom = text([
      "ytd-watch-metadata ytd-channel-name a",
      "#owner ytd-channel-name a",
      "#channel-name a",
      // 手機版 m.youtube.com
      "ytm-slim-owner-renderer .slim-owner-channel-name",
      "ytm-slim-owner-renderer a[href^='/@'], ytm-slim-owner-renderer a[href^='/channel/']"
    ]);
    if (fromDom) return fromDom;
    // 桌面 / 手機版共通的結構化資料。
    return document.querySelector("[itemprop='author'] link[itemprop='name']")?.getAttribute("content")?.trim()
      || document.querySelector("meta[name='author']")?.getAttribute("content")?.trim()
      || "";
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
