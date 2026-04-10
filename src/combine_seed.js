const fs = require("fs");
const path = require("path");

const {
  findMatchedArea,
  getAreaSortOrder,
  getConfiguredAreaNames,
  normalizeAreaName,
} = require("./seed_config");
const {
  buildRestaurantTagPreview,
  buildTagSourceFromRestaurantRow,
  resolvePrimaryMenuTag,
} = require("./tag_extractor");
const {
  buildMenuPayload,
  buildNormalizedMenuBase,
  toNullableNumber,
} = require("./menu_normalizer");
const { buildRegionSchema } = require("./region_utils");
const { saveJson, sanitizeText } = require("./utils");

const OUTPUT_DIR = path.resolve(__dirname, "..", "output");
const RESTAURANTS_PREVIEW_SUFFIX = "-restaurants-seed-preview.json";
const CATEGORIES_PREVIEW_SUFFIX = "-restaurant-categories-seed-preview.json";
const AREA_RESULT_SUFFIX = "-pcmap-area-seed-result.json";
const GENERIC_RESTAURANTS_PREVIEW = "restaurants-seed-preview.json";
const GENERIC_CATEGORIES_PREVIEW = "restaurant-categories-seed-preview.json";
const GENERIC_MENU_ITEMS_PREVIEW = "restaurant-menu-items-seed-preview.json";
const GENERIC_TAGS_PREVIEW = "tags-seed-preview.json";
const GENERIC_RESTAURANT_TAGS_PREVIEW = "restaurant-tags-seed-preview.json";
const GENERIC_TAG_VALIDATION_REPORT = "tag-validation-report.json";
const GENERIC_AREA_RESULT = "pcmap-area-seed-result.json";

function normalizeKey(value) {
  return sanitizeText(value).replace(/\s+/g, "").toLowerCase();
}

function listSeedPreviewPairs() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    return [];
  }

  const fileNames = fs.readdirSync(OUTPUT_DIR);
  const pairs = fileNames
    .filter((fileName) => fileName.endsWith(RESTAURANTS_PREVIEW_SUFFIX))
    .map((restaurantsFileName) => {
      const areaName = restaurantsFileName.slice(
        0,
        -RESTAURANTS_PREVIEW_SUFFIX.length
      );
      const categoriesFileName = `${areaName}${CATEGORIES_PREVIEW_SUFFIX}`;

      if (!areaName || !fileNames.includes(categoriesFileName)) {
        return null;
      }

      return {
        areaName,
        restaurantsPath: path.join(OUTPUT_DIR, restaurantsFileName),
        categoriesPath: path.join(OUTPUT_DIR, categoriesFileName),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const sortDiff =
        getAreaSortOrder(normalizeAreaName(left.areaName)) -
        getAreaSortOrder(normalizeAreaName(right.areaName));

      if (sortDiff !== 0) {
        return sortDiff;
      }

      return left.areaName.localeCompare(right.areaName, "ko");
    });

  if (pairs.length > 0) {
    return pairs;
  }

  const genericRestaurantsPath = path.join(OUTPUT_DIR, GENERIC_RESTAURANTS_PREVIEW);
  const genericCategoriesPath = path.join(OUTPUT_DIR, GENERIC_CATEGORIES_PREVIEW);

  if (fs.existsSync(genericRestaurantsPath) && fs.existsSync(genericCategoriesPath)) {
    return [
      {
        areaName: "current-run",
        restaurantsPath: genericRestaurantsPath,
        categoriesPath: genericCategoriesPath,
        isGeneric: true,
      },
    ];
  }

  return [];
}

function listAreaSeedResultPaths() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    return [];
  }

  const fileNames = fs.readdirSync(OUTPUT_DIR);
  const areaPaths = fileNames
    .filter((fileName) => fileName.endsWith(AREA_RESULT_SUFFIX))
    .map((fileName) => ({
      areaName: fileName.slice(0, -AREA_RESULT_SUFFIX.length),
      resultPath: path.join(OUTPUT_DIR, fileName),
    }))
    .filter((item) => item.areaName);

  const genericPath = path.join(OUTPUT_DIR, GENERIC_AREA_RESULT);
  if (fs.existsSync(genericPath)) {
    areaPaths.push({
      areaName: "current-run",
      resultPath: genericPath,
      isGeneric: true,
    });
  }

  return areaPaths;
}

function loadJsonArray(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) {
    return [];
  }

  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : [];
}

function loadJsonObject(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) {
    return null;
  }

  const parsed = JSON.parse(content);
  return parsed && typeof parsed === "object" ? parsed : null;
}

function buildStoreQualityScore(store) {
  const menus = Array.isArray(store?.menus) ? store.menus.length : 0;
  return (
    menus * 10 +
    (sanitizeText(store?.imageUrl) ? 5 : 0) +
    (sanitizeText(store?.telephone) ? 3 : 0) +
    (sanitizeText(store?.roadAddress) ? 3 : 0) +
    (sanitizeText(store?.address) ? 2 : 0) +
    (sanitizeText(store?.description) ? 1 : 0)
  );
}

function loadAreaStoresByPlaceId() {
  const storesByPlaceId = new Map();

  for (const { resultPath } of listAreaSeedResultPaths()) {
    const result = loadJsonObject(resultPath);
    const stores = Array.isArray(result?.stores) ? result.stores : [];

    for (const store of stores) {
      const placeId = sanitizeText(store?.placeId);
      if (!placeId) {
        continue;
      }

      const existing = storesByPlaceId.get(placeId);
      if (!existing || buildStoreQualityScore(store) > buildStoreQualityScore(existing)) {
        storesByPlaceId.set(placeId, store);
      }
    }
  }

  return storesByPlaceId;
}

function buildRestaurantDedupKey(restaurantRow) {
  const placeId = sanitizeText(
    restaurantRow?.pcmap_place_id || restaurantRow?.source_place_id
  );
  if (placeId) {
    return `place:${placeId}`;
  }

  const nameKey = normalizeKey(restaurantRow?.name);
  const addressKey = normalizeKey(restaurantRow?.address);

  if (nameKey && addressKey) {
    return `${nameKey}::${addressKey}`;
  }

  const latKey = normalizeKey(restaurantRow?.lat);
  const lngKey = normalizeKey(restaurantRow?.lng);

  if (nameKey && (latKey || lngKey)) {
    return `${nameKey}::${latKey}:${lngKey}`;
  }

  return `${nameKey || "unknown"}::${Date.now()}`;
}

function normalizeCategoryName(value) {
  return sanitizeText(value) || "기타";
}

function isRestaurantRowInConfiguredArea(restaurantRow) {
  return Boolean(
    findMatchedArea(
      restaurantRow?.address,
      getConfiguredAreaNames()
    )
  );
}

function buildRestaurantQualityScore(restaurantRow) {
  const menuCount = Array.isArray(restaurantRow?.menu_json?.menus)
    ? restaurantRow.menu_json.menus.length
    : Number(restaurantRow?.menu_json?.menu_count || 0);

  return (
    menuCount * 10 +
    (sanitizeText(restaurantRow?.image_url) ? 5 : 0) +
    (restaurantRow?.lat != null && restaurantRow?.lng != null ? 4 : 0) +
    (sanitizeText(restaurantRow?.address) ? 3 : 0) +
    (sanitizeText(restaurantRow?.pcmap_place_id) ? 3 : 0)
  );
}

function buildSimplifiedMenuPayload(restaurantRow, store) {
  const rawMenus = Array.isArray(restaurantRow?.menu_json?.menus)
    ? restaurantRow.menu_json.menus
    : Array.isArray(store?.menus)
    ? store.menus
    : [];

  const payload = buildMenuPayload(rawMenus);

  return {
    source: sanitizeText(restaurantRow?.menu_json?.source || "pcmap"),
    place_id: sanitizeText(
      restaurantRow?.menu_json?.place_id ||
        restaurantRow?.pcmap_place_id ||
        restaurantRow?.source_place_id ||
        store?.placeId
    ),
    ...payload,
  };
}

function normalizeRestaurantRow(
  restaurantRow,
  categoryRow,
  areaName,
  storesByPlaceId
) {
  const placeId = sanitizeText(
    restaurantRow?.pcmap_place_id || restaurantRow?.source_place_id
  );
  const store = placeId ? storesByPlaceId.get(placeId) : null;
  const adminArea =
    normalizeAreaName(store?.adminArea) ||
    normalizeAreaName(areaName === "current-run" ? "" : areaName);
  const menuJson = buildSimplifiedMenuPayload(restaurantRow, store);
  const regionSchema = buildRegionSchema(
    adminArea,
    store?.address,
    restaurantRow?.address,
    store?.fullAddress,
    store?.roadAddress,
    restaurantRow?.region_name
  );
  const regionName = sanitizeText(
    regionSchema.regionName || store?.regionName || restaurantRow?.region_name
  );
  const regionFilterNames =
    Array.isArray(restaurantRow?.region_filter_names) &&
    restaurantRow.region_filter_names.length > 0
      ? restaurantRow.region_filter_names
      : Array.isArray(store?.regionFilterNames) && store.regionFilterNames.length > 0
      ? store.regionFilterNames
      : regionSchema.regionFilterNames;

  return {
    dedupKey: buildRestaurantDedupKey(restaurantRow),
    categoryName: normalizeCategoryName(
      categoryRow?.category_name || store?.broadCategory || store?.category
    ),
    sourceArea: sanitizeText(areaName),
    row: {
      seed_index: 0,
      source_place_id: sanitizeText(
        restaurantRow?.source_place_id || restaurantRow?.pcmap_place_id || placeId
      ),
      address: sanitizeText(
        restaurantRow?.address || store?.fullAddress || store?.roadAddress || store?.address
      ),
      created_at: sanitizeText(restaurantRow?.created_at) || "NOW()",
      deleted_at: restaurantRow?.deleted_at ?? null,
      image_url: sanitizeText(restaurantRow?.image_url || store?.imageUrl) || null,
      is_deleted: Boolean(restaurantRow?.is_deleted),
      is_hidden: Boolean(restaurantRow?.is_hidden),
      lat: restaurantRow?.lat ?? toNullableNumber(store?.y),
      lng: restaurantRow?.lng ?? toNullableNumber(store?.x),
      name: sanitizeText(restaurantRow?.name || store?.name),
      region_name: regionName,
      region_city_name: sanitizeText(
        restaurantRow?.region_city_name ||
          store?.regionCityName ||
          regionSchema.regionCityName
      ) || null,
      region_district_name: sanitizeText(
        restaurantRow?.region_district_name ||
          store?.regionDistrictName ||
          regionSchema.regionDistrictName
      ) || null,
      region_county_name: sanitizeText(
        restaurantRow?.region_county_name ||
          store?.regionCountyName ||
          regionSchema.regionCountyName
      ) || null,
      region_filter_names: regionFilterNames,
      updated_at: sanitizeText(restaurantRow?.updated_at) || "NOW()",
      pcmap_place_id: placeId || null,
      menu_json: menuJson,
      menu_updated_at: sanitizeText(restaurantRow?.menu_updated_at) || "NOW()",
    },
  };
}

function buildCombinedRestaurantMenuItems(normalizedRows) {
  return normalizedRows.flatMap((item, index) =>
    (Array.isArray(item.row?.menu_json?.menus) ? item.row.menu_json.menus : [])
      .map((menu, menuIndex) => {
        const normalizedMenu = buildNormalizedMenuBase(menu, menuIndex);
        if (!normalizedMenu) {
          return null;
        }

        const primaryMenuTag = resolvePrimaryMenuTag(normalizedMenu.menuName);

        return {
          seed_index: `${index + 1}-${menuIndex + 1}`,
          restaurant_seed_index: index + 1,
          display_order: normalizedMenu.displayOrder,
          source_menu_id: normalizedMenu.sourceMenuId,
          menu_name: normalizedMenu.menuName,
          normalized_menu_name: primaryMenuTag
            ? primaryMenuTag.tagName
            : normalizedMenu.menuName,
          menu_tag_key: primaryMenuTag ? primaryMenuTag.tagKey : null,
          price_text: normalizedMenu.priceText,
          price_value: normalizedMenu.priceValue,
          description: normalizedMenu.description,
          created_at: "NOW()",
          updated_at: "NOW()",
        };
      })
      .filter(Boolean)
  );
}

function buildCombinedSeedPreview() {
  const pairs = listSeedPreviewPairs();
  const storesByPlaceId = loadAreaStoresByPlaceId();
  const combinedByDedupKey = new Map();
  const duplicates = [];

  for (const pair of pairs) {
    const restaurantRows = loadJsonArray(pair.restaurantsPath);
    const categoryRows = loadJsonArray(pair.categoriesPath);
    const categoryBySeedIndex = new Map(
      categoryRows.map((categoryRow) => [
        Number(categoryRow?.restaurant_seed_index),
        categoryRow,
      ])
    );

    for (const restaurantRow of restaurantRows) {
      const normalized = normalizeRestaurantRow(
        restaurantRow,
        categoryBySeedIndex.get(Number(restaurantRow?.seed_index)),
        pair.areaName,
        storesByPlaceId
      );

      if (!isRestaurantRowInConfiguredArea(normalized.row)) {
        continue;
      }

      const existing = combinedByDedupKey.get(normalized.dedupKey);

      if (!existing) {
        combinedByDedupKey.set(normalized.dedupKey, normalized);
        continue;
      }

      const keepIncoming =
        buildRestaurantQualityScore(normalized.row) >
        buildRestaurantQualityScore(existing.row);
      const preferred = keepIncoming ? normalized : existing;
      const discarded = keepIncoming ? existing : normalized;

      combinedByDedupKey.set(normalized.dedupKey, preferred);
      duplicates.push({
        dedup_key: normalized.dedupKey,
        kept_place_id: sanitizeText(preferred.row.pcmap_place_id),
        discarded_place_id: sanitizeText(discarded.row.pcmap_place_id),
        kept_name: sanitizeText(preferred.row.name),
        discarded_name: sanitizeText(discarded.row.name),
        kept_area: preferred.sourceArea,
        discarded_area: discarded.sourceArea,
      });
    }
  }

  const normalizedRows = Array.from(combinedByDedupKey.values()).sort((left, right) => {
    const sortDiff =
      getAreaSortOrder(normalizeAreaName(left.sourceArea)) -
      getAreaSortOrder(normalizeAreaName(right.sourceArea));

    if (sortDiff !== 0) {
      return sortDiff;
    }

    return sanitizeText(left.row.name).localeCompare(sanitizeText(right.row.name), "ko");
  });

  const restaurants = normalizedRows.map((item, index) => ({
    ...item.row,
    seed_index: index + 1,
  }));

  const restaurantCategories = normalizedRows.map((item, index) => ({
    seed_index: index + 1,
    restaurant_seed_index: index + 1,
    category_name: item.categoryName,
    created_at: "NOW()",
    updated_at: "NOW()",
  }));

  const restaurantMenuItems = buildCombinedRestaurantMenuItems(normalizedRows);

  const tagPreview = buildRestaurantTagPreview(
    normalizedRows.map((item, index) =>
      buildTagSourceFromRestaurantRow({
        restaurantSeedIndex: index + 1,
        restaurantRow: {
          ...item.row,
          seed_index: index + 1,
        },
        categoryRow: {
          category_name: item.categoryName,
        },
        store: item.row.pcmap_place_id
          ? storesByPlaceId.get(item.row.pcmap_place_id)
          : null,
      })
    )
  );

  return {
    areaNames: pairs.map((pair) => pair.areaName),
    restaurants,
    restaurantCategories,
    restaurantMenuItems,
    tags: tagPreview.tags,
    restaurantTags: tagPreview.restaurantTags,
    tagValidationReport: tagPreview.validationReport,
    tagCandidateReport: tagPreview.candidateReport,
    duplicates,
  };
}

function runCombineSeedPreviewExport() {
  const combined = buildCombinedSeedPreview();
  const menuMappedCount = combined.restaurants.filter(
    (restaurantRow) =>
      Array.isArray(restaurantRow?.menu_json?.menus) &&
      restaurantRow.menu_json.menus.length > 0
  ).length;

  const summary = {
    generated_at: new Date().toISOString(),
    area_count: combined.areaNames.length,
    area_names: combined.areaNames,
    restaurant_count: combined.restaurants.length,
    category_count: combined.restaurantCategories.length,
    menu_item_count: combined.restaurantMenuItems.length,
    tag_count: combined.tags.length,
    restaurant_tag_count: combined.restaurantTags.length,
    duplicate_count: combined.duplicates.length,
    menu_mapped_count: menuMappedCount,
    tag_validation_report: combined.tagValidationReport,
    tag_candidate_report: combined.tagCandidateReport,
    input_pairs: listSeedPreviewPairs().map((pair) => ({
      area_name: pair.areaName,
      restaurants_path: pair.restaurantsPath,
      categories_path: pair.categoriesPath,
    })),
  };

  const restaurantsPreviewPath = saveJson(
    GENERIC_RESTAURANTS_PREVIEW,
    combined.restaurants
  );
  const categoriesPreviewPath = saveJson(
    GENERIC_CATEGORIES_PREVIEW,
    combined.restaurantCategories
  );
  const menuItemsPreviewPath = saveJson(
    GENERIC_MENU_ITEMS_PREVIEW,
    combined.restaurantMenuItems
  );
  const tagsPreviewPath = saveJson(GENERIC_TAGS_PREVIEW, combined.tags);
  const restaurantTagsPreviewPath = saveJson(
    GENERIC_RESTAURANT_TAGS_PREVIEW,
    combined.restaurantTags
  );
  const tagValidationReportPath = saveJson(
    GENERIC_TAG_VALIDATION_REPORT,
    combined.tagValidationReport
  );
  const tagCandidateReportPath = saveJson(
    "tag-candidate-report.json",
    combined.tagCandidateReport
  );
  const duplicatesPath = saveJson(
    "combined-seed-duplicates.json",
    combined.duplicates
  );
  const summaryPath = saveJson("combined-seed-summary.json", summary);

  return {
    areaCount: combined.areaNames.length,
    restaurantCount: combined.restaurants.length,
    categoryCount: combined.restaurantCategories.length,
    menuItemCount: combined.restaurantMenuItems.length,
    duplicateCount: combined.duplicates.length,
    menuMappedCount,
    restaurantsPreviewPath,
    categoriesPreviewPath,
    menuItemsPreviewPath,
    tagsPreviewPath,
    restaurantTagsPreviewPath,
    tagValidationReportPath,
    tagCandidateReportPath,
    duplicatesPath,
    summaryPath,
  };
}

module.exports = {
  runCombineSeedPreviewExport,
};
