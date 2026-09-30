(() => {
  const HEADER_ALIASES = {
    title: ["標題", "标题", "Title"],
    platform: ["平台", "Platform"],
    creatorName: ["頻道／實況主", "频道／实况主", "频道／主播", "Channel / streamer", "Channel / Streamer", "Creator"],
    mediaType: ["影片類型", "影片类型", "视频类型", "Media type", "Media Type"],
    date: ["上傳／直播日期", "上传／直播日期", "Upload / live date", "Upload / Live Date"],
    originalUrl: ["原始網址", "原始网址", "Original URL", "Original Url"]
  };
  const NOTE_ALIASES = ["備註", "备注", "Note"];
  const HEADING_ALIASES = ["標註時間", "标注时间", "Marker time", "Marker Time", "Timestamps"];
  const LEGACY_FIELD_ALIASES = {
    timeUrl: ["時間網址", "时间网址", "Timestamp URL", "Timestamp Url"],
    capturedAt: ["標記時間", "标记时间", "Marked at", "Marked At"],
    accuracy: ["準確度", "准确度", "Accuracy"],
    vodStatus: ["VOD 配對狀態", "VOD 配对状态", "VOD resolution status", "VOD Resolution Status"]
  };
  const ESTIMATED_PREFIXES = ["暫定", "暂定", "Estimated"];

  function createParseError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function normalizeLine(value) {
    return String(value || "").replace(/^\uFEFF/, "").trim();
  }

  function splitLabelLine(line) {
    const match = String(line || "").match(/^\s*([^:：]+?)\s*[:：]\s*(.*)$/);
    return match ? { label: match[1].trim(), value: match[2] } : null;
  }

  function normalizedAlias(value) {
    return String(value || "").trim().toLowerCase();
  }

  function fieldForLabel(label) {
    const normalized = normalizedAlias(label);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some((alias) => alias.toLowerCase() === normalized)) return field;
    }
    return null;
  }

  function legacyFieldForLabel(label) {
    const normalized = normalizedAlias(label);
    for (const [field, aliases] of Object.entries(LEGACY_FIELD_ALIASES)) {
      if (aliases.some((alias) => alias.toLowerCase() === normalized)) return field;
    }
    return null;
  }

  function isNoteLabel(label) {
    const normalized = normalizedAlias(label);
    return NOTE_ALIASES.some((alias) => alias.toLowerCase() === normalized);
  }

  function isHeadingLine(line) {
    const normalized = normalizeLine(line).replace(/[：:]$/, "").toLowerCase();
    return HEADING_ALIASES.some((alias) => alias.toLowerCase() === normalized);
  }

  function parseClockToken(rawToken) {
    let token = String(rawToken || "").trim();
    let estimated = false;
    for (const prefix of ESTIMATED_PREFIXES) {
      const pattern = new RegExp(`^${prefix}\\s+`, "i");
      if (pattern.test(token)) {
        estimated = true;
        token = token.replace(pattern, "").trim();
        break;
      }
    }
    const match = token.match(/^(\d{1,4}):([0-5]\d)(?::([0-5]\d))?$/);
    if (!match) return null;
    const seconds = match[3] !== undefined
      ? (Number(match[1]) * 3600) + (Number(match[2]) * 60) + Number(match[3])
      : (Number(match[1]) * 60) + Number(match[2]);
    return { seconds, estimated };
  }

  function parseClockDetails(line) {
    const normalized = normalizeLine(line).replace(/^[-*•]\s*/, "");
    const bracket = normalized.match(/^\[\s*(.*?)\s*\]$/);
    if (bracket) {
      const parsed = parseClockToken(bracket[1]);
      return parsed ? { ...parsed, style: "bracket" } : null;
    }
    const bare = parseClockToken(normalized);
    return bare ? { ...bare, style: "bare" } : null;
  }

  function parseClockLine(line) {
    return parseClockDetails(line)?.seconds ?? null;
  }

  function unwrapMarkdownUrl(value) {
    const text = String(value || "").trim();
    const markdown = text.match(/^\[[^\]]+\]\((https?:\/\/[^)]+)\)$/i);
    if (markdown) return markdown[1].replace(/\\_/g, "_");
    return text.replace(/^<|>$/g, "").replace(/\\_/g, "_");
  }

  function normalizePlatform(value, url) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw.includes("youtube") || /youtu\.be|youtube\.com/i.test(url || "")) return "youtube";
    if (raw.includes("twitch") || /twitch\.tv/i.test(url || "")) return "twitch";
    return raw || "unknown";
  }

  function normalizeMediaType(value, platform, url) {
    const raw = String(value || "").trim().toLowerCase();
    if (["video", "vod", "live"].includes(raw)) return raw;
    if (platform === "youtube") return "video";
    if (platform === "twitch") return /\/videos\/\d+/i.test(url || "") ? "vod" : "live";
    return raw || "video";
  }

  function normalizeCanonicalUrl(platform, mediaType, rawUrl) {
    const raw = unwrapMarkdownUrl(rawUrl);
    try {
      const url = new URL(raw);
      if (platform === "youtube") {
        const id = url.hostname.includes("youtu.be")
          ? url.pathname.split("/").filter(Boolean)[0]
          : url.searchParams.get("v");
        if (id) return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
      }
      if (platform === "twitch") {
        const vodMatch = url.pathname.match(/^\/videos\/(\d+)/i);
        if (vodMatch) return `https://www.twitch.tv/videos/${vodMatch[1]}`;
        const login = url.pathname.split("/").filter(Boolean)[0];
        if (login) return `https://www.twitch.tv/${login}`;
      }
      url.hash = "";
      return url.toString();
    } catch {
      return raw;
    }
  }

  function extractMediaId(platform, mediaType, canonicalUrl) {
    try {
      const url = new URL(canonicalUrl);
      if (platform === "youtube") return url.searchParams.get("v") || null;
      if (platform === "twitch") {
        const vodMatch = url.pathname.match(/^\/videos\/(\d+)/i);
        if (vodMatch) return vodMatch[1];
        return url.pathname.split("/").filter(Boolean)[0] || null;
      }
    } catch {}
    return null;
  }

  function simpleHash(value) {
    let hash = 2166136261;
    for (const char of String(value || "")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function dateToIso(dateText) {
    const match = String(dateText || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const iso = `${match[1]}-${match[2]}-${match[3]}T12:00:00.000Z`;
    return Number.isNaN(new Date(iso).getTime()) ? null : iso;
  }

  function markerId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `import-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function parseTxt(text, fileName = "") {
    const source = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    if (!source.trim()) throw createParseError("EMPTY_FILE", `Empty TXT: ${fileName || "TXT"}`);

    const lines = source.split("\n");
    const meta = {};
    let firstTimestampIndex = -1;
    let headingSeen = false;
    let legacyFieldsSeen = false;
    let legacyEstimatedSeen = false;
    let bareTimestampSeen = false;
    let firstLegacyTimeUrl = "";

    for (let i = 0; i < lines.length; i += 1) {
      if (isHeadingLine(lines[i])) headingSeen = true;
      const clock = parseClockDetails(lines[i]);
      if (clock) {
        firstTimestampIndex = i;
        if (clock.estimated) legacyEstimatedSeen = true;
        if (clock.style === "bare") bareTimestampSeen = true;
        break;
      }
      const parsed = splitLabelLine(lines[i]);
      if (!parsed) continue;
      const field = fieldForLabel(parsed.label);
      if (field) meta[field] = field === "originalUrl" ? unwrapMarkdownUrl(parsed.value) : parsed.value.trim();
    }

    if (firstTimestampIndex < 0) {
      throw createParseError("NO_TIMESTAMPS", `No marker timestamps found in ${fileName || "TXT"}`);
    }

    const markers = [];
    let current = null;
    let noteStarted = false;

    const finalize = () => {
      if (!current) return;
      current.note = current.noteLines.join("\n").trim();
      delete current.noteLines;
      markers.push(current);
      current = null;
      noteStarted = false;
    };

    for (let i = firstTimestampIndex; i < lines.length; i += 1) {
      const clock = parseClockDetails(lines[i]);
      if (clock) {
        finalize();
        current = {
          seconds: clock.seconds,
          noteLines: [],
          accuracy: clock.estimated ? "estimated" : null,
          capturedAt: null,
          timeUrl: "",
          vodStatus: null
        };
        if (clock.estimated) legacyEstimatedSeen = true;
        if (clock.style === "bare") bareTimestampSeen = true;
        continue;
      }
      if (!current) continue;
      const parsed = splitLabelLine(lines[i]);
      if (parsed && isNoteLabel(parsed.label)) {
        noteStarted = true;
        current.noteLines.push(parsed.value);
        continue;
      }
      if (parsed) {
        const legacyField = legacyFieldForLabel(parsed.label);
        if (legacyField) {
          legacyFieldsSeen = true;
          noteStarted = false;
          const value = parsed.value.trim();
          if (legacyField === "timeUrl") {
            current.timeUrl = unwrapMarkdownUrl(value);
            if (!firstLegacyTimeUrl) firstLegacyTimeUrl = current.timeUrl;
          } else if (legacyField === "capturedAt") {
            current.capturedAt = value || null;
          } else if (legacyField === "accuracy") {
            current.accuracy = value || current.accuracy;
          } else if (legacyField === "vodStatus") {
            current.vodStatus = value || null;
          }
          continue;
        }
      }
      if (isHeadingLine(lines[i]) || /^─{3,}$/.test(normalizeLine(lines[i]))) continue;
      if (noteStarted) current.noteLines.push(lines[i]);
    }
    finalize();

    if (!markers.length) throw createParseError("NO_MARKERS", `No markers found in ${fileName || "TXT"}`);

    if (!meta.originalUrl && firstLegacyTimeUrl) meta.originalUrl = firstLegacyTimeUrl;
    const inferredPlatform = normalizePlatform(meta.platform, meta.originalUrl || firstLegacyTimeUrl);
    const warnings = [];
    if (!meta.originalUrl) warnings.push("MISSING_URL");
    if (inferredPlatform === "unknown") warnings.push("UNKNOWN_PLATFORM");
    if (!meta.title) warnings.push("MISSING_TITLE");

    const format = legacyFieldsSeen || legacyEstimatedSeen
      ? "legacy"
      : bareTimestampSeen || !headingSeen
        ? "compatible"
        : "current";

    return { meta, markers, fileName, format, warnings };
  }

  function normalizeLegacyAccuracy(value, fallback) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw.includes("estimate") || raw.includes("暫") || raw.includes("暂")) return "estimated";
    if (raw.includes("calibrat") || raw.includes("校準") || raw.includes("校准")) return "calibrated";
    if (raw.includes("exact") || raw.includes("精確") || raw.includes("精确")) return "exact";
    return fallback;
  }

  function buildMarkers(parsed, baseTime = Date.now()) {
    const rawUrl = parsed.meta.originalUrl || parsed.markers.find((item) => item.timeUrl)?.timeUrl || "";
    const platform = normalizePlatform(parsed.meta.platform, rawUrl);
    const mediaType = normalizeMediaType(parsed.meta.mediaType, platform, rawUrl);
    const canonicalUrl = normalizeCanonicalUrl(platform, mediaType, rawUrl);
    const derivedId = extractMediaId(platform, mediaType, canonicalUrl);
    const dateIso = dateToIso(parsed.meta.date);
    const fallbackIdentity = `${platform}|${mediaType}|${canonicalUrl}|${parsed.meta.title || ""}|${parsed.meta.creatorName || ""}|${parsed.meta.date || ""}`;
    const mediaId = derivedId || `import-${simpleHash(fallbackIdentity)}`;

    return parsed.markers.map((item, index) => {
      const isLive = mediaType === "live";
      const defaultAccuracy = isLive ? "calibrated" : "exact";
      const accuracy = normalizeLegacyAccuracy(item.accuracy, defaultAccuracy);
      const capturedAtCandidate = item.capturedAt ? new Date(item.capturedAt) : null;
      const capturedAt = capturedAtCandidate && !Number.isNaN(capturedAtCandidate.getTime())
        ? capturedAtCandidate.toISOString()
        : new Date(baseTime + index).toISOString();
      const importedVodStatus = String(item.vodStatus || "").trim().toLowerCase();
      let importedVodId = null;
      let importedVodUrl = null;
      if (platform === "twitch" && isLive && item.timeUrl) {
        try {
          const legacyUrl = new URL(item.timeUrl);
          const vodMatch = legacyUrl.pathname.match(/^\/videos\/(\d+)/i);
          if (vodMatch) {
            importedVodId = vodMatch[1];
            importedVodUrl = `https://www.twitch.tv/videos/${importedVodId}`;
          }
        } catch {}
      }
      const vodStatus = platform === "twitch" && isLive
        ? (importedVodStatus || (importedVodId ? "resolved" : "pending"))
        : "not_needed";

      return {
        id: markerId(),
        platform,
        mediaType,
        mediaId,
        streamId: null,
        broadcasterId: null,
        title: parsed.meta.title || parsed.fileName.replace(/\.txt$/i, "") || "Imported timeline",
        creatorName: parsed.meta.creatorName || "",
        originalUrl: rawUrl || canonicalUrl,
        canonicalUrl: canonicalUrl || rawUrl,
        publishedAt: isLive ? null : dateIso,
        liveStartedAt: isLive ? dateIso : null,
        positionSeconds: item.seconds,
        accuracy,
        timeline: {
          playerCurrentTime: item.seconds,
          duration: null,
          seekableStart: null,
          seekableEnd: null,
          behindLiveEdge: null,
          liveElapsed: isLive ? item.seconds : null,
          estimatedVodPosition: item.seconds
        },
        diagnostics: {
          imported: true,
          importSource: parsed.fileName || "TXT",
          importFormat: parsed.format || "unknown"
        },
        capturedAt,
        note: item.note || "",
        vodResolution: platform === "twitch" && isLive
          ? {
              status: vodStatus,
              vodId: importedVodId,
              vodUrl: importedVodUrl,
              resolvedPositionSeconds: importedVodId ? item.seconds : null
            }
          : { status: "not_needed", vodId: null, vodUrl: null, resolvedPositionSeconds: null }
      };
    });
  }

  function timelineSecond(marker) {
    const value = marker?.vodResolution?.resolvedPositionSeconds ?? marker?.positionSeconds ?? marker?.timeline?.playerCurrentTime;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : null;
  }

  function mediaIdentity(marker) {
    const platform = String(marker?.platform || "unknown").toLowerCase();
    const mediaId = String(marker?.mediaId || "").trim().toLowerCase();
    if (mediaId) return `${platform}:id:${mediaId}`;
    const url = normalizeCanonicalUrl(platform, marker?.mediaType, marker?.canonicalUrl || marker?.originalUrl || "").toLowerCase();
    return `${platform}:url:${url}`;
  }

  function mergeMarkers(existing, incoming) {
    const merged = existing.map((marker) => ({ ...marker }));
    const stats = { added: 0, updated: 0, skipped: 0, conflicts: 0 };

    for (const candidate of incoming) {
      const identity = mediaIdentity(candidate);
      const seconds = timelineSecond(candidate);
      const matches = merged.filter((marker) => mediaIdentity(marker) === identity && timelineSecond(marker) === seconds);
      const exact = matches.find((marker) => String(marker.note || "").trim() === String(candidate.note || "").trim());
      if (exact) {
        stats.skipped += 1;
        continue;
      }
      const blank = matches.find((marker) => !String(marker.note || "").trim());
      const importedNote = String(candidate.note || "").trim();
      if (blank && importedNote) {
        blank.note = importedNote;
        stats.updated += 1;
        continue;
      }
      if (matches.length) {
        // TXT has no stable marker ID. Same media + same second with different non-empty notes is preserved as a conflict.
        stats.conflicts += 1;
        continue;
      }
      merged.push(candidate);
      stats.added += 1;
    }

    return { markers: merged, stats };
  }

  globalThis.__VTM_IMPORT__ = {
    parseTxt,
    buildMarkers,
    mergeMarkers,
    parseClockLine,
    normalizeCanonicalUrl,
    extractMediaId,
    mediaIdentity,
    timelineSecond
  };
})();
