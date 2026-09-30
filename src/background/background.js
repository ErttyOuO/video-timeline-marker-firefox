const STORAGE_KEY = "vtm_markers_v1";
const t = (key, substitutions) => browser.i18n.getMessage(key, substitutions) || key;

function sanitizeFilename(value) {
  return (value || t("unnamedVideo"))
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/[\u0000-\u001F]/g, "")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 120) || t("unnamedVideo");
}

function formatClock(value) {
  const total = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : null;
  if (total === null) return "--:--";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function toDate(iso) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return t("unknownDate");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTxtClock(value) {
  const total = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : null;
  if (total === null) return "--:--";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function twitchTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h ? `${h}h` : ""}${m || h ? `${m}m` : ""}${s}s`;
}

function timeUrl(marker) {
  const seconds = marker.vodResolution?.resolvedPositionSeconds ?? marker.positionSeconds ?? marker.timeline?.playerCurrentTime;
  if (!Number.isFinite(Number(seconds))) return marker.canonicalUrl || marker.originalUrl || "";
  if (marker.platform === "youtube" && marker.mediaId) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(marker.mediaId)}&t=${Math.floor(seconds)}s`;
  }
  if (marker.platform === "twitch") {
    const vodId = marker.vodResolution?.vodId || (marker.mediaType === "vod" ? marker.mediaId : null);
    if (vodId) return `https://www.twitch.tv/videos/${vodId}?t=${twitchTime(seconds)}`;
  }
  return marker.canonicalUrl || marker.originalUrl || "";
}

function markerText(marker) {
  const seconds = marker.vodResolution?.resolvedPositionSeconds ?? marker.positionSeconds ?? marker.timeline?.playerCurrentTime;
  const lines = [`[${formatTxtClock(seconds)}]`];
  const note = String(marker.note || "").trim();
  if (note) lines.push(`${t("txtNote")}: ${note}`);
  return lines.join("\r\n");
}

function markerTimelineSeconds(marker) {
  const value = marker?.vodResolution?.resolvedPositionSeconds ?? marker?.positionSeconds ?? marker?.timeline?.playerCurrentTime;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : null;
}

function compareMarkersByTimelineAsc(a, b) {
  const aSeconds = markerTimelineSeconds(a);
  const bSeconds = markerTimelineSeconds(b);
  if (aSeconds !== null && bSeconds !== null && aSeconds !== bSeconds) return aSeconds - bSeconds;
  if (aSeconds !== null && bSeconds === null) return -1;
  if (aSeconds === null && bSeconds !== null) return 1;
  return new Date(a?.capturedAt || 0) - new Date(b?.capturedAt || 0);
}

async function exportMarkers(markerIds) {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const all = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  const selected = markerIds?.length ? all.filter((m) => markerIds.includes(m.id)) : all;
  if (!selected.length) throw new Error(t("exportNoMarkers"));

  const groups = new Map();
  for (const marker of selected) {
    const key = `${marker.platform}:${marker.mediaId || marker.canonicalUrl}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(marker);
  }

  for (const group of groups.values()) {
    group.sort(compareMarkersByTimelineAsc);
    const first = group.reduce((latest, marker) => {
      if (!latest) return marker;
      return new Date(marker?.capturedAt || 0) > new Date(latest?.capturedAt || 0) ? marker : latest;
    }, null) || group[0];
    const date = toDate(first.publishedAt || first.liveStartedAt || first.capturedAt);
    const header = [
      `${t("txtTitle")}: ${first.title || t("unnamedVideo")}`,
      `${t("txtPlatform")}: ${first.platform}`,
      `${t("txtCreator")}: ${first.creatorName || ""}`,
      `${t("txtMediaType")}: ${first.mediaType || ""}`,
      `${t("txtDate")}: ${date}`,
      `${t("txtOriginalUrl")}: ${first.canonicalUrl || first.originalUrl || ""}`,
      "",
      "────────────────────────",
      t("txtMarkerTimeHeading")
    ].join("\r\n");
    const body = group.map(markerText).join("\r\n\r\n");
    const content = `\uFEFF${header}\r\n${body}\r\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = `${sanitizeFilename(first.title)} ${date}.txt`;
    try {
      await browser.downloads.download({ url, filename, saveAs: true, conflictAction: "uniquify" });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  }

  return { count: selected.length, files: groups.size };
}

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "VTM_EXPORT") return exportMarkers(message.markerIds || null);
  return undefined;
});
