(() => {
  if (window.__VTM_POPUP_CAPTURE_BRIDGE__) return;
  window.__VTM_POPUP_CAPTURE_BRIDGE__ = true;

  function currentPlatform() {
    const host = location.hostname.replace(/^(?:www|m)\./, "");
    if (host === "youtube.com") return "youtube";
    if (host === "twitch.tv") return "twitch";
    return null;
  }

  function getAdapter() {
    const platform = currentPlatform();
    const ns = window.__VTM__;
    const adapter = platform ? ns?.platform?.[platform] : null;
    if (!platform || !adapter?.detector || !adapter?.metadata || !adapter?.timeline) return null;
    return { platform, adapter };
  }

  function isSupported() {
    const current = getAdapter();
    if (!current) return false;
    try {
      return Boolean(current.adapter.detector.isSupportedPage());
    } catch {
      return false;
    }
  }

  function captureCurrent() {
    const current = getAdapter();
    if (!current || !current.adapter.detector.isSupportedPage()) {
      return { ok: false, reason: "unsupported" };
    }

    try {
      return {
        ok: true,
        capture: {
          platform: current.platform,
          ...current.adapter.metadata.read(),
          ...current.adapter.timeline.capture()
        }
      };
    } catch (error) {
      return {
        ok: false,
        reason: "capture_failed",
        message: String(error?.message || error || "capture_failed")
      };
    }
  }

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === "VTM_CAPTURE_BRIDGE_PING") {
      return Promise.resolve({
        ok: true,
        platform: currentPlatform(),
        supported: isSupported()
      });
    }
    if (message?.type === "VTM_CAPTURE_FROM_POPUP") {
      return Promise.resolve(captureCurrent());
    }
    return undefined;
  });
})();
