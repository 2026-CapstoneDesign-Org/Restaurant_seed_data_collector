const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.resolve(__dirname, "..", "output");

function loadDotEnv(filePath = path.resolve(__dirname, "..", ".env")) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  return OUTPUT_DIR;
}

function saveText(fileName, content) {
  ensureOutputDir();
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, String(content ?? ""), "utf8");
  return filePath;
}

function saveJson(fileName, value) {
  return saveText(fileName, `${JSON.stringify(value, null, 2)}\n`);
}

function stripHtmlTags(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return normalizeWhitespace(decodeHtmlEntities(stripHtmlTags(String(value))));
}

function normalizeBusinessName(value) {
  return sanitizeText(value).replace(/\s+/g, "").toLowerCase();
}

function formatWon(value) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) {
    return "";
  }

  return `${Number(digits).toLocaleString("ko-KR")}원`;
}

function buildSafeFileName(value, fallback = "pcmap-debug") {
  const sanitized = sanitizeText(value).replace(/[\\/:*?"<>|]/g, "-").trim();
  return sanitized || fallback;
}

module.exports = {
  OUTPUT_DIR,
  buildSafeFileName,
  decodeHtmlEntities,
  ensureOutputDir,
  formatWon,
  loadDotEnv,
  normalizeBusinessName,
  normalizeWhitespace,
  sanitizeText,
  saveJson,
  saveText,
  stripHtmlTags,
};
