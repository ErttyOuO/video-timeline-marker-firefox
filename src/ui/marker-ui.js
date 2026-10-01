(() => {
  const ns = window.__VTM__;
  let frozen = null;
  let activeMarkerId = null;
  let captureInProgress = false;
  let currentPlatform = null;
  let currentCapture = null;
  let fadeTimer = null;
  let fadeArmed = false;
  let adjustmentQueue = Promise.resolve();
  let noteSaveTimer = null;
  let pendingNoteSave = null;
  let noteSaveQueue = Promise.resolve();
  let swallowNextPlayerClick = false;
  let swallowClickResetTimer = null;
  let twitchFollowAnchor = null;
  const FADE_DELAY_MS = 2000;
  const NOTE_SAVE_DEBOUNCE_MS = 450;
  const TWITCH_SLOT_ID = "vtm-twitch-button-slot";
  const YOUTUBE_OWNER_SLOT_ID = "vtm-youtube-owner-slot";
  let youtubeNormalStabilityToken = 0;

  const t = (key, substitutions) => ns.core.i18n?.t(key, substitutions) || key;

  function labelAccuracy(value) {
    return ({ exact: t("exact"), calibrated: t("calibrated"), estimated: t("estimated") })[value] || value || t("unknown");
  }

  function markerId() {
    return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function formatClock(value) {
    return ns.core.time.formatClock(value);
  }

  function clearFadeTimer() {
    if (fadeTimer !== null) {
      window.clearTimeout(fadeTimer);
      fadeTimer = null;
    }
  }

  function setPanelFaded(faded) {
    const panel = document.querySelector("#vtm-panel");
    if (!panel) return;
    panel.classList.toggle("vtm-idle-faded", Boolean(faded));
  }

  function wakePanel() {
    clearFadeTimer();
    setPanelFaded(false);
  }

  function schedulePanelFade() {
    clearFadeTimer();
    if (!fadeArmed) return;

    const panel = document.querySelector("#vtm-panel");
    if (!panel?.classList.contains("vtm-open")) return;
    if (panel.matches(":hover")) return;

    fadeTimer = window.setTimeout(() => {
      fadeTimer = null;
      if (!fadeArmed || !panel.classList.contains("vtm-open") || panel.matches(":hover")) return;
      setPanelFaded(true);
    }, FADE_DELAY_MS);
  }

  function resetPanelFade() {
    fadeArmed = false;
    wakePanel();
  }

  function armPanelFadeAfterSave() {
    fadeArmed = true;
    wakePanel();
    schedulePanelFade();
  }

  function setVisible(visible) {
    const root = document.getElementById("vtm-root");
    const button = document.getElementById("vtm-mark-button");
    const fullscreenButton = document.getElementById("vtm-mark-button-fullscreen");
    if (root) root.style.display = visible ? "" : "none";

    for (const candidate of [button, fullscreenButton]) {
      if (!candidate) continue;
      if (!visible) {
        candidate.style.display = "none";
        continue;
      }
      // YouTube / Twitch 都由各自的原生 inline placement 決定按鈕是否顯示。
      if (!candidate.classList.contains("vtm-inline-mounted") && !candidate.classList.contains("vtm-mobile-fab")) candidate.style.display = "none";
    }
  }

  function getYouTubeFullscreenPlayer() {
    const player = document.querySelector("#movie_player");
    const fullscreenElement = document.fullscreenElement;
    if (!player || !fullscreenElement) return null;

    // 只把瀏覽器真正 fullscreen 視為 fullscreen。不要依賴 ytp-fullscreen class，
    // 避免 YouTube 控制列動畫/過渡狀態造成 placement 在 normal/fullscreen 之間反覆切換。
    const containsPlayer = fullscreenElement === player
      || fullscreenElement.contains?.(player)
      || player.contains?.(fullscreenElement);
    return containsPlayer ? player : null;
  }

  function setYouTubeNormalResponsiveMode(button, mode = "full") {
    if (!button) return;
    button.classList.remove("vtm-youtube-compact", "vtm-youtube-micro");
    if (mode === "compact") button.classList.add("vtm-youtube-compact");
    if (mode === "micro") button.classList.add("vtm-youtube-micro");
    button.dataset.vtmResponsiveMode = mode;
  }

  function getYouTubeNormalBoundary(placement) {
    return placement?.actionsBoundary || placement?.menu || placement?.host?.parentElement || null;
  }

  function isYouTubeNormalButtonInsideBoundary(button, placement) {
    const boundary = getYouTubeNormalBoundary(placement);
    if (!button || !isVisibleElement(button) || !isVisibleElement(boundary)) return true;
    const buttonRect = button.getBoundingClientRect();
    const boundaryRect = boundary.getBoundingClientRect();
    // 留 2px tolerance，避免 fractional zoom / DPR 造成誤判。
    return buttonRect.left >= boundaryRect.left - 2 && buttonRect.right <= boundaryRect.right + 2;
  }

  function findFirstVisibleElement(selectors, root = document) {
    for (const selector of selectors) {
      const candidate = root.querySelector(selector);
      if (candidate?.isConnected && isVisibleElement(candidate)) return candidate;
    }
    return null;
  }

  function getYouTubeChannelButtonsPlacement() {
    const owner = document.querySelector("ytd-watch-metadata #owner, #owner");
    if (!owner || !isVisibleElement(owner)) return null;

    // 2026 YouTube 實際 DOM：#subscribe-button 是 #owner 的直接子節點，
    // 並不一定包在 #buttons / #actions / #owner-buttons 中。
    // 因此直接以 #owner 為穩定 host，避免因不存在的中介容器而退回右側 actions row。
    const subscribeSlot = Array.from(owner.children || []).find((child) => child.id === "subscribe-button")
      || owner.querySelector?.("#subscribe-button")
      || null;
    if (!subscribeSlot?.isConnected || !isVisibleElement(subscribeSlot)) return null;

    // 訂閱狀態切換後，同一 renderer 裡可能同時存在多個 button，
    // 只採用目前真正可見的那顆，避免拿到 hidden / invisible button。
    const subscribeButton = Array.from(subscribeSlot.querySelectorAll?.("button") || [])
      .find((candidate) => isVisibleElement(candidate))
      || null;
    if (!subscribeButton) return null;

    let slot = document.getElementById(YOUTUBE_OWNER_SLOT_ID);
    if (!slot) {
      slot = document.createElement("div");
      slot.id = YOUTUBE_OWNER_SLOT_ID;
      slot.className = "vtm-youtube-owner-slot";
    }

    // 永遠貼在 #subscribe-button 後面；SPA 換片或 YouTube 重建 owner 時也會自動移回正確位置。
    const expectedBefore = subscribeSlot.nextSibling;
    if (slot.parentElement !== owner || slot.previousSibling !== subscribeSlot) {
      owner.insertBefore(slot, expectedBefore);
    }

    // 不同帳號 / 頻道（例如有認證徽章）的 #owner 對齊方式不同：有的 align-items:center，
    // 有的是 normal（訂閱鈕貼頂）。這裡直接量測原生訂閱鈕的頂端，把 slot 對齊到同一條線。
    slot.style.alignSelf = "flex-start";
    const currentOffset = parseFloat(slot.style.marginTop) || 0;
    const deltaTop = subscribeButton.getBoundingClientRect().top - slot.getBoundingClientRect().top;
    if (Number.isFinite(deltaTop) && Math.abs(deltaTop) > 0.5) {
      slot.style.marginTop = `${Math.round((currentOffset + deltaTop) * 100) / 100}px`;
    }

    return {
      host: slot,
      before: null,
      referenceButton: subscribeButton,
      mode: "normal",
      placementKind: "youtube-owner",
      menu: null,
      actionsBoundary: owner,
      flexibleHost: null,
      flexibleWasVisible: false
    };
  }

  function getYouTubePlacement() {
    const fullscreenPlayer = getYouTubeFullscreenPlayer();
    if (fullscreenPlayer) {
      // 2026 YouTube fullscreen DOM 已確認有獨立的右上角原生控制區：
      // .ytp-overlay-top-right > .ytp-chrome-top-buttons。
      // 將標記按鈕移到這裡，與上方影片標題同一個 chrome overlay 系統，
      // 不再參與底部 Play/Volume/Time 的盒模型與垂直對齊。
      const host = fullscreenPlayer.querySelector(".ytp-overlay-top-right .ytp-chrome-top-buttons, .ytp-chrome-top-buttons");
      if (!host) return null;

      // append 到原生 top-right buttons 最尾端，視覺上就是影片標題列最右側。
      // 不依賴其中其他按鈕是否因影片狀態而 display:none。
      return { host, before: null, referenceButton: null, mode: "fullscreen", flexibleHost: null };
    }

    // 一般觀看頁優先放在頻道列的「加入 / 訂閱」旁邊，避免被右側讚 / 分享列裁切。
    const channelPlacement = getYouTubeChannelButtonsPlacement();
    if (channelPlacement?.host) return channelPlacement;

    // YouTube 會依帳號、實驗 UI、語言與視窗寬度替換 actions DOM。
    // 2025+ 版面除了傳統 ytd-menu-renderer，也可能出現 button-view-model /
    // yt-flexible-actions-view-model，因此先直接找真正承載按鈕的 host，再回推 menu。
    const hostSelectors = [
      "ytd-watch-metadata #actions #top-level-buttons-computed",
      "ytd-watch-metadata #actions #top-level-buttons",
      "ytd-watch-metadata #top-level-buttons-computed",
      "#actions-inner #top-level-buttons-computed",
      "#actions-inner #top-level-buttons",
      "#actions #top-level-buttons-computed",
      "#actions #top-level-buttons",
      "ytd-watch-metadata #actions yt-flexible-actions-view-model",
      "#actions-inner yt-flexible-actions-view-model"
    ];

    let host = null;
    for (const selector of hostSelectors) {
      const candidate = document.querySelector(selector);
      if (candidate?.isConnected) {
        host = candidate;
        break;
      }
    }

    let menu = host?.closest("ytd-menu-renderer")
      || document.querySelector("ytd-watch-metadata #actions ytd-menu-renderer, ytd-watch-metadata ytd-menu-renderer, #actions-inner ytd-menu-renderer, #menu ytd-menu-renderer");

    // 舊版 / 部分 A/B 版面仍只暴露 menu；保留相容 fallback。
    if (!host && menu) {
      host = menu.querySelector("#top-level-buttons-computed")
        || menu.querySelector("#top-level-buttons")
        || menu.querySelector("yt-flexible-actions-view-model")
        || Array.from(menu.querySelectorAll("div")).find((node) =>
          Array.from(node.children || []).some((child) => child.querySelector?.("button"))
        );
    }

    // 最後備援：Like / Dislike 已經出現但 action host 尚未命中時，從其祖先反推。
    if (!host) {
      const likeControl = document.querySelector([
        "ytd-watch-metadata segmented-like-dislike-button-view-model",
        "ytd-watch-metadata ytd-segmented-like-dislike-button-renderer",
        "#actions segmented-like-dislike-button-view-model",
        "#actions ytd-segmented-like-dislike-button-renderer"
      ].join(","));
      const actionRoot = likeControl?.closest("#actions, #actions-inner, ytd-menu-renderer");
      host = actionRoot?.querySelector?.("#top-level-buttons-computed, #top-level-buttons, yt-flexible-actions-view-model")
        || likeControl?.parentElement
        || null;
      if (!menu) menu = host?.closest?.("ytd-menu-renderer") || null;
    }

    if (!host) return null;

    const flexibleHost = (menu || host).querySelector?.("#flexible-item-buttons") || null;

    let shareButton = null;
    for (const selector of [
      'button[aria-label^="Share"]',
      'button[aria-label*="Share"]',
      'button[aria-label*="分享"]',
      'button[aria-label*="共享"]'
    ]) {
      const candidate = host.querySelector?.(selector);
      if (isVisibleElement(candidate)) {
        shareButton = candidate;
        break;
      }
    }

    // 優先接在分享按鈕後面；分享按鈕尚未渲染時，接在 Like/Dislike 群組後面。
    const likeControl = host.querySelector?.("segmented-like-dislike-button-view-model, ytd-segmented-like-dislike-button-renderer");
    const referenceSlot = shareButton
      ? directChildContaining(host, shareButton)
      : likeControl
        ? (directChildContaining(host, likeControl) || likeControl)
        : Array.from(host.children || []).find((child) => child.querySelector?.("button")) || host.lastElementChild;
    const referenceButton = shareButton
      || likeControl?.querySelector?.("button")
      || referenceSlot?.querySelector?.("button")
      || null;
    const actionsBoundary = host.closest?.("#actions")
      || menu?.closest?.("#actions")
      || host.parentElement;

    return {
      host,
      before: referenceSlot?.parentElement === host ? referenceSlot.nextSibling : null,
      referenceButton,
      mode: "normal",
      menu,
      actionsBoundary,
      flexibleHost,
      flexibleWasVisible: isVisibleElement(flexibleHost)
    };
  }

  function findTwitchFollowButton(root = document) {
    const selector = [
      'button[data-a-target="follow-button"]',
      'button[data-a-target="unfollow-button"]',
      'button[data-test-selector="follow-button"]',
      'button[data-test-selector="unfollow-button"]',
      '[data-a-target="follow-button"] button',
      '[data-a-target="unfollow-button"] button',
      '[data-test-selector="follow-button"] button',
      '[data-test-selector="unfollow-button"] button',
      'button[aria-label*="Unfollow"]',
      'button[aria-label*="unfollow"]',
      'button[aria-label*="Follow"]',
      'button[aria-label*="follow"]',
      'button[aria-label*="取消追蹤"]',
      'button[aria-label*="取消關注"]',
      'button[aria-label*="追蹤"]',
      'button[aria-label*="關注"]'
    ].join(",");

    for (const button of root.querySelectorAll(selector)) {
      if (isVisibleElement(button)) return button;
    }
    return null;
  }

  function isVisibleElement(element) {
    if (!element || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && element.getClientRects().length > 0;
  }

  function getTwitchFollowAnchor() {
    if (isVisibleElement(twitchFollowAnchor)) return twitchFollowAnchor;
    twitchFollowAnchor = findTwitchFollowButton();
    return twitchFollowAnchor;
  }

  function clearButtonInlineMetrics(button) {
    if (!button) return;
    for (const property of [
      "position", "left", "top", "right", "bottom",
      "width", "height", "min-width", "min-height", "max-width", "max-height",
      "border-radius", "font-size", "font-weight"
    ]) {
      button.style.removeProperty(property);
    }
    for (const property of [
      "--vtm-yt-width", "--vtm-yt-height", "--vtm-yt-radius", "--vtm-yt-font-size", "--vtm-yt-font-weight",
      "--vtm-yt-compact-width", "--vtm-yt-micro-width",
      "--vtm-yt-player-width", "--vtm-yt-player-height"
    ]) {
      button.style.removeProperty(property);
    }
  }

  function syncYouTubeButtonMetrics(button, referenceButton) {
    if (!button || !isVisibleElement(referenceButton)) return false;
    const rect = referenceButton.getBoundingClientRect();
    const style = window.getComputedStyle(referenceButton);
    if (rect.width <= 0 || rect.height <= 0) return false;

    const roundedHeight = Math.round(rect.height);
    const compactWidth = Math.max(34, Math.min(44, roundedHeight));
    const microWidth = Math.max(28, Math.min(compactWidth, roundedHeight - 8));

    button.style.setProperty("--vtm-yt-width", `${Math.round(rect.width)}px`);
    button.style.setProperty("--vtm-yt-height", `${roundedHeight}px`);
    button.style.setProperty("--vtm-yt-compact-width", `${compactWidth}px`);
    button.style.setProperty("--vtm-yt-micro-width", `${microWidth}px`);
    button.style.setProperty("--vtm-yt-radius", style.borderRadius || `${Math.round(rect.height / 2)}px`);
    button.style.setProperty("--vtm-yt-font-size", style.fontSize || "14px");
    button.style.setProperty("--vtm-yt-font-weight", style.fontWeight || "500");
    return true;
  }

  function syncYouTubeFullscreenMetrics(button, referenceButton) {
    if (!button || !isVisibleElement(referenceButton)) return false;
    const rect = referenceButton.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    button.style.setProperty("--vtm-yt-player-width", `${Math.round(rect.width)}px`);
    button.style.setProperty("--vtm-yt-player-height", `${Math.round(rect.height)}px`);
    return true;
  }

  function scheduleYouTubeNormalStabilityCheck(button, placement) {
    if (!button || placement?.mode !== "normal") return;
    const token = ++youtubeNormalStabilityToken;
    const flexibleHost = placement.flexibleHost;
    const flexibleWasVisible = placement.flexibleWasVisible;

    const afterLayout = (callback) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(callback));
    };

    const needsCompaction = () => {
      if (token !== youtubeNormalStabilityToken) return false;
      if (!button.classList.contains("vtm-youtube-normal-mounted")) return false;
      const nativeCollapsed = flexibleWasVisible && flexibleHost && !isVisibleElement(flexibleHost);
      const clipped = !isYouTubeNormalButtonInsideBoundary(button, placement);
      return nativeCollapsed || clipped;
    };

    // 不再把整顆 VTM 隱藏。若完整版造成 YouTube responsive actions 收合或被裁切，
    // 先降成 icon-only；仍不足時再降成更窄的 micro icon。
    // 三種模式都保持可點，避免不同瀏覽器縮放比例下按鈕直接消失。
    afterLayout(() => {
      if (!needsCompaction()) return;

      if (!button.classList.contains("vtm-youtube-compact") && !button.classList.contains("vtm-youtube-micro")) {
        setYouTubeNormalResponsiveMode(button, "compact");
        afterLayout(() => {
          if (!needsCompaction()) return;
          setYouTubeNormalResponsiveMode(button, "micro");
        });
        return;
      }

      if (button.classList.contains("vtm-youtube-compact")) {
        setYouTubeNormalResponsiveMode(button, "micro");
      }
    });
  }

  function directChildContaining(parent, descendant) {
    if (!parent || !descendant) return null;
    let node = descendant;
    while (node && node.parentElement !== parent) node = node.parentElement;
    return node?.parentElement === parent ? node : null;
  }

  function lowestCommonAncestor(a, b, boundary) {
    const ancestors = new Set();
    let node = a;
    while (node) {
      ancestors.add(node);
      if (node === boundary) break;
      node = node.parentElement;
    }

    node = b;
    while (node) {
      if (ancestors.has(node)) return node;
      if (node === boundary) break;
      node = node.parentElement;
    }
    return null;
  }

  function findTwitchNotificationButton(root) {
    const selectors = [
      'button[aria-label*="通知"]',
      'button[aria-label*="Notification"]',
      'button[aria-label*="notification"]'
    ];
    for (const selector of selectors) {
      const button = root?.querySelector(selector);
      if (isVisibleElement(button)) return button;
    }
    return null;
  }

  function getTwitchPlacement() {
    const followButton = getTwitchFollowAnchor();
    if (!followButton) return null;

    const header = followButton.closest('[data-target="channel-header-right"], [data-a-target="channel-header-right"]');
    if (!header) return null;

    const notificationButton = findTwitchNotificationButton(header);
    if (notificationButton) {
      const host = lowestCommonAncestor(followButton, notificationButton, header);
      if (host && host !== followButton && host !== notificationButton) {
        const before = directChildContaining(host, followButton);
        const notificationSlot = directChildContaining(host, notificationButton);
        if (before && notificationSlot && before !== notificationSlot) {
          return { host, before, followButton, notificationSlot };
        }
      }
    }

    // A/B 版面備援：只沿 Follow 往上找少量祖先，且必須是水平 flex 並有至少兩個按鈕子槽。
    let child = followButton;
    let parent = child.parentElement;
    for (let depth = 0; parent && depth < 8; depth += 1) {
      if (!header.contains(parent)) break;
      const style = window.getComputedStyle(parent);
      const isHorizontalFlex = (style.display === "flex" || style.display === "inline-flex")
        && style.flexDirection !== "column" && style.flexDirection !== "column-reverse";
      if (isHorizontalFlex) {
        const directChildren = Array.from(parent.children);
        const buttonSlots = directChildren.filter((item) => item.querySelector?.("button"));
        const before = directChildContaining(parent, followButton);
        if (before && buttonSlots.length >= 2) return { host: parent, before, followButton, notificationSlot: null };
      }
      child = parent;
      parent = parent.parentElement;
    }

    return null;
  }

  function ensureTwitchInlineSlot() {
    let slot = document.getElementById(TWITCH_SLOT_ID);
    if (slot) return slot;
    slot = document.createElement("div");
    slot.id = TWITCH_SLOT_ID;
    slot.className = "vtm-twitch-inline-slot";
    return slot;
  }

  function syncTwitchButtonMetrics(button, followButton) {
    if (!button || !isVisibleElement(followButton)) return false;
    const rect = followButton.getBoundingClientRect();
    const style = window.getComputedStyle(followButton);
    if (rect.width <= 0 || rect.height <= 0) return false;

    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (button.style.width !== `${width}px`) button.style.width = `${width}px`;
    if (button.style.height !== `${height}px`) button.style.height = `${height}px`;
    button.style.minWidth = `${width}px`;
    button.style.minHeight = `${height}px`;
    button.style.maxWidth = `${width}px`;
    button.style.maxHeight = `${height}px`;
    button.style.borderRadius = style.borderRadius || `${Math.round(height / 2)}px`;
    return true;
  }

  function mountTwitchButtonInline(button, placement) {
    if (!button || !placement?.host || !placement?.before || !isVisibleElement(placement.followButton)) return false;

    const slot = ensureTwitchInlineSlot();
    if (slot.parentElement !== placement.host || slot.nextSibling !== placement.before) {
      placement.host.insertBefore(slot, placement.before);
    }
    if (button.parentElement !== slot) slot.appendChild(button);

    // 取 Twitch 原生相鄰控制項的實際間距，避免硬編碼 wrapper margin。
    let gap = 8;
    if (placement.notificationSlot && isVisibleElement(placement.before) && isVisibleElement(placement.notificationSlot)) {
      const followSlotRect = placement.before.getBoundingClientRect();
      const nextSlotRect = placement.notificationSlot.getBoundingClientRect();
      const measured = Math.round(nextSlotRect.left - followSlotRect.right);
      if (measured >= 0 && measured <= 24) gap = measured;
    }
    slot.style.marginRight = `${gap}px`;

    button.classList.remove("vtm-fallback-mounted", "vtm-twitch-anchor-mounted", "vtm-youtube-fullscreen-mounted", "vtm-youtube-normal-mounted");
    button.classList.add("vtm-inline-mounted");
    button.style.position = "relative";
    button.style.left = "auto";
    button.style.top = "auto";
    button.style.right = "auto";
    button.style.bottom = "auto";
    button.style.display = "inline-flex";
    return syncTwitchButtonMetrics(button, placement.followButton);
  }

  // ---- Firefox for Android：頁面版面（m.youtube.com / 手機版 Twitch）找不到原生操作列時，
  // 改用固定在畫面右側的浮動按鈕，確保永遠有入口。
  const IS_MOBILE = /Android/i.test(navigator.userAgent);

  function showMobileFab(button) {
    if (!IS_MOBILE) return false;
    if (button.parentElement !== document.documentElement) document.documentElement.appendChild(button);
    clearButtonInlineMetrics(button);
    button.classList.remove("vtm-inline-mounted", "vtm-youtube-fullscreen-mounted", "vtm-youtube-normal-mounted", "ytp-button");
    button.classList.add("vtm-fallback-mounted", "vtm-mobile-fab");
    button.style.display = "inline-flex";
    delete button.dataset.vtmPlacement;
    return true;
  }

  function ensureMarkButton() {
    let button = document.getElementById("vtm-mark-button");
    if (button) return button;

    button = document.createElement("button");
    button.id = "vtm-mark-button";
    button.type = "button";
    button.title = t("markCurrentTime");
    button.setAttribute("aria-label", t("markCurrentTime"));
    button.innerHTML = `
      <span class="vtm-mark-emoji">🔖</span>
      <svg class="vtm-mark-player-icon" viewBox="0 0 24 24" width="24" height="24" focusable="false" aria-hidden="true">
        <path d="M7.25 3.75h9.5c.828 0 1.5.672 1.5 1.5v15l-6.25-3.5-6.25 3.5v-15c0-.828.672-1.5 1.5-1.5Z"></path>
      </svg>
      <span class="vtm-mark-label">${t("mark")}</span>
    `;
    button.addEventListener("pointerdown", (event) => event.stopImmediatePropagation());
    button.addEventListener("click", (event) => {
      event.stopImmediatePropagation();
      void openCapturePanel();
    });
    for (const eventName of ["keydown", "keyup", "keypress"]) {
      button.addEventListener(eventName, (event) => event.stopImmediatePropagation());
    }
    document.documentElement.appendChild(button);
    return button;
  }

  // ---- YouTube 播放器控制列按鈕（一般模式的穩定備援）----
  // 頁面操作列 / 頻道列的 DOM 會隨帳號、A/B 實驗與視窗寬度改變，
  // 但播放器右下角控制列 (.ytp-right-controls) 多年來都很穩定。
  // 因此一般模式永遠在播放器控制列多放一顆原生樣式的標記按鈕，
  // 即使頁面上的按鈕位置暫時找不到，使用者仍然一定看得到入口。
  const PLAYER_BUTTON_ID = "vtm-mark-button-player";

  function getYouTubePlayerControlsHost() {
    const player = document.querySelector("#movie_player");
    if (!player) return null;
    for (const selector of [".ytp-right-controls-left", ".ytp-right-controls"]) {
      const host = player.querySelector(selector);
      if (host?.isConnected) return host;
    }
    return null;
  }

  function ensurePlayerMarkButton() {
    let button = document.getElementById(PLAYER_BUTTON_ID);
    if (button) return button;
    button = document.createElement("button");
    button.id = PLAYER_BUTTON_ID;
    button.type = "button";
    button.className = "ytp-button vtm-player-control-button";
    button.title = t("markCurrentTime");
    button.setAttribute("aria-label", t("markCurrentTime"));
    button.innerHTML = `
      <svg viewBox="0 0 24 24" width="24" height="24" focusable="false" aria-hidden="true">
        <path d="M7.25 3.75h9.5c.828 0 1.5.672 1.5 1.5v15l-6.25-3.5-6.25 3.5v-15c0-.828.672-1.5 1.5-1.5Z"></path>
      </svg>
    `;
    button.addEventListener("pointerdown", (event) => event.stopImmediatePropagation());
    button.addEventListener("click", (event) => {
      event.stopImmediatePropagation();
      void openCapturePanel();
    });
    for (const eventName of ["keydown", "keyup", "keypress"]) {
      button.addEventListener(eventName, (event) => event.stopImmediatePropagation());
    }
    return button;
  }

  function parkPlayerMarkButton() {
    document.getElementById(PLAYER_BUTTON_ID)?.remove();
  }

  function syncPlayerMarkButton() {
    const host = getYouTubePlayerControlsHost();
    if (!host) {
      parkPlayerMarkButton();
      return false;
    }
    const button = ensurePlayerMarkButton();
    if (button.parentElement !== host || host.firstElementChild !== button) {
      host.insertBefore(button, host.firstChild);
    }
    return true;
  }

  function ensureFullscreenMarkButton() {
    let button = document.getElementById("vtm-mark-button-fullscreen");
    if (button) return button;

    button = document.createElement("button");
    button.id = "vtm-mark-button-fullscreen";
    button.type = "button";
    button.title = t("markCurrentTime");
    button.setAttribute("aria-label", t("markCurrentTime"));
    button.className = "vtm-platform-youtube vtm-fullscreen-dormant";
    button.innerHTML = `
      <svg class="vtm-mark-player-icon" viewBox="0 0 24 24" width="24" height="24" focusable="false" aria-hidden="true">
        <path d="M7.25 3.75h9.5c.828 0 1.5.672 1.5 1.5v15l-6.25-3.5-6.25 3.5v-15c0-.828.672-1.5 1.5-1.5Z"></path>
      </svg>
    `;
    button.addEventListener("pointerdown", (event) => event.stopImmediatePropagation());
    button.addEventListener("click", (event) => {
      event.stopImmediatePropagation();
      void openCapturePanel();
    });
    for (const eventName of ["keydown", "keyup", "keypress"]) {
      button.addEventListener(eventName, (event) => event.stopImmediatePropagation());
    }
    parkFullscreenMarkButton(button);
    return button;
  }

  function parkFullscreenMarkButton(button) {
    if (!button) return;
    button.classList.remove("vtm-inline-mounted", "vtm-youtube-fullscreen-mounted");
    button.classList.add("vtm-fullscreen-dormant");
    button.style.display = "none";
    button.hidden = true;
    button.disabled = true;
    button.tabIndex = -1;
    button.setAttribute("aria-hidden", "true");
    delete button.dataset.vtmPlacement;
    if (button.parentElement !== document.documentElement) document.documentElement.appendChild(button);
  }

  function activateFullscreenMarkButton(button, host) {
    if (!button || !host) return false;
    if (button.parentElement !== host) host.appendChild(button);
    button.classList.remove("vtm-fullscreen-dormant");
    button.classList.add("vtm-inline-mounted", "vtm-platform-youtube", "vtm-youtube-fullscreen-mounted");
    button.hidden = false;
    button.disabled = false;
    button.tabIndex = 0;
    button.removeAttribute("aria-hidden");
    button.style.display = "inline-flex";
    button.dataset.vtmPlacement = "youtube-fullscreen-title-right";
    return true;
  }

  function cleanupLegacyYouTubeFullscreenArtifacts() {
    // 開發期間重新載入 temporary extension 時，舊 content-script timer 可能仍存活到分頁重新整理。
    // 新版永遠不允許任何 VTM marker 出現在底部 .ytp-left-controls。
    for (const stale of document.querySelectorAll('#movie_player .ytp-left-controls #vtm-mark-button-fullscreen, #movie_player .ytp-left-controls [data-vtm-placement^="youtube-fullscreen"]')) {
      stale.remove();
    }
  }

  function ensureRoot() {
    let root = document.getElementById("vtm-root");
    if (root) {
      ensureMarkButton();
      ensureFullscreenMarkButton();
      return root;
    }

    root = document.createElement("div");
    root.id = "vtm-root";
    const panelIconUrl = browser.runtime.getURL("icons/icon-32.png");
    root.innerHTML = `
      <div id="vtm-panel" role="dialog" aria-label="${t("markerTitle")}">
        <div class="vtm-panel-header">
          <div class="vtm-panel-brand">
            <img class="vtm-panel-logo" src="${panelIconUrl}" alt="" aria-hidden="true">
            <div class="vtm-panel-title">${t("markerTitle")}</div>
          </div>
          <button id="vtm-close" class="vtm-icon-button" type="button" aria-label="${t("close")}">×</button>
        </div>

        <div class="vtm-panel-tabs" role="tablist" aria-label="${t("markerTitle")}">
          <button id="vtm-tab-capture" class="vtm-tab is-active" type="button" role="tab" aria-selected="true">${t("currentMarker")}</button>
          <button id="vtm-tab-list" class="vtm-tab" type="button" role="tab" aria-selected="false">${t("currentVideoList")}</button>
        </div>

        <section id="vtm-capture-view" class="vtm-view is-active" role="tabpanel">
          <div class="vtm-media-details" aria-hidden="true">
            <div class="vtm-title" id="vtm-title"></div>
            <div class="vtm-meta" id="vtm-meta"></div>
          </div>

          <div class="vtm-time" id="vtm-time"></div>
          <div class="vtm-time-adjust" aria-label="${t("adjustTime")}">
            <button id="vtm-time-minus" type="button">${t("minusFiveSeconds")}</button>
            <button id="vtm-time-plus" type="button">${t("plusFiveSeconds")}</button>
          </div>

          <div class="vtm-save-status" id="vtm-save-status">${t("markerSavedHint")}</div>
          <textarea id="vtm-note" placeholder="${t("notePlaceholder")}"></textarea>
          <div class="vtm-diagnostic" id="vtm-diagnostic"></div>

          <div id="vtm-capture-list" class="vtm-current-list vtm-current-list-preview" aria-label="${t("currentVideoList")}"></div>

          <div class="vtm-actions vtm-actions-footer">
            <button id="vtm-show-list" type="button">${t("viewCurrentList")}</button>
            <button id="vtm-export-current-capture" class="vtm-export-emphasis" type="button">
              <span class="vtm-button-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h5"/></svg>
              </span>
              <span>${t("exportCurrent")}</span>
            </button>
            <button id="vtm-delete-current" type="button" class="vtm-danger-button">${t("deleteCurrentMarker")}</button>
          </div>
        </section>

        <section id="vtm-list-view" class="vtm-view" role="tabpanel">
          <div class="vtm-list-toolbar">
            <div id="vtm-list-summary"></div>
            <div class="vtm-list-toolbar-actions">
              <button id="vtm-export-current" class="vtm-export-emphasis" type="button">${t("exportCurrent")}</button>
              <button id="vtm-refresh-list" type="button">${t("refresh")}</button>
            </div>
          </div>
          <div id="vtm-current-list" class="vtm-current-list"></div>
        </section>
      </div>
    `;
    document.documentElement.appendChild(root);

    const button = ensureMarkButton();
    ensureFullscreenMarkButton();
    root.querySelector("#vtm-close").addEventListener("click", closePanel);
    root.querySelector("#vtm-tab-capture").addEventListener("click", () => switchView("capture"));
    root.querySelector("#vtm-tab-list").addEventListener("click", () => switchView("list"));
    root.querySelector("#vtm-show-list").addEventListener("click", () => switchView("list"));
    root.querySelector("#vtm-refresh-list").addEventListener("click", () => renderCurrentList());
    root.querySelector("#vtm-export-current").addEventListener("click", () => exportCurrentMarkers());
    root.querySelector("#vtm-export-current-capture").addEventListener("click", () => exportCurrentMarkers());
    root.querySelector("#vtm-time-minus").addEventListener("click", () => queueCurrentMarkerTimeAdjustment(-5));
    root.querySelector("#vtm-time-plus").addEventListener("click", () => queueCurrentMarkerTimeAdjustment(5));
    root.querySelector("#vtm-delete-current").addEventListener("click", deleteCurrentMarker);

    const panel = root.querySelector("#vtm-panel");
    const note = root.querySelector("#vtm-note");

    // Fullscreen 時 root 會放進 #movie_player；所有 VTM 指標 / 點擊事件都在面板邊界截斷，
    // 避免點按輸入框、按鈕或空白處時一路冒泡到 YouTube player 而觸發播放/暫停等操作。
    for (const eventName of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick"]) {
      panel.addEventListener(eventName, (event) => event.stopPropagation());
    }
    panel.addEventListener("pointerenter", () => {
      if (!fadeArmed) return;
      wakePanel();
    });
    panel.addEventListener("pointerleave", () => {
      if (!fadeArmed) return;
      schedulePanelFade();
    });
    note.addEventListener("input", () => {
      wakePanel();
      queueNoteAutoSave(note.value);
      schedulePanelFade();
    });
    note.addEventListener("focus", () => {
      wakePanel();
      schedulePanelFade();
    });
    note.addEventListener("blur", () => {
      void flushPendingNoteSave();
      schedulePanelFade();
    });
    note.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;

      // 中文／日文等 IME 正在組字時，Enter 只負責確認候選字，不能誤關面板。
      if (event.isComposing || event.keyCode === 229) return;

      // Shift+Enter 明確保留換行；一般 Enter = 確認目前備註、儲存並關閉 UI。
      if (event.shiftKey) {
        event.stopImmediatePropagation();
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      queueNoteAutoSave(note.value);
      void flushPendingNoteSave().finally(() => closePanel());
    });

    // 點面板外就關閉。若這一下是點在影片畫面本身，只消失面板，
    // 並吞掉同一次 player click，避免關閉 UI 的同時把影片暫停/繼續播放切換。
    document.addEventListener("pointerdown", (event) => {
      const panel = root.querySelector("#vtm-panel");
      const markButton = document.getElementById("vtm-mark-button");
      const fullscreenMarkButton = document.getElementById("vtm-mark-button-fullscreen");
      if (!panel.classList.contains("vtm-open")) return;
      if (panel.contains(event.target) || markButton?.contains(event.target) || fullscreenMarkButton?.contains(event.target)) return;

      const swallowPlayerClick = isPlayerSurfaceClick(event.target);
      if (swallowPlayerClick) {
        swallowNextPlayerClick = true;
        if (swallowClickResetTimer !== null) window.clearTimeout(swallowClickResetTimer);
        swallowClickResetTimer = window.setTimeout(() => {
          swallowNextPlayerClick = false;
          swallowClickResetTimer = null;
        }, 500);
        event.preventDefault();
        event.stopPropagation();
      }
      closePanel();
    }, true);

    document.addEventListener("click", (event) => {
      if (!swallowNextPlayerClick) return;
      swallowNextPlayerClick = false;
      if (swallowClickResetTimer !== null) {
        window.clearTimeout(swallowClickResetTimer);
        swallowClickResetTimer = null;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    // VTM 面板自己的鍵盤事件在面板 bubble 階段截斷：
    // 先讓 textarea / 按鈕自己的 handler 正常執行，再阻止事件冒泡到 YouTube。
    // 這樣不會因 document capture 過早 stopPropagation 而吃掉 Enter 儲存等插件功能。
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closePanel();
        return;
      }

      // 當標記面板開啟時，+ / - 直接微調目前標記 5 秒。
      // IME 組字期間與 Ctrl/Alt/Meta 系統快捷鍵不攔截。
      if (panel.classList.contains("vtm-open") && activeMarkerId
          && !event.isComposing && event.keyCode !== 229
          && !event.ctrlKey && !event.altKey && !event.metaKey && !event.repeat) {
        const isPlus = event.key === "+" || event.code === "NumpadAdd";
        const isMinus = event.key === "-" || event.code === "NumpadSubtract";
        if (isPlus || isMinus) {
          event.preventDefault();
          event.stopImmediatePropagation();
          wakePanel();
          queueCurrentMarkerTimeAdjustment(isPlus ? 5 : -5);
          return;
        }
      }

      // j/k/l、方向鍵、數字鍵、空白等只留在 VTM UI，不讓 YouTube player 收到。
      event.stopImmediatePropagation();
    });

    for (const eventName of ["keyup", "keypress"]) {
      panel.addEventListener(eventName, (event) => {
        event.stopImmediatePropagation();
      });
    }

    window.addEventListener("resize", () => {
      const panel = root.querySelector("#vtm-panel");
      if (panel.classList.contains("vtm-open")) positionPanel();
    }, { passive: true });

    return root;
  }

  function moveRoot(root, platform) {
    const button = ensureMarkButton();
    const fullscreenButton = ensureFullscreenMarkButton();
    cleanupLegacyYouTubeFullscreenArtifacts();

    root.classList.toggle("vtm-platform-youtube", platform === "youtube");
    root.classList.toggle("vtm-platform-twitch", platform === "twitch");
    button.classList.toggle("vtm-platform-youtube", platform === "youtube");
    button.classList.toggle("vtm-platform-twitch", platform === "twitch");

    if (platform === "twitch") {
      parkFullscreenMarkButton(fullscreenButton);
      parkPlayerMarkButton();

      const placement = getTwitchPlacement();
      button.classList.remove("vtm-fallback-mounted", "vtm-twitch-anchor-mounted", "ytp-button");
      if (placement && mountTwitchButtonInline(button, placement)) return;

      const staleSlot = document.getElementById(TWITCH_SLOT_ID);
      if (staleSlot?.contains(button)) document.documentElement.appendChild(button);
      staleSlot?.remove();
      clearButtonInlineMetrics(button);
      button.classList.remove("vtm-inline-mounted");
      if (showMobileFab(button)) return;
      button.style.display = "none";
      return;
    }

    twitchFollowAnchor = null;
    const twitchSlot = document.getElementById(TWITCH_SLOT_ID);
    if (twitchSlot?.contains(button)) document.documentElement.appendChild(button);
    twitchSlot?.remove();
    button.classList.remove("vtm-twitch-anchor-mounted");
    clearButtonInlineMetrics(button);

    // 全螢幕時使用右上角專用按鈕；其他模式一律在播放器控制列放一顆穩定入口。
    if (getYouTubeFullscreenPlayer()) parkPlayerMarkButton();
    else syncPlayerMarkButton();

    const placement = getYouTubePlacement();
    if (placement?.host) {
      if (placement.mode === "fullscreen") {
        const fullscreenPlayer = getYouTubeFullscreenPlayer();
        if (fullscreenPlayer && root.parentElement !== fullscreenPlayer) fullscreenPlayer.appendChild(root);

        // Normal/page button is explicitly parked outside the fullscreen player and hidden.
        // This prevents any legacy lower-left placement from remaining visible.
        if (button.parentElement !== document.documentElement) document.documentElement.appendChild(button);
        button.classList.remove("vtm-inline-mounted", "vtm-youtube-fullscreen-mounted", "vtm-youtube-normal-mounted", "ytp-button");
        button.style.display = "none";
        delete button.dataset.vtmPlacement;

        activateFullscreenMarkButton(fullscreenButton, placement.host);
        youtubeNormalStabilityToken += 1;
        cleanupLegacyYouTubeFullscreenArtifacts();
        return;
      }

      // Normal mode: remove/park the dedicated fullscreen button and use the regular YouTube action button.
      parkFullscreenMarkButton(fullscreenButton);
      if (root.parentElement !== document.documentElement) document.documentElement.appendChild(root);

      if (placement.before && placement.before.parentElement === placement.host) {
        if (button.parentElement !== placement.host || button.nextSibling !== placement.before) {
          placement.host.insertBefore(button, placement.before);
        }
      } else if (button.parentElement !== placement.host) {
        placement.host.appendChild(button);
      }
      button.style.display = "inline-flex";
      button.dataset.vtmPlacement = "youtube-normal";
      button.classList.add("vtm-inline-mounted", "vtm-youtube-normal-mounted");
      button.classList.remove("vtm-fallback-mounted", "vtm-youtube-fullscreen-mounted", "ytp-button");
      setYouTubeNormalResponsiveMode(button, "full");
      syncYouTubeButtonMetrics(button, placement.referenceButton);
      scheduleYouTubeNormalStabilityCheck(button, placement);
      return;
    }

    if (root.parentElement !== document.documentElement) document.documentElement.appendChild(root);
    if (button.parentElement !== document.documentElement) document.documentElement.appendChild(button);
    clearButtonInlineMetrics(button);
    button.classList.remove("vtm-inline-mounted", "vtm-fallback-mounted", "vtm-youtube-fullscreen-mounted", "vtm-youtube-normal-mounted", "ytp-button");
    if (!showMobileFab(button)) button.style.display = "none";
    parkFullscreenMarkButton(fullscreenButton);
  }

  function refreshPlacement(platform = currentPlatform) {
    if (!platform) return false;
    const root = ensureRoot();
    moveRoot(root, platform);
    return isInlinePlacementValid(platform);
  }

  function getVisibleVideoRect() {
    const selectors = currentPlatform === "youtube"
      ? ["video.html5-main-video", "#movie_player video", "video"]
      : ["video", '[data-a-target="video-player"] video'];

    for (const selector of selectors) {
      const video = document.querySelector(selector);
      if (!video) continue;
      const rect = video.getBoundingClientRect();
      const intersectsViewport = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
      if (intersectsViewport && rect.width >= 320 && rect.height >= 180) return rect;
    }
    return null;
  }

  function positionPanel() {
    const root = ensureRoot();
    const panel = root.querySelector("#vtm-panel");
    const fullscreenButton = document.getElementById("vtm-mark-button-fullscreen");
    const normalButton = document.getElementById("vtm-mark-button");
    const button = getYouTubeFullscreenPlayer() && fullscreenButton?.classList.contains("vtm-inline-mounted")
      ? fullscreenButton
      : normalButton;
    if (!button || !panel.classList.contains("vtm-open")) return;

    const margin = 12;
    const gap = 10;
    const overlayInset = 16;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    const buttonRect = button.getBoundingClientRect();

    panel.style.visibility = "hidden";
    panel.style.left = `${margin}px`;
    panel.style.top = `${margin}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";

    const panelRect = panel.getBoundingClientRect();
    const panelWidth = Math.min(panelRect.width, Math.max(0, viewportWidth - margin * 2));
    const panelHeight = Math.min(panelRect.height, Math.max(0, viewportHeight - margin * 2));
    const videoRect = getVisibleVideoRect();

    let left;
    let top;

    if (videoRect) {
      // 優先直接覆蓋在目前可見的影片右上角，不參與網頁排版。
      left = videoRect.right - panelWidth - overlayInset;
      top = videoRect.top + overlayInset;
    } else {
      // 若影片已捲離可視範圍，再以按鈕為定位備援，同樣使用 fixed overlay。
      left = buttonRect.right - panelWidth;
      const roomAbove = buttonRect.top - margin;
      const openAbove = roomAbove >= panelHeight + gap;
      top = openAbove
        ? buttonRect.top - panelHeight - gap
        : buttonRect.bottom + gap;
    }

    left = Math.max(margin, Math.min(left, viewportWidth - panelWidth - margin));
    top = Math.max(margin, Math.min(top, viewportHeight - panelHeight - margin));

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.visibility = "visible";
  }

  function updateTabState(mode) {
    const root = ensureRoot();
    const captureTab = root.querySelector("#vtm-tab-capture");
    const listTab = root.querySelector("#vtm-tab-list");
    captureTab.classList.toggle("is-active", mode === "capture");
    listTab.classList.toggle("is-active", mode === "list");
    captureTab.setAttribute("aria-selected", mode === "capture" ? "true" : "false");
    listTab.setAttribute("aria-selected", mode === "list" ? "true" : "false");
    root.querySelector("#vtm-capture-view").classList.toggle("is-active", mode === "capture");
    root.querySelector("#vtm-list-view").classList.toggle("is-active", mode === "list");
  }

  function currentMediaKey(source) {
    if (!source) return null;
    return `${source.platform || currentPlatform}:${source.mediaId || source.canonicalUrl || source.originalUrl || "unknown"}`;
  }

  function markerTimelineSecondsForSort(marker) {
    const value = marker?.vodResolution?.resolvedPositionSeconds ?? marker?.positionSeconds ?? marker?.timeline?.playerCurrentTime;
    const seconds = Number(value);
    return Number.isFinite(seconds) ? Math.max(0, seconds) : null;
  }

  function compareMarkersByTimelineAsc(a, b) {
    const aSeconds = markerTimelineSecondsForSort(a);
    const bSeconds = markerTimelineSecondsForSort(b);
    if (aSeconds !== null && bSeconds !== null && aSeconds !== bSeconds) return aSeconds - bSeconds;
    if (aSeconds !== null && bSeconds === null) return -1;
    if (aSeconds === null && bSeconds !== null) return 1;
    return new Date(a?.capturedAt || 0) - new Date(b?.capturedAt || 0);
  }

  async function getMarkersForCurrent() {
    const key = currentMediaKey(frozen);
    const markers = await ns.core.store.getAll();
    if (!key) return [];
    return markers
      .filter((marker) => currentMediaKey(marker) === key)
      .sort(compareMarkersByTimelineAsc);
  }

  function listActionIcon(action) {
    if (action === "open") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8"/><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`;
    }
    if (action === "edit") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4.4-1 9.8-9.8a2.1 2.1 0 0 0-3-3L5.4 16 4 20Z"/><path d="m13.8 7.6 2.6 2.6"/></svg>`;
    }
    if (action === "export") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M5 19h14"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m7 7 1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></svg>`;
  }

  function markerPreviewWindow(markers) {
    if (markers.length <= 3) return markers;
    const activeIndex = markers.findIndex((marker) => marker.id === activeMarkerId);
    if (activeIndex < 0) return markers.slice(-3);
    const start = Math.max(0, Math.min(activeIndex - 1, markers.length - 3));
    return markers.slice(start, start + 3);
  }

  function createMarkerListItem(marker, compact = false) {
    const item = document.createElement("article");
    item.className = `vtm-list-item${compact ? " vtm-list-item-compact" : ""}${marker.id === activeMarkerId ? " is-current" : ""}`;
    const seconds = marker.vodResolution?.resolvedPositionSeconds ?? marker.positionSeconds ?? marker.timeline?.playerCurrentTime;
    const note = marker.note || t("noNote");

    const actionButtons = compact
      ? `
          <button type="button" class="vtm-row-icon" data-action="edit" aria-label="${t("edit")}">${listActionIcon("edit")}</button>
          <button type="button" class="vtm-row-icon danger" data-action="delete" aria-label="${t("delete")}">${listActionIcon("delete")}</button>
        `
      : `
          <button type="button" class="vtm-row-icon" data-action="open" aria-label="${t("open")}">${listActionIcon("open")}</button>
          <button type="button" class="vtm-row-icon" data-action="edit" aria-label="${t("edit")}">${listActionIcon("edit")}</button>
          <button type="button" class="vtm-row-icon" data-action="export" aria-label="${t("export")}">${listActionIcon("export")}</button>
          <button type="button" class="vtm-row-icon danger" data-action="delete" aria-label="${t("delete")}">${listActionIcon("delete")}</button>
        `;

    item.innerHTML = `
      <div class="vtm-list-rail" aria-hidden="true"><i></i></div>
      <div class="vtm-list-time">${formatClock(seconds)}</div>
      <div class="vtm-list-badge">${labelAccuracy(marker.accuracy)}</div>
      <div class="vtm-list-note" title="${escapeHtml(note)}">${escapeHtml(note)}</div>
      <div class="vtm-list-actions">${actionButtons}</div>
    `;

    const openButton = item.querySelector('[data-action="open"]');
    if (openButton) {
      openButton.addEventListener("click", () => {
        const url = markerUrl(marker);
        if (url) window.open(url, "_blank", "noopener");
      });
    }

    item.querySelector('[data-action="edit"]').addEventListener("click", async () => {
      const next = window.prompt(t("editNote"), marker.note || "");
      if (next === null) return;
      const updated = await ns.core.store.update(marker.id, { note: next.trim() });
      if (updated && frozen?.id === marker.id) {
        frozen = updated;
        const noteField = ensureRoot().querySelector("#vtm-note");
        if (noteField && document.activeElement !== noteField) noteField.value = updated.note || "";
      }
      await renderCurrentList();
    });

    const exportButton = item.querySelector('[data-action="export"]');
    if (exportButton) {
      exportButton.addEventListener("click", () => {
        browser.runtime.sendMessage({ type: "VTM_EXPORT", markerIds: [marker.id] });
      });
    }

    item.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!(await confirmDeleteMarker())) return;
      await ns.core.store.remove(marker.id);
      if (marker.id === activeMarkerId) {
        activeMarkerId = null;
        setCurrentMarkerControlsEnabled(false);
      }
      await renderCurrentList();
    });

    return item;
  }

  function renderCapturePreviewFromMarkers(markers) {
    const root = ensureRoot();
    const preview = root.querySelector("#vtm-capture-list");
    if (!preview) return;
    preview.replaceChildren();

    const selected = markerPreviewWindow(markers);
    if (!selected.length) {
      preview.hidden = true;
      return;
    }

    preview.hidden = false;
    for (const marker of selected) {
      preview.appendChild(createMarkerListItem(marker, true));
    }
  }

  async function renderCapturePreview() {
    const markers = await getMarkersForCurrent();
    renderCapturePreviewFromMarkers(markers);
  }

  async function renderCurrentList() {
    const root = ensureRoot();
    const container = root.querySelector("#vtm-current-list");
    const summary = root.querySelector("#vtm-list-summary");
    const markers = await getMarkersForCurrent();

    renderCapturePreviewFromMarkers(markers);
    container.replaceChildren();
    summary.textContent = t("currentVideoCount", [String(markers.length)]);

    if (!markers.length) {
      const empty = document.createElement("div");
      empty.className = "vtm-list-empty";
      empty.textContent = t("noMarkersCurrent");
      container.appendChild(empty);
      return;
    }

    for (const marker of markers) {
      container.appendChild(createMarkerListItem(marker, false));
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function twitchTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h ? `${h}h` : ""}${m || h ? `${m}m` : ""}${s}s`;
  }

  function markerUrl(marker) {
    const seconds = marker.vodResolution?.resolvedPositionSeconds ?? marker.positionSeconds ?? marker.timeline?.playerCurrentTime;
    if (marker.platform === "youtube" && marker.mediaId && Number.isFinite(Number(seconds))) {
      return `https://www.youtube.com/watch?v=${encodeURIComponent(marker.mediaId)}&t=${Math.floor(Number(seconds))}s`;
    }
    if (marker.platform === "twitch") {
      const vodId = marker.vodResolution?.vodId || (marker.mediaType === "vod" ? marker.mediaId : null);
      if (vodId && Number.isFinite(Number(seconds))) {
        return `https://www.twitch.tv/videos/${vodId}?t=${twitchTime(seconds)}`;
      }
    }
    return marker.canonicalUrl || marker.originalUrl || null;
  }

  async function exportCurrentMarkers() {
    const markers = await getMarkersForCurrent();
    if (!markers.length) {
      window.alert(t("noMarkersExport"));
      return;
    }
    await browser.runtime.sendMessage({ type: "VTM_EXPORT", markerIds: markers.map((m) => m.id) });
  }

  function updateCaptureTimeDisplay() {
    const root = ensureRoot();
    const displaySeconds = frozen?.positionSeconds ?? frozen?.timeline?.playerCurrentTime;
    root.querySelector("#vtm-time").innerHTML = `${formatClock(displaySeconds)} <span class="vtm-badge">${labelAccuracy(frozen?.accuracy)}</span>`;
  }

  function fillCaptureView() {
    const root = ensureRoot();
    const note = root.querySelector("#vtm-note");
    root.querySelector("#vtm-title").textContent = frozen?.title || t("unnamedVideo");
    root.querySelector("#vtm-meta").textContent = `${(currentPlatform || frozen?.platform || "").toUpperCase()} · ${frozen?.creatorName || t("unknownChannel")} · ${frozen?.mediaType || ""}`;
    updateCaptureTimeDisplay();

    const diag = frozen?.timeline || {};
    const diagnosticNode = root.querySelector("#vtm-diagnostic");
    const showLiveDiagnostic = currentPlatform === "twitch" && frozen?.mediaType === "live";
    diagnosticNode.classList.toggle("is-visible", showLiveDiagnostic);
    diagnosticNode.textContent = showLiveDiagnostic
      ? (diag.liveElapsed !== null && diag.liveElapsed !== undefined
          ? t("liveTimerSource", [
              diag.source || t("twitchPage"),
              diag.displayedLiveTime || formatClock(diag.liveElapsed),
              frozen?.diagnostics?.paused ? t("pausedSuffix") : ""
            ])
          : t("twitchNoReliableTime"))
      : "";
    note.value = frozen?.note || "";
  }

  function openPanel() {
    const root = ensureRoot();
    const panel = root.querySelector("#vtm-panel");
    wakePanel();
    panel.classList.add("vtm-open");
    positionPanel();
  }

  function closePanel() {
    const root = document.getElementById("vtm-root");
    if (!root) return;
    resetPanelFade();
    root.querySelector("#vtm-panel").classList.remove("vtm-open");
    void flushPendingNoteSave();
  }

  async function switchView(mode) {
    if (mode === "list") await flushPendingNoteSave();
    updateTabState(mode);
    if (mode === "list") await renderCurrentList();
    requestAnimationFrame(positionPanel);
  }

  async function openCapturePanel() {
    if (captureInProgress) return false;
    captureInProgress = true;
    try {
      if (!currentCapture) return false;
      await flushPendingNoteSave();
      resetPanelFade();
      frozen = currentCapture();
      if (!frozen) return false;

      const marker = {
        ...frozen,
        id: markerId(),
        capturedAt: new Date().toISOString(),
        note: "",
        vodResolution: frozen.mediaType === "live" && currentPlatform === "twitch"
          ? { status: "pending", vodId: null, vodUrl: null, resolvedPositionSeconds: null }
          : { status: "not_needed", vodId: null, vodUrl: null, resolvedPositionSeconds: null }
      };

      // 點下標記按鈕的瞬間就先保存。後續 UI 僅負責補充／更新備註。
      await ns.core.store.add(marker);
      activeMarkerId = marker.id;
      frozen = marker;
      setCurrentMarkerControlsEnabled(true);

      const scrollXBefore = window.scrollX;
      const scrollYBefore = window.scrollY;
      fillCaptureView();
      openPanel();
      await switchView("capture");
      await renderCurrentList();

      // UI 打開後直接把輸入焦點放到備註欄；preventScroll 避免 Firefox 為了 focus 拉動畫面。
      requestAnimationFrame(() => {
        if (window.scrollX !== scrollXBefore || window.scrollY !== scrollYBefore) {
          window.scrollTo(scrollXBefore, scrollYBefore);
        }
        positionPanel();
        const note = ensureRoot().querySelector("#vtm-note");
        try {
          note.focus({ preventScroll: true });
        } catch {
          note.focus();
        }
        try {
          note.setSelectionRange(note.value.length, note.value.length);
        } catch {}
      });

      // 標記已經完成。focus / input 會重新安排 2 秒 idle fade；滑鼠 hover 面板時不淡出。
      armPanelFadeAfterSave();
      return true;
    } catch (error) {
      console.error("[VTM] capture failed", error);
      window.alert(t("captureFailed", [String(error.message || error)]));
      return false;
    } finally {
      captureInProgress = false;
    }
  }

  function markerPositionSeconds(marker) {
    const value = marker?.vodResolution?.resolvedPositionSeconds ?? marker?.positionSeconds ?? marker?.timeline?.playerCurrentTime;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function clampAdjustedSeconds(value, marker) {
    let next = Math.max(0, Number(value) || 0);
    const duration = Number(marker?.timeline?.duration);
    if (Number.isFinite(duration) && duration >= 0) next = Math.min(next, duration);
    return next;
  }

  function setCurrentMarkerControlsEnabled(enabled) {
    const root = document.getElementById("vtm-root");
    if (!root) return;
    for (const selector of ["#vtm-time-minus", "#vtm-time-plus", "#vtm-delete-current"]) {
      const control = root.querySelector(selector);
      if (control) control.disabled = !enabled;
    }
  }

  function queueCurrentMarkerTimeAdjustment(deltaSeconds) {
    adjustmentQueue = adjustmentQueue
      .then(() => adjustCurrentMarkerTime(deltaSeconds))
      .catch((error) => console.error("[VTM] marker time adjustment failed", error));
  }

  async function adjustCurrentMarkerTime(deltaSeconds) {
    if (!activeMarkerId || !frozen) return;
    await flushPendingNoteSave();
    const current = markerPositionSeconds(frozen);
    if (current === null) return;

    const next = clampAdjustedSeconds(current + Number(deltaSeconds || 0), frozen);
    const timeline = {
      ...(frozen.timeline || {}),
      // 保留原始 playerCurrentTime 作為 capture diagnostics；手動微調只改最終標記位置。
      estimatedVodPosition: next,
      manualAdjustmentSeconds: Number(frozen.timeline?.manualAdjustmentSeconds || 0) + (next - current)
    };
    const patch = {
      positionSeconds: next,
      timeline
    };
    if (frozen.vodResolution?.resolvedPositionSeconds !== null && frozen.vodResolution?.resolvedPositionSeconds !== undefined) {
      patch.vodResolution = { ...frozen.vodResolution, resolvedPositionSeconds: next };
    }
    const updated = await ns.core.store.update(activeMarkerId, patch);
    if (!updated) return;

    frozen = updated;
    updateCaptureTimeDisplay();
    await renderCurrentList();
    armPanelFadeAfterSave();
  }

  // 自訂刪除確認視窗：1 秒內滑鼠沒有在視窗內移動就自動確定刪除；
  // 在視窗內移動滑鼠即暫停倒數，交給使用者決定刪除或保留。
  async function confirmDeleteMarker() {
    const dialog = globalThis.__VTM_CONFIRM__?.confirmDialog;
    if (!dialog) return window.confirm(t("confirmDelete"));
    return dialog({
      title: t("confirmDeleteTitle"),
      message: t("confirmDelete"),
      confirmLabel: t("delete"),
      cancelLabel: t("confirmKeep"),
      autoConfirmMs: 1000,
      hintAuto: t("confirmAutoHint"),
      hintPaused: t("confirmPausedHint"),
      host: ensureRoot()
    });
  }

  async function deleteCurrentMarker() {
    if (!activeMarkerId) return;
    if (!(await confirmDeleteMarker())) return;
    await flushPendingNoteSave();
    await ns.core.store.remove(activeMarkerId);
    activeMarkerId = null;
    setCurrentMarkerControlsEnabled(false);
    await renderCurrentList();
    await switchView("list");
    armPanelFadeAfterSave();
  }

  function clearNoteSaveTimer() {
    if (noteSaveTimer !== null) {
      window.clearTimeout(noteSaveTimer);
      noteSaveTimer = null;
    }
  }

  function queueNoteAutoSave(value) {
    if (!activeMarkerId) return;
    clearNoteSaveTimer();
    pendingNoteSave = {
      markerId: activeMarkerId,
      note: String(value ?? "")
    };
    noteSaveTimer = window.setTimeout(() => {
      noteSaveTimer = null;
      void flushPendingNoteSave();
    }, NOTE_SAVE_DEBOUNCE_MS);
  }

  function flushPendingNoteSave() {
    clearNoteSaveTimer();
    const pending = pendingNoteSave;
    if (!pending) return noteSaveQueue;
    pendingNoteSave = null;

    noteSaveQueue = noteSaveQueue
      .then(async () => {
        const updated = await ns.core.store.update(pending.markerId, { note: pending.note.trim() });
        if (updated && frozen?.id === pending.markerId) frozen = updated;
        if (updated) void renderCapturePreview();
        return updated;
      })
      .catch((error) => {
        console.error("[VTM] note auto-save failed", error);
        return null;
      });
    return noteSaveQueue;
  }

  function isInteractiveControl(target) {
    return Boolean(target?.closest?.('button, a, input, textarea, select, [role="button"], [contenteditable="true"], .ytp-button, .ytp-chrome-controls, .ytp-progress-bar-container, .ytp-popup'));
  }

  function isPlayerSurfaceClick(target) {
    if (!(target instanceof Element)) return false;
    if (isInteractiveControl(target)) return false;

    if (currentPlatform === "youtube") {
      const player = target.closest("#movie_player, .html5-video-player");
      return Boolean(player);
    }

    if (currentPlatform === "twitch") {
      const player = target.closest('[data-a-target="video-player"], .video-player, .video-player__container, video');
      return Boolean(player);
    }

    return false;
  }

  function isInlinePlacementValid(platform) {
    const button = document.getElementById("vtm-mark-button");
    if (!button) return false;

    // 手機浮動按鈕：只要頁面上仍找不到原生位置，就視為有效，避免每 2 秒重掛。
    if (IS_MOBILE && button.classList.contains("vtm-mobile-fab") && isVisibleElement(button)) {
      const nativePlacement = platform === "twitch" ? getTwitchPlacement() : getYouTubePlacement()?.host;
      if (!nativePlacement) return true;
    }

    if (platform === "twitch") {
      const slot = document.getElementById(TWITCH_SLOT_ID);
      const followButton = getTwitchFollowAnchor();
      if (slot?.isConnected && button.parentElement === slot && isVisibleElement(followButton)) {
        // 穩定狀態只同步原生 Follow 尺寸；位置本身完全交給 Twitch 的原生 layout。
        return syncTwitchButtonMetrics(button, followButton);
      }
      const placement = getTwitchPlacement();
      return placement ? mountTwitchButtonInline(button, placement) : false;
    }

    if (!getYouTubeFullscreenPlayer()) {
      const playerHost = getYouTubePlayerControlsHost();
      const playerButton = document.getElementById(PLAYER_BUTTON_ID);
      if (playerHost && (!playerButton || playerButton.parentElement !== playerHost)) return false;
    }

    const placement = getYouTubePlacement();
    if (!placement?.host) return false;

    if (placement.mode === "fullscreen") {
      const fullscreenButton = document.getElementById("vtm-mark-button-fullscreen");
      if (!fullscreenButton || fullscreenButton.parentElement !== placement.host) return false;
      const rect = fullscreenButton.getBoundingClientRect();
      return fullscreenButton.classList.contains("vtm-inline-mounted")
        && fullscreenButton.dataset.vtmPlacement === "youtube-fullscreen-title-right"
        && rect.width > 0 && rect.height > 0;
    }

    if (!button.classList.contains("vtm-inline-mounted") || button.parentElement !== placement.host) return false;
    button.classList.remove("ytp-button");
    syncYouTubeButtonMetrics(button, placement.referenceButton);
    return button.classList.contains("vtm-youtube-normal-mounted") && isVisibleElement(button);
  }

  function mount({ platform, capture }) {
    currentPlatform = platform;
    currentCapture = capture;
    const root = ensureRoot();
    moveRoot(root, platform);
    setVisible(true);
  }

  ns.ui.marker = { mount, setVisible, isInlinePlacementValid, refreshPlacement, openCapturePanel };
})();
