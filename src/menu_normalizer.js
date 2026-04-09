const { sanitizeText } = require("./utils");

function toNullableNumber(value) {
  const normalized = String(value ?? "").replace(/[^\d.]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMenuName(value) {
  return sanitizeText(value)
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildNormalizedMenuBase(menu, index) {
  const menuName = normalizeMenuName(menu?.name || menu?.raw?.name);
  if (!menuName) {
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

function buildMenuPayload(menus) {
  const normalizedMenus = (menus || [])
    .map((menu, index) => buildNormalizedMenuBase(menu, index))
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
  toNullableNumber,
};
