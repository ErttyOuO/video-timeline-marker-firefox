(() => {
  const ns = window.__VTM__;
  const twitch = ns.platform.twitch;

  let lastHref = "";
  let lastSupported = null;
  let placementAttempts = 0;
  const MAX_PLACEMENT_ATTEMPTS = 12;

  function capture() {
    const metadata = twitch.metadata.read();
    const timeline = twitch.timeline.capture();
    return {
      platform: "twitch",
      ...metadata,
      ...timeline
    };
  }

  function refresh({ force = false } = {}) {
    const href = location.href;
    const supported = twitch.detector.isSupportedPage();
    const hrefChanged = href !== lastHref;
    const supportChanged = supported !== lastSupported;
    const button = document.getElementById("vtm-mark-button");
    const buttonMissing = supported && !button;
    const buttonNeedsPlacement = supported && button && !ns.ui.marker.isInlinePlacementValid("twitch");

    if (hrefChanged) placementAttempts = 0;

    if (supported) {
      const shouldMount = force
        || hrefChanged
        || supportChanged
        || buttonMissing
        || (buttonNeedsPlacement && placementAttempts < MAX_PLACEMENT_ATTEMPTS);

      if (shouldMount) {
        ns.ui.marker.mount({ platform: "twitch", capture });
        if (buttonNeedsPlacement || !document.getElementById("vtm-mark-button")?.classList.contains("vtm-inline-mounted")) {
          placementAttempts += 1;
        }
      }

      const video = twitch.detector.getVideoElement();
      if (video) twitch.timeline.attach(video);
    } else if (supportChanged || hrefChanged || force) {
      ns.ui.marker.setVisible(false);
      twitch.timeline.detach();
    }

    lastHref = href;
    lastSupported = supported;
  }

  // Twitch 的直播頁與聊天室會非常頻繁地修改 DOM。
  // 不再監看整棵 document subtree，避免每次 chat/player mutation 都重新掛載插件。
  refresh({ force: true });

  // 低頻檢查只負責 SPA 換頁、播放器稍晚建立、追蹤按鈕稍晚上線等情境。
  // 一旦按鈕成功掛到原生列，穩定頁面上幾乎只剩便宜的狀態判斷。
  const refreshTimer = window.setInterval(() => refresh(), 1500);

  window.addEventListener("popstate", () => refresh({ force: true }), { passive: true });
  window.addEventListener("pageshow", () => refresh({ force: true }), { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh({ force: true });
  }, { passive: true });


  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === "VTM_GET_CAPTURE_STATE") {
      return Promise.resolve({
        ok: true,
        supported: twitch.detector.isSupportedPage()
      });
    }

    if (message?.type === "VTM_ADD_MARKER_FROM_POPUP") {
      if (!twitch.detector.isSupportedPage()) return Promise.resolve({ ok: false, reason: "unsupported" });
      return Promise.resolve(ns.ui.marker?.openCapturePanel?.())
        .then((created) => ({ ok: Boolean(created) }));
    }
    return undefined;
  });

  window.addEventListener("pagehide", () => {
    window.clearInterval(refreshTimer);
    twitch.timeline.detach();
  }, { once: true });
})();
