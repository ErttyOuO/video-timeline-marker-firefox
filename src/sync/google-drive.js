(() => {
  const root = globalThis;
  const ns = root.__VTM_SYNC__ = root.__VTM_SYNC__ || {};
  const API_ROOT = "https://www.googleapis.com/drive/v3";
  const UPLOAD_ROOT = "https://www.googleapis.com/upload/drive/v3";
  const FILE_NAME = "video-timeline-marker-sync.json";

  async function authorizedFetch(url, options = {}, retryAuth = true) {
    const token = await ns.auth.getAccessToken();
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 && retryAuth) {
      ns.auth.invalidateAccessToken();
      const refreshed = await ns.auth.getAccessToken({ forceRefresh: true });
      const retryHeaders = new Headers(options.headers || {});
      retryHeaders.set("Authorization", `Bearer ${refreshed}`);
      return fetch(url, { ...options, headers: retryHeaders });
    }
    return response;
  }

  async function parseError(response, fallbackCode) {
    let details = null;
    try {
      details = await response.json();
    } catch {
      try {
        details = await response.text();
      } catch {}
    }
    const message = details?.error?.message || details?.error_description || details?.error || fallbackCode || `http_${response.status}`;
    const error = new Error(typeof message === "string" ? message : JSON.stringify(message));
    error.code = response.status === 412 ? "precondition_failed" : (fallbackCode || `http_${response.status}`);
    error.httpStatus = response.status;
    error.details = details;
    return error;
  }

  async function listSyncFiles() {
    const params = new URLSearchParams({
      spaces: "appDataFolder",
      q: `name='${FILE_NAME}' and trashed=false`,
      fields: "files(id,name,modifiedTime,size,version,md5Checksum)",
      pageSize: "20"
    });
    const response = await authorizedFetch(`${API_ROOT}/files?${params}`);
    if (!response.ok) throw await parseError(response, "drive_list_failed");
    const payload = await response.json();
    return Array.isArray(payload.files) ? payload.files : [];
  }

  async function getMetadata(fileId) {
    const params = new URLSearchParams({ fields: "id,name,modifiedTime,size,version,md5Checksum" });
    const response = await authorizedFetch(`${API_ROOT}/files/${encodeURIComponent(fileId)}?${params}`);
    if (!response.ok) throw await parseError(response, "drive_metadata_failed");
    const metadata = await response.json();
    metadata.etag = response.headers.get("etag") || null;
    return metadata;
  }

  async function downloadJson(fileId) {
    const response = await authorizedFetch(`${API_ROOT}/files/${encodeURIComponent(fileId)}?alt=media`);
    if (!response.ok) throw await parseError(response, "drive_download_failed");
    const etag = response.headers.get("etag") || null;
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      const parseError = new Error("cloud_json_invalid");
      parseError.code = "cloud_json_invalid";
      parseError.cause = error;
      throw parseError;
    }
    return { payload, etag };
  }

  async function readSyncFile() {
    const files = await listSyncFiles();
    if (!files.length) {
      return { exists: false, duplicates: 0, file: null, payload: null, etag: null, sources: [] };
    }

    files.sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0));
    const sources = [];
    for (const listedFile of files) {
      const [metadata, content] = await Promise.all([getMetadata(listedFile.id), downloadJson(listedFile.id)]);
      sources.push({
        file: { ...listedFile, ...metadata },
        payload: content.payload,
        etag: content.etag || metadata.etag || null
      });
    }

    // The newest file is the primary write target, but every same-name file is
    // returned so the sync engine can merge first-sync races without losing data.
    const primary = sources[0];
    return {
      exists: true,
      duplicates: Math.max(0, sources.length - 1),
      file: primary.file,
      payload: primary.payload,
      etag: primary.etag,
      sources
    };
  }

  async function createSyncFile(payload) {
    const createResponse = await authorizedFetch(`${API_ROOT}/files?fields=id,name,modifiedTime,size,version`, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify({
        name: FILE_NAME,
        mimeType: "application/json",
        parents: ["appDataFolder"],
        appProperties: { app: "video-timeline-marker", schema: "1" }
      })
    });
    if (!createResponse.ok) throw await parseError(createResponse, "drive_create_failed");
    const file = await createResponse.json();
    await updateSyncFile(file.id, payload, null);
    return file;
  }

  async function updateSyncFile(fileId, payload, etag = null) {
    const headers = new Headers({ "Content-Type": "application/json;charset=UTF-8" });
    if (etag) headers.set("If-Match", etag);
    const response = await authorizedFetch(
      `${UPLOAD_ROOT}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,modifiedTime,size,version,md5Checksum`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload)
      }
    );
    if (!response.ok) throw await parseError(response, "drive_update_failed");
    return response.json();
  }

  ns.drive = {
    FILE_NAME,
    listSyncFiles,
    readSyncFile,
    createSyncFile,
    updateSyncFile
  };
})();
