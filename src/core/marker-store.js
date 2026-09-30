(() => {
  const ns = window.__VTM__;
  const KEY = "vtm_markers_v1";

  async function getAll() {
    const result = await browser.storage.local.get(KEY);
    return Array.isArray(result[KEY]) ? result[KEY] : [];
  }

  async function setAll(markers) {
    await browser.storage.local.set({ [KEY]: markers });
    return markers;
  }

  async function add(marker) {
    const markers = await getAll();
    markers.push(marker);
    await setAll(markers);
    return marker;
  }

  async function update(id, patch) {
    const markers = await getAll();
    const index = markers.findIndex((m) => m.id === id);
    if (index === -1) return null;
    markers[index] = { ...markers[index], ...patch };
    await setAll(markers);
    return markers[index];
  }

  async function remove(id) {
    const markers = await getAll();
    await setAll(markers.filter((m) => m.id !== id));
  }

  ns.core.store = { KEY, getAll, setAll, add, update, remove };
})();
