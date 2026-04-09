const { sanitizeText } = require("./utils");

// Single source of truth for seed collection.
// Add a new area here and the rest of the pipeline follows automatically.
//
// Examples
//   "망포동"
//   { name: "김량장동", aliases: ["중앙동"] }
//
// When the address text may contain another administrative name,
// put that alternate name into aliases.
const RAW_AREA_CONFIGS = ["역북동", "삼가동", "남동", "김량장동", "서리"];

const DEFAULT_SEARCH_KEYWORDS = [
  "한식",
  "카페",
  "술집",
  "맛집",
  "중식",
  "일식",
  "양식",
  "분식",
  "국밥",
  "고깃집",
  "치킨",
  "피자",
  "햄버거",
  "샌드위치",
  "베이커리",
  "초밥",
  "국수",
  "칼국수",
  "만두",
];

function normalizeAreaConfig(areaConfig) {
  if (typeof areaConfig === "string") {
    return {
      name: sanitizeText(areaConfig),
      aliases: [],
    };
  }

  const name = sanitizeText(areaConfig?.name);
  const aliases = Array.isArray(areaConfig?.aliases)
    ? areaConfig.aliases
        .map((alias) => sanitizeText(alias))
        .filter((alias) => alias && alias !== name)
    : [];

  return {
    name,
    aliases: Array.from(new Set(aliases)),
  };
}

const AREA_CONFIGS = RAW_AREA_CONFIGS.map(normalizeAreaConfig).filter(
  (areaConfig) => areaConfig.name
);

function parseCsvList(value) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(/[,\n]/)
        .map((item) => sanitizeText(item))
        .filter(Boolean)
    )
  );
}

function getConfiguredAreaNames() {
  return AREA_CONFIGS.map((areaConfig) => areaConfig.name);
}

function getConfiguredSearchKeywords() {
  return [...DEFAULT_SEARCH_KEYWORDS];
}

function getAreaAliases(areaName) {
  const matched = AREA_CONFIGS.find(
    (areaConfig) => areaConfig.name === normalizeAreaName(areaName)
  );
  return matched ? [...matched.aliases] : [];
}

function normalizeAreaName(value) {
  return sanitizeText(value);
}

function findMatchedArea(text, requestedAreaNames = getConfiguredAreaNames()) {
  const normalizedText = sanitizeText(text);
  if (!normalizedText) {
    return "";
  }

  const allowedAreaNames = new Set(
    requestedAreaNames.map((areaName) => normalizeAreaName(areaName))
  );

  for (const areaConfig of AREA_CONFIGS) {
    if (!allowedAreaNames.has(areaConfig.name)) {
      continue;
    }

    if (normalizedText.includes(areaConfig.name)) {
      return areaConfig.name;
    }

    if (areaConfig.aliases.some((alias) => normalizedText.includes(alias))) {
      return areaConfig.name;
    }
  }

  return "";
}

function resolveRequestedAreaNames(value) {
  const requested = parseCsvList(value);
  if (!requested.length) {
    return getConfiguredAreaNames();
  }

  const resolved = [];

  for (const item of requested) {
    const matchedArea = findMatchedArea(item);
    if (matchedArea) {
      resolved.push(matchedArea);
      continue;
    }

    const normalizedItem = normalizeAreaName(item);
    if (getConfiguredAreaNames().includes(normalizedItem)) {
      resolved.push(normalizedItem);
    }
  }

  return Array.from(new Set(resolved));
}

function getAreaSortOrder(areaName) {
  const normalizedAreaName = normalizeAreaName(areaName);
  const index = AREA_CONFIGS.findIndex(
    (areaConfig) => areaConfig.name === normalizedAreaName
  );

  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function buildAreaConfigSummary() {
  return AREA_CONFIGS.map((areaConfig, index) => ({
    name: areaConfig.name,
    aliases: [...areaConfig.aliases],
    sortOrder: index + 1,
  }));
}

module.exports = {
  AREA_CONFIGS,
  DEFAULT_SEARCH_KEYWORDS,
  RAW_AREA_CONFIGS,
  buildAreaConfigSummary,
  findMatchedArea,
  getAreaAliases,
  getAreaSortOrder,
  getConfiguredAreaNames,
  getConfiguredSearchKeywords,
  normalizeAreaConfig,
  normalizeAreaName,
  parseCsvList,
  resolveRequestedAreaNames,
};
