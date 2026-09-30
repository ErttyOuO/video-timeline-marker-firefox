const KEY = "vtm_markers_v1";
const IMPORT_REPORT_KEY = "vtm_last_import_report_v1";
const t = (key, substitutions) => browser.i18n.getMessage(key, substitutions) || key;
const importUtils = globalThis.__VTM_IMPORT__;

function applyLocale() {
  const language = browser.i18n.getUILanguage?.() || navigator.language || "en";
  document.documentElement.lang = language;
  document.title = t("importPageTitle");
  document.getElementById("import-page-title").textContent = t("importPageTitle");
  document.getElementById("import-page-subtitle").textContent = t("extensionName");
  document.getElementById("import-page-description").textContent = t("importPageDescription");
  document.getElementById("import-page-supported").textContent = t("importPageSupported");
  document.getElementById("choose-files").textContent = t("importChooseFiles");
  document.getElementById("close-window").textContent = t("importCloseWindow");
  document.getElementById("import-report-details-label").textContent = t("importDetails");
}

async function getAll() {
  const result = await browser.storage.local.get(KEY);
  return Array.isArray(result[KEY]) ? result[KEY] : [];
}

async function setAll(markers) {
  await browser.storage.local.set({ [KEY]: markers });
}

function importErrorReason(error) {
  const code = String(error?.code || "");
  if (code === "EMPTY_FILE") return t("importErrorEmptyFile");
  if (code === "NO_TIMESTAMPS") return t("importErrorNoTimestamps");
  if (code === "NO_MARKERS") return t("importErrorNoMarkers");
  return t("importErrorGeneric", [String(error?.message || error || "Unknown error")]);
}

function importFormatLabel(format) {
  if (format === "legacy") return t("importFormatLegacy");
  if (format === "compatible") return t("importFormatCompatible");
  return t("importFormatCurrent");
}

function importWarningLabel(code) {
  if (code === "MISSING_URL") return t("importWarningMissingUrl");
  if (code === "UNKNOWN_PLATFORM") return t("importWarningUnknownPlatform");
  if (code === "MISSING_TITLE") return t("importWarningMissingTitle");
  return code;
}

function reportSeverity(report) {
  if (report.storageError || !report.successFiles) return "error";
  if (report.failedFiles || report.totals.conflicts || report.warningCount) return "warning";
  return "success";
}

function showProgress(message) {
  const node = document.getElementById("import-progress");
  node.textContent = message || "";
  node.hidden = !message;
}

function showImportReport(report) {
  const panel = document.getElementById("import-report");
  const title = document.getElementById("import-report-title");
  const summary = document.getElementById("import-report-summary");
  const details = document.getElementById("import-report-details");
  const filesContainer = document.getElementById("import-report-files");
  if (!report) {
    panel.hidden = true;
    filesContainer.replaceChildren();
    return;
  }

  const severity = reportSeverity(report);
  panel.hidden = false;
  panel.dataset.state = severity;
  title.textContent = severity === "error"
    ? `✕ ${t("importResultErrorTitle")}`
    : severity === "warning"
      ? `⚠ ${t("importResultWarningTitle")}`
      : `✓ ${t("importResultSuccessTitle")}`;

  summary.textContent = report.storageError
    ? t("importStorageFailureSummary", [report.storageError])
    : t("importResultSummary", [
        String(report.files.length),
        String(report.totals.parsed),
        String(report.totals.added),
        String(report.totals.updated),
        String(report.totals.skipped),
        String(report.totals.conflicts),
        String(report.failedFiles)
      ]);

  filesContainer.replaceChildren();
  for (const file of report.files) {
    const item = document.createElement("div");
    item.className = `import-file-result ${file.ok ? "is-ok" : "is-failed"}`;
    const name = document.createElement("strong");
    name.textContent = `${file.ok ? "✓" : "✕"} ${file.name}`;
    item.appendChild(name);

    const line = document.createElement("div");
    line.className = "import-file-summary";
    if (file.ok) {
      line.textContent = t("importFileSuccess", [
        importFormatLabel(file.format),
        String(file.parsed),
        String(file.stats.added),
        String(file.stats.updated),
        String(file.stats.skipped),
        String(file.stats.conflicts)
      ]);
    } else {
      line.textContent = t("importFileFailed", [file.reason || t("importErrorUnknown")]);
    }
    item.appendChild(line);

    if (file.warnings?.length) {
      const warningList = document.createElement("ul");
      warningList.className = "import-warnings";
      for (const warning of file.warnings) {
        const li = document.createElement("li");
        li.textContent = importWarningLabel(warning);
        warningList.appendChild(li);
      }
      item.appendChild(warningList);
    }
    filesContainer.appendChild(item);
  }
  details.open = true;
}

async function persistImportReport(report) {
  await browser.storage.local.set({ [IMPORT_REPORT_KEY]: report });
}

async function loadPreviousReport() {
  const result = await browser.storage.local.get(IMPORT_REPORT_KEY);
  showImportReport(result[IMPORT_REPORT_KEY] || null);
}

async function importTxtFiles(files) {
  if (!importUtils) throw new Error("Import utilities unavailable");

  let working = await getAll();
  let baseTime = Date.now();
  const report = {
    version: 1,
    createdAt: new Date().toISOString(),
    files: [],
    successFiles: 0,
    failedFiles: 0,
    warningCount: 0,
    storageError: null,
    totals: { parsed: 0, added: 0, updated: 0, skipped: 0, conflicts: 0 }
  };

  for (const file of files) {
    try {
      const text = await file.text();
      const parsed = importUtils.parseTxt(text, file.name);
      const incoming = importUtils.buildMarkers(parsed, baseTime);
      baseTime += incoming.length + 1;
      const merged = importUtils.mergeMarkers(working, incoming);
      working = merged.markers;

      report.successFiles += 1;
      report.warningCount += parsed.warnings?.length || 0;
      report.totals.parsed += incoming.length;
      report.totals.added += merged.stats.added;
      report.totals.updated += merged.stats.updated;
      report.totals.skipped += merged.stats.skipped;
      report.totals.conflicts += merged.stats.conflicts;
      report.files.push({
        name: file.name,
        ok: true,
        format: parsed.format,
        parsed: incoming.length,
        warnings: parsed.warnings || [],
        stats: merged.stats
      });
    } catch (error) {
      report.failedFiles += 1;
      report.files.push({
        name: file.name,
        ok: false,
        reason: importErrorReason(error),
        errorCode: error?.code || "UNKNOWN",
        warnings: []
      });
    }
  }

  if (report.successFiles) {
    try {
      await setAll(working);
    } catch (error) {
      report.storageError = t("importErrorStorage", [String(error?.message || error)]);
    }
  }

  await persistImportReport(report);
  showProgress("");
  showImportReport(report);
}

document.getElementById("choose-files").addEventListener("click", () => {
  document.getElementById("import-files").click();
});

document.getElementById("import-files").addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  if (!files.length) return;
  showProgress(t("importing"));
  try {
    await importTxtFiles(files);
  } catch (error) {
    console.error("[VTM] import page failed", error);
    const report = {
      version: 1,
      createdAt: new Date().toISOString(),
      files: files.map((file) => ({ name: file.name, ok: false, reason: importErrorReason(error), warnings: [] })),
      successFiles: 0,
      failedFiles: files.length,
      warningCount: 0,
      storageError: null,
      totals: { parsed: 0, added: 0, updated: 0, skipped: 0, conflicts: 0 }
    };
    await persistImportReport(report);
    showProgress("");
    showImportReport(report);
  }
});

document.getElementById("close-window").addEventListener("click", () => window.close());

applyLocale();
loadPreviousReport().catch((error) => console.error("[VTM] could not load previous import report", error));
