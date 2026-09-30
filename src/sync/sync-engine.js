(() => {
  const root = globalThis;
  const ns = root.__VTM_SYNC__ = root.__VTM_SYNC__ || {};

  const MARKER_KEY = "vtm_markers_v1";
  const META_KEY = "vtm_sync_meta_v1";
  const DEVICE_KEY = "vtm_sync_device_id_v1";
  const CONFIG_KEY = ns.auth.CONFIG_KEY;
  const SCHEMA_VERSION = 1;
  const PERIODIC_ALARM = "vtm-google-drive-sync-periodic";
  const DEBOUNCE_ALARM = "vtm-google-drive-sync-debounce";
  const PERIOD_MINUTES = 15;
  const DEBOUNCE_MS = 6000;
  const DATA_COLLECTION_TYPES = ["authenticationInfo", "websiteActivity", "websiteContent"];

  let syncPromise = null;
  const pendingAppliedSignatures = new Set();

  function nowIso() {
    return new Date().toISOString();
  }

  function serializeError(error, fallback = "sync_failed") {
    const rawCode = String(error?.code || error?.message || fallback || "sync_failed");
    const code = rawCode.replace(/^Error:\s*/i, "").trim() || fallback;
    return {
      code,
      message: String(error?.message || code),
      detail: String(error?.detail || ""),
      httpStatus: Number.isFinite(Number(error?.httpStatus)) ? Number(error.httpStatus) : null,
      at: nowIso()
    };
  }

  function validIso(value, fallback = "1970-01-01T00:00:00.000Z") {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : fallback;
  }

  function compareIso(a, b) {
    return new Date(validIso(a)).getTime() - new Date(validIso(b)).getTime();
  }

  function nextVersionIso(entryRaw = null, candidateRaw = null) {
    const entry = entryRaw && typeof entryRaw === "object" ? entryRaw : {};
    const candidateMs = new Date(validIso(candidateRaw || nowIso())).getTime();
    const previousMs = Math.max(
      entry.updatedAt ? new Date(validIso(entry.updatedAt)).getTime() : 0,
      entry.deletedAt ? new Date(validIso(entry.deletedAt)).getTime() : 0
    );
    return new Date(Math.max(candidateMs, previousMs + 1)).toISOString();
  }

  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") {
      const result = {};
      for (const key of Object.keys(value).sort()) result[key] = canonicalize(value[key]);
      return result;
    }
    return value;
  }

  function canonicalString(value) {
    return JSON.stringify(canonicalize(value));
  }

  function markersSignature(markers) {
    const list = Array.isArray(markers) ? markers : [];
    return canonicalString(list);
  }

  function markerTimestamp(marker) {
    return validIso(marker?.updatedAt || marker?.capturedAt || marker?.publishedAt || marker?.liveStartedAt || nowIso(), nowIso());
  }

  function defaultConfig() {
    return {
      schemaVersion: 1,
      enabled: false,
      autoSync: true,
      lastSyncAt: null,
      lastError: null,
      lastStats: null
    };
  }

  async function getConfig() {
    const result = await browser.storage.local.get(CONFIG_KEY);
    const stored = result[CONFIG_KEY];
    const source = stored && typeof stored === "object" ? stored : {};
    const { clientId: _legacyClientId, ...rest } = source;
    return { ...defaultConfig(), ...rest };
  }

  async function saveConfig(patch) {
    const current = await getConfig();
    const next = { ...current, ...patch, schemaVersion: 1 };
    await browser.storage.local.set({ [CONFIG_KEY]: next });
    await configurePeriodicAlarm(next);
    return next;
  }

  async function getDeviceId() {
    const result = await browser.storage.local.get(DEVICE_KEY);
    if (result[DEVICE_KEY]) return result[DEVICE_KEY];
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await browser.storage.local.set({ [DEVICE_KEY]: id });
    return id;
  }

  function emptyMeta() {
    return { schemaVersion: SCHEMA_VERSION, entries: {} };
  }

  async function readLocalState() {
    const result = await browser.storage.local.get([MARKER_KEY, META_KEY]);
    const markers = Array.isArray(result[MARKER_KEY]) ? result[MARKER_KEY] : [];
    const rawMeta = result[META_KEY];
    const meta = rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
      ? { schemaVersion: SCHEMA_VERSION, entries: { ...(rawMeta.entries || {}) } }
      : emptyMeta();

    let changed = false;
    const liveIds = new Set();
    for (const marker of markers) {
      if (!marker?.id) continue;
      liveIds.add(marker.id);
      const entry = meta.entries[marker.id];
      if (!entry || (!entry.updatedAt && !entry.deletedAt)) {
        meta.entries[marker.id] = { updatedAt: markerTimestamp(marker), deletedAt: null };
        changed = true;
      } else if (entry.deletedAt && compareIso(entry.deletedAt, entry.updatedAt) < 0) {
        meta.entries[marker.id] = { ...entry, deletedAt: null };
        changed = true;
      }
    }

    // A metadata entry that used to be live but no longer has a local marker is
    // itself evidence of a local deletion. Record the tombstone here as a second
    // line of defense in case a manual sync starts before storage.onChanged has
    // finished processing the marker-array deletion.
    const inferredDeletionAt = nowIso();
    for (const [id, entryRaw] of Object.entries(meta.entries)) {
      if (liveIds.has(id)) continue;
      const entry = entryRaw && typeof entryRaw === "object" ? entryRaw : {};
      if (entry.updatedAt && !entry.deletedAt) {
        meta.entries[id] = { updatedAt: validIso(entry.updatedAt), deletedAt: nextVersionIso(entry, inferredDeletionAt) };
        changed = true;
      }
    }

    if (changed) await browser.storage.local.set({ [META_KEY]: meta });
    return { markers, meta };
  }

  function normalizeCloudPayload(payload) {
    if (!payload) {
      return { schemaVersion: SCHEMA_VERSION, markers: [], versions: {}, tombstones: {} };
    }
    if (Number(payload.schemaVersion) !== SCHEMA_VERSION) {
      const error = new Error("cloud_schema_unsupported");
      error.code = "cloud_schema_unsupported";
      throw error;
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      markers: Array.isArray(payload.markers) ? payload.markers.filter((marker) => marker?.id) : [],
      versions: payload.versions && typeof payload.versions === "object" && !Array.isArray(payload.versions) ? payload.versions : {},
      tombstones: payload.tombstones && typeof payload.tombstones === "object" && !Array.isArray(payload.tombstones) ? payload.tombstones : {}
    };
  }

  function sideEvents(markers, versions, tombstones) {
    const map = new Map();
    for (const marker of markers || []) {
      if (!marker?.id) continue;
      map.set(marker.id, {
        id: marker.id,
        deleted: false,
        version: validIso(versions?.[marker.id] || markerTimestamp(marker)),
        marker
      });
    }
    for (const [id, deletedAtRaw] of Object.entries(tombstones || {})) {
      const deletedAt = validIso(deletedAtRaw);
      const current = map.get(id);
      if (!current || compareIso(deletedAt, current.version) >= 0) {
        map.set(id, { id, deleted: true, version: deletedAt, marker: null });
      }
    }
    return map;
  }

  function localEvents(local) {
    const versions = {};
    const tombstones = {};
    for (const [id, entryRaw] of Object.entries(local.meta.entries || {})) {
      const entry = entryRaw && typeof entryRaw === "object" ? entryRaw : {};
      if (entry.updatedAt) versions[id] = validIso(entry.updatedAt);
      if (entry.deletedAt) tombstones[id] = validIso(entry.deletedAt);
    }
    return sideEvents(local.markers, versions, tombstones);
  }

  function cloudEvents(cloud) {
    return sideEvents(cloud.markers, cloud.versions, cloud.tombstones);
  }

  function chooseEvent(localEvent, cloudEvent) {
    if (!localEvent) return cloudEvent;
    if (!cloudEvent) return localEvent;
    const order = compareIso(localEvent.version, cloudEvent.version);
    if (order > 0) return localEvent;
    if (order < 0) return cloudEvent;

    if (localEvent.deleted !== cloudEvent.deleted) {
      return localEvent.deleted ? localEvent : cloudEvent;
    }
    if (localEvent.deleted) return localEvent;

    const localPayload = canonicalString(localEvent.marker);
    const cloudPayload = canonicalString(cloudEvent.marker);
    return localPayload >= cloudPayload ? localEvent : cloudEvent;
  }

  function mergeStates(local, cloud) {
    const localMap = localEvents(local);
    const cloudMap = cloudEvents(cloud);
    const ids = new Set([...localMap.keys(), ...cloudMap.keys()]);
    const markers = [];
    const meta = emptyMeta();
    const versions = {};
    const tombstones = {};
    let fromLocal = 0;
    let fromCloud = 0;
    let deleted = 0;

    for (const id of ids) {
      const localEvent = localMap.get(id);
      const cloudEvent = cloudMap.get(id);
      const chosen = chooseEvent(localEvent, cloudEvent);
      if (!chosen) continue;

      if (chosen === localEvent && chosen !== cloudEvent) fromLocal += 1;
      if (chosen === cloudEvent && chosen !== localEvent) fromCloud += 1;

      if (chosen.deleted) {
        deleted += 1;
        tombstones[id] = chosen.version;
        meta.entries[id] = { updatedAt: null, deletedAt: chosen.version };
      } else {
        markers.push(chosen.marker);
        versions[id] = chosen.version;
        meta.entries[id] = { updatedAt: chosen.version, deletedAt: null };
      }
    }

    markers.sort((a, b) => {
      const timeOrder = compareIso(a?.capturedAt, b?.capturedAt);
      if (timeOrder !== 0) return timeOrder;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });

    return {
      markers,
      meta,
      cloudCore: { schemaVersion: SCHEMA_VERSION, markers, versions, tombstones },
      stats: { live: markers.length, tombstones: deleted, fromLocal, fromCloud }
    };
  }

  function cloudCore(payload) {
    const normalized = normalizeCloudPayload(payload);
    return {
      schemaVersion: SCHEMA_VERSION,
      markers: normalized.markers,
      versions: normalized.versions,
      tombstones: normalized.tombstones
    };
  }

  function cloudAsLocalState(payload) {
    const cloud = normalizeCloudPayload(payload);
    const meta = emptyMeta();
    for (const marker of cloud.markers) {
      const version = validIso(cloud.versions[marker.id] || markerTimestamp(marker));
      meta.entries[marker.id] = { updatedAt: version, deletedAt: null };
    }
    for (const [id, deletedAtRaw] of Object.entries(cloud.tombstones)) {
      const deletedAt = validIso(deletedAtRaw);
      const entry = meta.entries[id];
      if (!entry || compareIso(deletedAt, entry.updatedAt) >= 0) {
        meta.entries[id] = { updatedAt: entry?.updatedAt || null, deletedAt };
      }
    }
    return { markers: cloud.markers, meta };
  }

  function mergeCloudPayloads(payloads) {
    const list = Array.isArray(payloads) ? payloads : [];
    if (!list.length) return normalizeCloudPayload(null);

    let combined = cloudCore(list[0]);
    for (let index = 1; index < list.length; index += 1) {
      const merged = mergeStates(cloudAsLocalState(combined), normalizeCloudPayload(list[index]));
      combined = merged.cloudCore;
    }
    return normalizeCloudPayload(combined);
  }

  async function applyMergedLocal(merged, currentLocal) {
    const markersChanged = canonicalString(currentLocal.markers) !== canonicalString(merged.markers);
    const metaChanged = canonicalString(currentLocal.meta) !== canonicalString(merged.meta);
    if (!markersChanged && !metaChanged) return false;

    if (markersChanged) pendingAppliedSignatures.add(markersSignature(merged.markers));
    await browser.storage.local.set({
      [MARKER_KEY]: merged.markers,
      [META_KEY]: merged.meta
    });
    return true;
  }

  async function hasDataCollectionConsent() {
    try {
      return await browser.permissions.contains({ data_collection: DATA_COLLECTION_TYPES });
    } catch {
      return true;
    }
  }

  async function syncOnce(reason = "manual") {
    const config = await getConfig();
    const authState = await ns.auth.getState();
    if (!(await hasDataCollectionConsent())) {
      await saveConfig({ enabled: false, lastError: { code: "data_collection_permission_missing", message: "data_collection_permission_missing", at: nowIso() } });
      await ns.auth.clearLocalAuth();
      const error = new Error("data_collection_permission_missing");
      error.code = "data_collection_permission_missing";
      throw error;
    }
    if (!config.enabled || !authState.connected) {
      const error = new Error("not_connected");
      error.code = "not_connected";
      throw error;
    }

    const local = await readLocalState();
    const remote = await ns.drive.readSyncFile();
    const sourcePayloads = remote.exists
      ? (Array.isArray(remote.sources) && remote.sources.length
        ? remote.sources.map((source) => source.payload)
        : [remote.payload])
      : [];
    // Merge every same-name appData file before local/cloud reconciliation.
    // This protects against two devices both creating the first sync file at once.
    const cloud = mergeCloudPayloads(sourcePayloads);
    const merged = mergeStates(local, cloud);
    const localChanged = await applyMergedLocal(merged, local);
    const mergedCoreString = canonicalString(merged.cloudCore);
    // Compare against the primary write target, not the already-combined view.
    // If duplicate files contain unique records, this forces the primary file to
    // absorb them and makes subsequent reads converge without deleting anything.
    const remoteCoreString = canonicalString(cloudCore(remote.payload));
    let uploaded = false;

    if (!remote.exists) {
      const payload = {
        ...merged.cloudCore,
        app: "video-timeline-marker",
        updatedAt: nowIso(),
        deviceId: await getDeviceId()
      };
      await ns.drive.createSyncFile(payload);
      uploaded = true;
    } else if (mergedCoreString !== remoteCoreString) {
      const payload = {
        ...merged.cloudCore,
        app: "video-timeline-marker",
        updatedAt: nowIso(),
        deviceId: await getDeviceId()
      };
      await ns.drive.updateSyncFile(remote.file.id, payload, remote.etag);
      uploaded = true;
    }

    const lastStats = {
      reason,
      ...merged.stats,
      localChanged,
      uploaded,
      duplicateCloudFiles: remote.duplicates || 0
    };
    await saveConfig({ lastSyncAt: nowIso(), lastError: null, lastStats });
    return lastStats;
  }

  async function runSync(reason = "manual") {
    if (syncPromise) return syncPromise;
    syncPromise = (async () => {
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await syncOnce(reason);
        } catch (error) {
          lastError = error;
          if (error?.code !== "precondition_failed") break;
        }
      }

      const code = lastError?.code || "sync_failed";
      await saveConfig({
        lastError: { code, message: String(lastError?.message || code), at: nowIso() }
      });
      throw lastError;
    })().finally(() => {
      syncPromise = null;
    });
    return syncPromise;
  }

  async function scheduleSync() {
    const config = await getConfig();
    if (!config.enabled || !config.autoSync) return;
    await browser.alarms.create(DEBOUNCE_ALARM, { when: Date.now() + DEBOUNCE_MS });
  }

  async function configurePeriodicAlarm(configInput = null) {
    const config = configInput || await getConfig();
    if (config.enabled && config.autoSync) {
      const existing = await browser.alarms.get(PERIODIC_ALARM);
      if (!existing) {
        await browser.alarms.create(PERIODIC_ALARM, { delayInMinutes: 1, periodInMinutes: PERIOD_MINUTES });
      }
    } else {
      await browser.alarms.clear(PERIODIC_ALARM);
      await browser.alarms.clear(DEBOUNCE_ALARM);
    }
  }

  async function recordMarkerChange(change) {
    const nextMarkers = Array.isArray(change.newValue) ? change.newValue : [];
    const signature = markersSignature(nextMarkers);
    if (pendingAppliedSignatures.has(signature)) {
      pendingAppliedSignatures.delete(signature);
      return;
    }

    const oldMarkers = Array.isArray(change.oldValue) ? change.oldValue : [];
    const oldMap = new Map(oldMarkers.filter((m) => m?.id).map((m) => [m.id, m]));
    const newMap = new Map(nextMarkers.filter((m) => m?.id).map((m) => [m.id, m]));
    const result = await browser.storage.local.get(META_KEY);
    const stored = result[META_KEY];
    const meta = stored && typeof stored === "object" && !Array.isArray(stored)
      ? { schemaVersion: SCHEMA_VERSION, entries: { ...(stored.entries || {}) } }
      : emptyMeta();
    const changedAt = nowIso();
    let touched = false;

    for (const [id, marker] of newMap) {
      const oldMarker = oldMap.get(id);
      if (!oldMarker || canonicalString(oldMarker) !== canonicalString(marker)) {
        const previous = meta.entries[id] || {};
        meta.entries[id] = { updatedAt: nextVersionIso(previous, changedAt), deletedAt: null };
        touched = true;
      } else if (!meta.entries[id]) {
        meta.entries[id] = { updatedAt: markerTimestamp(marker), deletedAt: null };
        touched = true;
      }
    }

    for (const [id] of oldMap) {
      if (!newMap.has(id)) {
        const previous = meta.entries[id] || {};
        meta.entries[id] = {
          updatedAt: previous.updatedAt || null,
          deletedAt: nextVersionIso(previous, changedAt)
        };
        touched = true;
      }
    }

    if (touched) await browser.storage.local.set({ [META_KEY]: meta });
    await scheduleSync();
  }

  async function getStatus() {
    const [config, authState, local] = await Promise.all([getConfig(), ns.auth.getState(), readLocalState()]);
    let tombstones = 0;
    for (const entry of Object.values(local.meta.entries || {})) if (entry?.deletedAt) tombstones += 1;
    return {
      ...config,
      connected: authState.connected,
      redirectUri: authState.redirectUri,
      scope: authState.scope,
      markerCount: local.markers.length,
      tombstoneCount: tombstones,
      syncing: Boolean(syncPromise)
    };
  }

  async function connect() {
    ns.auth.validateClientId(ns.auth.DEFAULT_CLIENT_ID);
    await saveConfig({ lastError: null });

    try {
      await ns.auth.connect();
    } catch (error) {
      const authError = serializeError(error, "oauth_connect_failed");
      await saveConfig({ enabled: false, lastError: authError });
      return { status: await getStatus(), authError };
    }

    await saveConfig({ enabled: true, lastError: null });

    let syncError = null;
    try {
      await runSync("connect");
    } catch (error) {
      syncError = serializeError(error, "sync_failed");
    }
    return { status: await getStatus(), syncError };
  }

  async function disconnect() {
    await ns.auth.disconnect();
    await saveConfig({ enabled: false, lastError: null, lastSyncAt: null, lastStats: null });
    return getStatus();
  }

  async function updateSettings(settings = {}) {
    const patch = {};
    if (typeof settings.autoSync === "boolean") patch.autoSync = settings.autoSync;
    const config = await saveConfig(patch);
    if (config.enabled && config.autoSync && settings.autoSync === true) await scheduleSync();
    return getStatus();
  }

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[MARKER_KEY]) {
      recordMarkerChange(changes[MARKER_KEY]).catch((error) => console.warn("[VTM Sync] marker change tracking failed", error));
    }
    if (changes[CONFIG_KEY]) {
      const next = { ...defaultConfig(), ...(changes[CONFIG_KEY].newValue || {}) };
      configurePeriodicAlarm(next).catch((error) => console.warn("[VTM Sync] alarm update failed", error));
    }
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== PERIODIC_ALARM && alarm.name !== DEBOUNCE_ALARM) return;
    runSync(alarm.name === PERIODIC_ALARM ? "periodic" : "debounced")
      .catch((error) => console.warn("[VTM Sync] automatic sync failed", error));
  });

  browser.runtime.onStartup.addListener(() => {
    configurePeriodicAlarm()
      .then(async () => {
        const config = await getConfig();
        if (config.enabled && config.autoSync) return runSync("startup");
        return null;
      })
      .catch((error) => console.warn("[VTM Sync] startup sync failed", error));
  });

  browser.permissions?.onRemoved?.addListener((removed) => {
    const removedTypes = Array.isArray(removed?.data_collection) ? removed.data_collection : [];
    if (!removedTypes.some((type) => DATA_COLLECTION_TYPES.includes(type))) return;
    Promise.all([
      ns.auth.clearLocalAuth(),
      saveConfig({ enabled: false, lastError: null, lastSyncAt: null, lastStats: null })
    ]).catch((error) => console.warn("[VTM Sync] failed to stop after data permission removal", error));
  });

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === "VTM_SYNC_GET_STATUS") return getStatus();
    if (message?.type === "VTM_SYNC_UPDATE_SETTINGS") return updateSettings(message.settings || {});
    if (message?.type === "VTM_SYNC_CONNECT") return connect();
    if (message?.type === "VTM_SYNC_DISCONNECT") return disconnect();
    if (message?.type === "VTM_SYNC_NOW") return runSync(message.reason || "manual").then(async (stats) => ({ stats, status: await getStatus() }));
    return undefined;
  });

  configurePeriodicAlarm().catch((error) => console.warn("[VTM Sync] initialization failed", error));

  ns.engine = {
    MARKER_KEY,
    META_KEY,
    CONFIG_KEY,
    getStatus,
    runSync,
    connect,
    disconnect,
    updateSettings,
    mergeStates,
    mergeCloudPayloads,
    normalizeCloudPayload
  };
})();
