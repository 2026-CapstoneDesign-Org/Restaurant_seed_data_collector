const { sanitizeText } = require("./utils");

const MAX_REASONABLE_MENU_PRICE = 10_000_000;
const BLOCKED_MENU_RAW_TYPES = new Set([
  "PlaceDetailBase",
  "BusStation",
  "InnerRoute",
  "BusinessTool",
  "SubwayStation",
  "SubwayStationInfo",
  "RelatedLink",
  "FsasReview",
  "InformationFacilities",
  "NewBusinessHour",
  "RestaurantSeatItems",
  "UgcImage",
]);
const BLOCKED_MENU_NAME_KEYWORDS = [
  "스마트콜",
  "에버라인",
  "정류장",
  "후문",
  "아파트",
  "마을회관",
  "시장약국",
  "헌혈의집",
  "급행",
  "거점",
  "예약",
  "식신",
  "다이닝코드",
  "네이버 주문",
  "네이버예약",
];

function toNullableNumber(value) {
  const normalized = String(value ?? "").replace(/[^\d.]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed < 0 || parsed > MAX_REASONABLE_MENU_PRICE) {
    return null;
  }

  return parsed;
}

function normalizeMenuName(value) {
  return sanitizeText(value)
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAlphaOrHangul(text) {
  return /[가-힣A-Za-z]/.test(sanitizeText(text));
}

function isDigitsOnlyText(text) {
  const normalized = sanitizeText(text).replace(/\s+/g, "");
  return Boolean(normalized) && /^\d[\d.-]*$/.test(normalized);
}

function shouldKeepMenu(menu, normalizedMenuName, options = {}) {
  const rawTypeName = sanitizeText(menu?.raw?.__typename);
  const placeName = normalizeMenuName(options.placeName);
  const priceText =
    sanitizeText(menu?.price_text || menu?.price || menu?.raw?.price) || "";
  const description =
    sanitizeText(menu?.description || menu?.raw?.description) || "";

  if (!normalizedMenuName) {
    return false;
  }

  if (!hasAlphaOrHangul(normalizedMenuName)) {
    return false;
  }

  if (isDigitsOnlyText(normalizedMenuName)) {
    return false;
  }

  if (BLOCKED_MENU_RAW_TYPES.has(rawTypeName)) {
    return false;
  }

  if (
    BLOCKED_MENU_NAME_KEYWORDS.some((keyword) =>
      normalizedMenuName.includes(keyword)
    )
  ) {
    return false;
  }

  if (placeName && normalizedMenuName === placeName) {
    return false;
  }

  if (!priceText && !description && normalizedMenuName.length <= 1) {
    return false;
  }

  return true;
}

function buildNormalizedMenuBase(menu, index, options = {}) {
  const menuName = normalizeMenuName(menu?.name || menu?.raw?.name);
  if (!shouldKeepMenu(menu, menuName, options)) {
    return null;
  }

  return {
    sourceMenuId: sanitizeText(menu?.id || menu?.raw?.id) || null,
    displayOrder: Number.isFinite(menu?.index) ? menu.index : index,
    menuName,
    priceText:
      sanitizeText(menu?.price_text || menu?.price || menu?.raw?.price) || null,
    priceValue: toNullableNumber(
      menu?.price_value ?? menu?.raw?.price ?? menu?.price
    ),
    description:
      sanitizeText(menu?.description || menu?.raw?.description) || null,
  };
}

function buildMenuPayload(menus, options = {}) {
  const normalizedMenus = (menus || [])
    .map((menu, index) => buildNormalizedMenuBase(menu, index, options))
    .filter(Boolean);

  return {
    menu_count: normalizedMenus.length,
    menus: normalizedMenus.map((menu) => ({
      index: menu.displayOrder,
      name: menu.menuName,
      price_text: menu.priceText,
      price_value: menu.priceValue,
      description: menu.description,
    })),
  };
}

module.exports = {
  buildMenuPayload,
  buildNormalizedMenuBase,
  normalizeMenuName,
  shouldKeepMenu,
  toNullableNumber,
};
