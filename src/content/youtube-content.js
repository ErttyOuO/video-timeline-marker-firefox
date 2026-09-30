(() => {
  const ns = window.__VTM__;
  const yt = ns.platform.youtube;

  let lastHref = "";
  let lastSupported = null;

  function capture() {
    const metadata = yt.metadata.read();
    const timeline = yt.timeline.capture();
    return {
      platform: "youtube",
      ...metadata,
      ...timeline
    };
  }

  function refresh({ force = false } = {}) {
    const href = location.href;
    const supported = yt.detector.isSupportedPage();
    const hrefChanged = href !== lastHref;
    const supportChanged = supported !== lastSupported;
    const button = document.getElementById("vtm-mark-button");
    const buttonMissing = supported && !button;
    const placementInvalid = supported && button && !ns.ui.marker.isInlinePlacementValid("youtube");

    if (supported) {
      // 首次載入時 actions 可能比 <video> 晚建立；即使按鈕物件已存在，
      // 仍要驗證它是否真的嵌在 YouTube 原生操作列，避免 fallback 狀態永久殘留。
      if (force || hrefChanged || supportChanged || buttonMissing || placementInvalid) {
        ns.ui.marker.mount({ platform: "youtube", capture });
      }
    } else if (force || hrefChanged || supportChanged) {
      ns.ui.marker.setVisible(false);
    }

    lastHref = href;
    lastSupported = supported;
  }

  refresh({ force: true });

  // YouTube 也不再監看整棵 document subtree。優先使用官方 SPA 導航事件，
  // 低頻 timer 同時補播放器/操作列較晚建立與 inline placement 失效的情況，避免高頻 DOM mutation 回呼。
  window.addEventListener("yt-navigate-finish", () => refresh({ force: true }), true);
  // 部分 YouTube SPA 版面會先完成導航，稍後才建立 watch metadata / actions。
  // 這兩個頁面事件用來在 action bar 真正重繪後立即再掛一次，不必等 2 秒 fallback timer。
  window.addEventListener("yt-page-data-updated", () => refresh({ force: true }), true);
  window.addEventListener("yt-player-updated", () => refresh({ force: true }), true);
  window.addEventListener("pageshow", () => refresh({ force: true }), { passive: true });
  // Fullscreen 進出時立即把同一顆標記按鈕在頁面操作列與播放器上方標題列右側之間搬移。
  document.addEventListener("fullscreenchange", () => refresh({ force: true }), { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh({ force: true });
  }, { passive: true });

  // Firefox browser zoom and responsive layout changes both surface as resize.
  // Debounce so dragging a window does not continuously remount the button.
  let resizeRefreshTimer = null;
  window.addEventListener("resize", () => {
    if (resizeRefreshTimer !== null) window.clearTimeout(resizeRefreshTimer);
    resizeRefreshTimer = window.setTimeout(() => {
      resizeRefreshTimer = null;
      refresh({ force: true });
    }, 160);
  }, { passive: true });

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === "VTM_GET_CAPTURE_STATE") {
      return Promise.resolve({
        ok: true,
        supported: yt.detector.isSupportedPage()
      });
    }

    if (message?.type === "VTM_ADD_MARKER_FROM_POPUP") {
      if (!yt.detector.isSupportedPage()) return Promise.resolve({ ok: false, reason: "unsupported" });
      return Promise.resolve(ns.ui.marker?.openCapturePanel?.())
        .then((created) => ({ ok: Boolean(created) }));
    }
    return undefined;
  });

  const refreshTimer = window.setInterval(() => refresh(), 2000);
  window.addEventListener("pagehide", () => {
    window.clearInterval(refreshTimer);
    if (resizeRefreshTimer !== null) window.clearTimeout(resizeRefreshTimer);
  }, { once: true });
})();
