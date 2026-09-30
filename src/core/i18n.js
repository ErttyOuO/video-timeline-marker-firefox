(() => {
  const ns = window.__VTM__;

  function t(key, substitutions) {
    try {
      const message = browser.i18n.getMessage(key, substitutions);
      return message || key;
    } catch {
      return key;
    }
  }

  function uiLanguage() {
    try {
      return browser.i18n.getUILanguage() || navigator.language || "en";
    } catch {
      return navigator.language || "en";
    }
  }

  ns.core.i18n = { t, uiLanguage };
})();
