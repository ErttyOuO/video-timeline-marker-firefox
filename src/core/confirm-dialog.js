(() => {
  // 共用的自訂確認視窗（取代瀏覽器內建 window.confirm）。
  // content script 與 popup 皆可使用：不依賴 window.__VTM__，文字由呼叫端傳入。
  //
  // 自動確認模式 (autoConfirmMs > 0)：
  //   - 視窗出現後開始倒數；期間滑鼠沒有在視窗內移動，倒數結束即視為「確定」。
  //   - 滑鼠在視窗內移動（超過門檻）或按下任何非 Enter/Esc 的按鍵，倒數立即取消，交給使用者決定。
  //   - 滑鼠在視窗外移動不影響倒數。
  const AUTO_STATE = { active: null };
  const MOVE_THRESHOLD_PX = 4;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function confirmDialog(options = {}) {
    const {
      title = "",
      message = "",
      confirmLabel = "OK",
      cancelLabel = "Cancel",
      hintAuto = "",
      hintPaused = "",
      host = null
    } = options;
    let { autoConfirmMs = 0 } = options;

    // 觸控裝置（Firefox for Android）沒有「滑鼠移動」可用來暫停倒數，
    // 自動確認會在使用者還沒反應前就刪除，因此一律關閉，必須明確點選。
    try {
      if (window.matchMedia?.("(hover: none)").matches) autoConfirmMs = 0;
    } catch {}

    if (AUTO_STATE.active) AUTO_STATE.active.finish(false);

    return new Promise((resolve) => {
      const previousFocus = document.activeElement;
      const overlay = el("div", "vtm-confirm-overlay");
      const card = el("div", "vtm-confirm-card");
      card.setAttribute("role", "alertdialog");
      card.setAttribute("aria-modal", "true");
      card.tabIndex = -1;

      const header = el("div", "vtm-confirm-header");
      const icon = el("span", "vtm-confirm-icon");
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" focusable="false"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 11.2A1.8 1.8 0 0 1 15.2 22H8.8a1.8 1.8 0 0 1-1.8-1.8L6 9Zm4 2v9h1.5v-9H10Zm3.5 0v9H15v-9h-1.5Z"></path></svg>';
      const titleNode = el("div", "vtm-confirm-title", title);
      header.append(icon, titleNode);
      if (!title) titleNode.hidden = true;

      const messageNode = el("p", "vtm-confirm-message", message);
      const hintNode = el("p", "vtm-confirm-hint", autoConfirmMs > 0 ? hintAuto : "");
      hintNode.setAttribute("aria-live", "polite");
      if (!(autoConfirmMs > 0) || !hintAuto) hintNode.hidden = true;

      const actions = el("div", "vtm-confirm-actions");
      const cancelButton = el("button", "vtm-confirm-button vtm-confirm-cancel", cancelLabel);
      cancelButton.type = "button";
      const confirmButton = el("button", "vtm-confirm-button vtm-confirm-danger", confirmLabel);
      confirmButton.type = "button";
      actions.append(cancelButton, confirmButton);

      const progress = el("div", "vtm-confirm-progress");
      const progressFill = el("div", "vtm-confirm-progress-fill");
      progress.appendChild(progressFill);

      card.append(header, messageNode, hintNode, actions);
      if (autoConfirmMs > 0) card.appendChild(progress);
      overlay.appendChild(card);
      (host || document.documentElement).appendChild(overlay);

      let settled = false;
      let autoTimer = null;
      let baseline = null;

      function stopAuto() {
        if (autoTimer === null) return;
        window.clearTimeout(autoTimer);
        autoTimer = null;
        card.classList.add("is-paused");
        progressFill.style.transition = "none";
        if (hintPaused) {
          hintNode.textContent = hintPaused;
          hintNode.hidden = false;
        } else {
          hintNode.hidden = true;
        }
      }

      function onCardMove(event) {
        if (autoTimer === null) return;
        if (!baseline) {
          baseline = { x: event.clientX, y: event.clientY };
          return;
        }
        if (Math.hypot(event.clientX - baseline.x, event.clientY - baseline.y) >= MOVE_THRESHOLD_PX) stopAuto();
      }

      function onKeyDown(event) {
        // 視窗開啟期間，鍵盤事件不可穿透到 YouTube / Twitch 的快捷鍵。
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          finish(false);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopImmediatePropagation();
          const focusedCancel = document.activeElement === cancelButton;
          finish(!focusedCancel);
          return;
        }
        event.stopImmediatePropagation();
        stopAuto();
        if (event.key === "Tab") {
          event.preventDefault();
          (document.activeElement === confirmButton ? cancelButton : confirmButton).focus();
        }
      }

      function finish(result) {
        if (settled) return;
        settled = true;
        if (autoTimer !== null) window.clearTimeout(autoTimer);
        autoTimer = null;
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("keyup", swallowKey, true);
        document.removeEventListener("keypress", swallowKey, true);
        overlay.remove();
        AUTO_STATE.active = null;
        try { previousFocus?.focus?.({ preventScroll: true }); } catch {}
        resolve(Boolean(result));
      }

      function swallowKey(event) {
        event.stopImmediatePropagation();
      }

      AUTO_STATE.active = { finish };

      // 視窗內的指標事件不可穿透（避免觸發面板的「點外面就關閉」與播放器點擊）。
      for (const eventName of ["pointerdown", "mousedown", "click", "dblclick", "contextmenu"]) {
        overlay.addEventListener(eventName, (event) => event.stopPropagation());
      }
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) finish(false);
      });
      card.addEventListener("pointermove", onCardMove);
      card.addEventListener("mousemove", onCardMove);
      card.addEventListener("pointerdown", () => stopAuto());
      cancelButton.addEventListener("click", () => finish(false));
      confirmButton.addEventListener("click", () => finish(true));
      document.addEventListener("keydown", onKeyDown, true);
      document.addEventListener("keyup", swallowKey, true);
      document.addEventListener("keypress", swallowKey, true);

      confirmButton.focus({ preventScroll: true });

      if (autoConfirmMs > 0) {
        progressFill.style.transition = `transform ${autoConfirmMs}ms linear`;
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          if (!settled && autoTimer !== null) progressFill.style.transform = "scaleX(0)";
        }));
        autoTimer = window.setTimeout(() => {
          autoTimer = null;
          finish(true);
        }, autoConfirmMs);
      }
    });
  }

  globalThis.__VTM_CONFIRM__ = { confirmDialog };
})();
