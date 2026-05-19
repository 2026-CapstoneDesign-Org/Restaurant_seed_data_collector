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
const { buildNormalizedMenuBase, toNullableNumber } = require("./menu_normalizer");
const { buildRegionSchema } = require("./region_utils");
const { saveJson, sanitizeText } = require("./utils");

const OUTPUT_DIR = path.resolve(__dirname, "..", "output");
const RESTAURANTS_PREVIEW_SUFFIX = "-restaurants-seed-preview.json";
const AREA_RESULT_SUFFIX = "-pcmap-area-seed-result.json";
const GENERIC_RESTAURANTS_PREVIEW = "restaurants-seed-preview.json";
const GENERIC_MENU_ITEMS_PREVIEW = "restaurant-menu-items-seed-preview.json";
const GENERIC_TAGS_PREVIEW = "tags-seed-preview.json";
const GENERIC_RESTAURANT_TAGS_PREVIEW = "restaurant-tags-seed-preview.json";
const GENERIC_TAG_VALIDATION_REPORT = "tag-validation-report.json";
const GENERIC_TAG_CANDIDATE_REPORT = "tag-candidate-report.json";
const GENERIC_AREA_RESULT = "pcmap-area-seed-result.json";

function normalizeKey(value) {
  return sanitizeText(value).replace(/\s+/g, "").toLowerCase();
}

function listRestaurantPreviewFiles() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    return [];
  }

  const fileNames = fs.readdirSync(OUTPUT_DIR);
  const items = fileNames
    .filter((fileName) => fileName.endsWith(RESTAURANTS_PREVIEW_SUFFIX))
    .map((restaurantsFileName) => ({
      areaName: restaurantsFileName.slice(0, -RESTAURANTS_PREVIEW_SUFFIX.length),
      restaurantsPath: path.join(OUTPUT_DIR, restaurantsFileName),
    }))
    .filter((item) => item.areaName)
    .sort((left, right) => {
      const sortDiff =
        getAreaSortOrder(normalizeAreaName(left.areaName)) -
        getAreaSortOrder(normalizeAreaName(right.areaName));

      if (sortDiff !== 0) {
        return sortDiff;
      }

      return left.areaName.localeCompare(right.areaName, "ko");
    });

  if (items.length > 0) {
    return items;
  }

  const genericRestaurantsPath = path.join(OUTPUT_DIR, GENERIC_RESTAURANTS_PREVIEW);
  if (!fs.existsSync(genericRestaurantsPath)) {
    return [];
  }

  return [
    {
      areaName: "current-run",
      restaurantsPath: genericRestaurantsPath,
      isGeneric: true,
    },
  ];
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
  const addressKey = normalizeKey(
    restaurantRow?.road_address || restaurantRow?.address
  );

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
  return sanitizeText(value) || "category-other";
}

const PRIMARY_CATEGORY_RULES = [
  ["중식", ["중식", "중국", "짜장", "짬뽕", "마라", "양꼬치"]],
  ["일식", ["일식", "초밥", "스시", "라멘", "우동", "소바", "돈가스", "돈까스", "카츠", "생선회", "이자카야"]],
  ["양식", ["양식", "파스타", "스파게티", "스테이크", "피자", "햄버거", "버거", "샌드위치", "브런치", "타코", "멕시코"]],
  ["분식", ["분식", "김밥", "떡볶이", "순대", "튀김"]],
  ["카페/디저트", ["카페", "커피", "디저트", "베이커리", "빵", "케이크", "와플"]],
  ["치킨", ["치킨", "닭강정"]],
  ["술집", ["술집", "주점", "호프", "맥주", "바"]],
  ["한식", ["한식", "국밥", "찌개", "탕", "해장국", "고기", "구이", "갈비", "삼겹살", "보쌈", "족발", "냉면", "칼국수", "백반", "오리", "닭갈비"]],
];

function resolvePrimaryCategoryName(...values) {
  const normalized = values
    .map((value) => sanitizeText(value))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!normalized) {
    return null;
  }

  for (const [primaryCategoryName, keywords] of PRIMARY_CATEGORY_RULES) {
    if (keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return primaryCategoryName;
    }
  }

  return "기타";
}

function serializeDetailValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string") {
    return sanitizeText(value) || null;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    return null;
  }
}

const CLOCK_TIME_PATTERN = /\b(?:[01]?\d|2[0-4]):[0-5]\d\b/g;

function extractClockTimes(value) {
  const normalized = sanitizeText(value);
  if (!normalized) {
    return [];
  }

  return Array.from(new Set(normalized.match(CLOCK_TIME_PATTERN) || []));
}

function buildBusinessTimeEntriesFromText(value) {
  const text = sanitizeText(value);
  const times = extractClockTimes(text);
  if (!text || times.length === 0) {
    return [];
  }

  return times.map((time) => ({
    time,
    text,
  }));
}

function collectAbsoluteBusinessTimeEntries(value) {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    const normalized = sanitizeText(value);
    if (!normalized) {
      return [];
    }

    try {
      return collectAbsoluteBusinessTimeEntries(JSON.parse(normalized));
    } catch (error) {
      return buildBusinessTimeEntriesFromText(normalized);
    }
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectAbsoluteBusinessTimeEntries(item));
  }

  if (typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value.entries)) {
    return value.entries.flatMap((entry) => {
      const text = sanitizeText(entry?.text);
      const time = sanitizeText(entry?.time);
      if (text && time) {
        return [{ time, text }];
      }
      return buildBusinessTimeEntriesFromText(text || time);
    });
  }

  if (sanitizeText(value.__typename) === "NewBusinessHours") {
    return [
      ...buildBusinessTimeEntriesFromText(value.description),
      ...buildBusinessTimeEntriesFromText(value.dayOffDescription),
    ];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    if (key === "status" || key === "__typename") {
      return [];
    }
    return collectAbsoluteBusinessTimeEntries(child);
  });
}

function resolveAbsoluteOpeningHours(...values) {
  const entriesByKey = new Map();
  for (const value of values) {
    for (const entry of collectAbsoluteBusinessTimeEntries(value)) {
      entriesByKey.set(`${entry.time}::${entry.text}`, entry);
    }
  }

  const entries = Array.from(entriesByKey.values());
  if (entries.length === 0) {
    return null;
  }

  return {
    source: "pcmap_absolute_time",
    entries,
  };
}

function isStructuredBusinessHoursPayload(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.source === "pcmap_business_hours" &&
      Array.isArray(value.days) &&
      value.days.length > 0
  );
}

function summarizeTimeRange(range) {
  if (!range || typeof range !== "object") {
    return "";
  }

  const start = sanitizeText(range.start);
  const end = sanitizeText(range.end);
  if (!start && !end) {
    return "";
  }

  return `${start || ""}-${end || ""}`;
}

function summarizeWorkingHoursDay(day) {
  if (!day || typeof day !== "object") {
    return "";
  }

  const parts = [];
  const businessHoursText = summarizeTimeRange(day.businessHours);
  if (businessHoursText) {
    parts.push(businessHoursText);
  }

  const breakHours = Array.isArray(day.breakHours)
    ? day.breakHours.map((range) => summarizeTimeRange(range)).filter(Boolean)
    : [];
  if (breakHours.length > 0) {
    parts.push(`브레이크 ${breakHours.join(", ")}`);
  }

  const lastOrderTimes = Array.isArray(day.lastOrderTimes)
    ? day.lastOrderTimes.map((item) => sanitizeText(item?.time)).filter(Boolean)
    : [];
  if (lastOrderTimes.length > 0) {
    parts.push(`라스트오더 ${lastOrderTimes.join(", ")}`);
  }

  const description = sanitizeText(day.description);
  if (description) {
    parts.push(description);
  }

  if (parts.length === 0) {
    return "";
  }

  return `${sanitizeText(day.day) || "요일"} ${parts.join(" / ")}`;
}

function resolveBusinessHoursRawPayload(...values) {
  const structured = values.find((value) => isStructuredBusinessHoursPayload(value));
  if (structured) {
    return structured;
  }

  return resolveAbsoluteOpeningHours(...values);
}

function collectRestaurantPhotoUrls(store, restaurantRow, limit = 10) {
  const urls = [];

  function addUrl(value) {
    const normalized = sanitizeText(value);
    if (!normalized || urls.includes(normalized)) {
      return;
    }
    urls.push(normalized);
  }

  addUrl(restaurantRow?.image_url);
  addUrl(store?.imageUrl);

  if (Array.isArray(restaurantRow?.photo_urls)) {
    restaurantRow.photo_urls.forEach(addUrl);
  }

  if (Array.isArray(store?.menus)) {
    for (const menu of store.menus) {
      if (Array.isArray(menu?.images)) {
        menu.images.forEach(addUrl);
      }
      addUrl(menu?.imageUrl);
      if (urls.length >= limit) {
        break;
      }
    }
  }

  return urls.slice(0, limit);
}

function normalizeTimestamp(value) {
  const normalized = sanitizeText(value);
  if (!normalized || normalized === "NOW()" || normalized === "CURRENT_TIMESTAMP") {
    return new Date().toISOString();
  }
  return normalized;
}

function isRestaurantRowInConfiguredArea(restaurantRow) {
  return Boolean(
    findMatchedArea(
      [restaurantRow?.address, restaurantRow?.road_address]
        .map((value) => sanitizeText(value))
        .filter(Boolean)
        .join(" "),
      getConfiguredAreaNames()
    )
  );
}

function buildConfiguredAreaDistribution(restaurants) {
  const configuredAreaNames = getConfiguredAreaNames();
  const counts = Object.fromEntries(configuredAreaNames.map((areaName) => [areaName, 0]));

  for (const restaurantRow of restaurants || []) {
    const matchedArea = findMatchedArea(
      [restaurantRow?.address, restaurantRow?.road_address]
        .map((value) => sanitizeText(value))
        .filter(Boolean)
        .join(" "),
      configuredAreaNames
    );
    if (matchedArea) {
      counts[matchedArea] += 1;
    }
  }

  return counts;
}

function buildRestaurantQualityScore(restaurantRow, store) {
  const menuCount = Array.isArray(store?.menus) ? store.menus.length : 0;

  return (
    menuCount * 10 +
    (sanitizeText(restaurantRow?.image_url) ? 5 : 0) +
    (restaurantRow?.lat != null && restaurantRow?.lng != null ? 4 : 0) +
    (sanitizeText(restaurantRow?.road_address) ? 4 : 0) +
    (sanitizeText(restaurantRow?.address) ? 3 : 0) +
    (sanitizeText(restaurantRow?.pcmap_place_id) ? 3 : 0) +
    (sanitizeText(restaurantRow?.category_name) ? 2 : 0)
  );
}

function normalizeRestaurantRow(restaurantRow, areaName, storesByPlaceId) {
  const placeId = sanitizeText(
    restaurantRow?.pcmap_place_id || restaurantRow?.source_place_id
  );
  const store = placeId ? storesByPlaceId.get(placeId) : null;
  const adminArea =
    normalizeAreaName(store?.adminArea) ||
    normalizeAreaName(areaName === "current-run" ? "" : areaName);
  const address = sanitizeText(store?.address || restaurantRow?.address) || null;
  const roadAddress =
    sanitizeText(store?.roadAddress || restaurantRow?.road_address) || null;
  const regionSchema = buildRegionSchema(
    adminArea,
    address,
    roadAddress,
    store?.regionName,
    restaurantRow?.region_name
  );
  const regionName = sanitizeText(
    store?.regionName || regionSchema.regionName || restaurantRow?.region_name
  );
  const regionCityName =
    sanitizeText(
      store?.regionCityName ||
        regionSchema.regionCityName ||
        restaurantRow?.region_city_name
    ) || null;
  const regionDistrictName =
    sanitizeText(
      store?.regionDistrictName ||
        regionSchema.regionDistrictName ||
        restaurantRow?.region_district_name
    ) || null;
  const regionCountyName =
    sanitizeText(
      store?.regionCountyName ||
        regionSchema.regionCountyName ||
        restaurantRow?.region_county_name
    ) || null;
  const regionTownName = sanitizeText(
    regionSchema.regionTownName ||
      store?.regionTownName ||
      restaurantRow?.region_town_name
  );
  const regionFilterNames = Array.from(
    new Set(
      [
        ...(store && Array.isArray(store?.regionFilterNames)
          ? store.regionFilterNames
          : Array.isArray(restaurantRow?.region_filter_names)
          ? restaurantRow.region_filter_names
          : []),
        ...(Array.isArray(regionSchema.regionFilterNames)
          ? regionSchema.regionFilterNames
          : []),
        regionCityName,
        regionDistrictName,
        regionCountyName,
        regionTownName,
        regionName,
      ]
        .map((value) => sanitizeText(value))
        .filter(Boolean)
    )
  );

  const categoryName = normalizeCategoryName(
    store?.broadCategory || store?.category || restaurantRow?.category_name
  );

  return {
    dedupKey: buildRestaurantDedupKey(restaurantRow),
    sourceArea: sanitizeText(areaName),
    store,
    row: {
      seed_index: 0,
      source_place_id: sanitizeText(
        restaurantRow?.source_place_id || restaurantRow?.pcmap_place_id || placeId
      ),
      address: address,
      road_address: roadAddress,
      created_at: sanitizeText(restaurantRow?.created_at) || "NOW()",
      deleted_at: restaurantRow?.deleted_at ?? null,
      image_url: sanitizeText(restaurantRow?.image_url || store?.imageUrl) || null,
      is_deleted: Boolean(restaurantRow?.is_deleted),
      is_hidden: Boolean(restaurantRow?.is_hidden),
      lat: restaurantRow?.lat ?? toNullableNumber(store?.y),
      lng: restaurantRow?.lng ?? toNullableNumber(store?.x),
      name: sanitizeText(restaurantRow?.name || store?.name),
      category_name: categoryName,
      primary_category_name:
        sanitizeText(restaurantRow?.primary_category_name || store?.primaryCategoryName) ||
        resolvePrimaryCategoryName(categoryName, store?.broadCategory, store?.category),
      region_name: regionName,
      region_city_name: regionCityName,
      region_district_name: regionDistrictName,
      region_county_name: regionCountyName,
      region_town_name: regionTownName || null,
      region_filter_names: regionFilterNames,
      conveniences: Array.isArray(store?.conveniences)
        ? store.conveniences.map((value) => sanitizeText(value)).filter(Boolean)
        : Array.isArray(restaurantRow?.conveniences)
        ? restaurantRow.conveniences.map((value) => sanitizeText(value)).filter(Boolean)
        : [],
      photo_urls: collectRestaurantPhotoUrls(store, restaurantRow, 10),
      updated_at: sanitizeText(restaurantRow?.updated_at) || "NOW()",
      phone_number:
        sanitizeText(store?.telephone || restaurantRow?.phone_number) || null,
      business_hours_raw:
        serializeDetailValue(resolveBusinessHoursRawPayload(
          store?.openingHours,
          store?.businessHours,
          store?.newBusinessHours,
          restaurantRow?.business_hours_raw,
          restaurantRow?.opening_hours
        )),
      pcmap_place_id: placeId || null,
      menu_updated_at: normalizeTimestamp(restaurantRow?.menu_updated_at),
    },
  };
}

function buildCombinedRestaurantMenuItems(normalizedRows) {
  return normalizedRows.flatMap((item, index) =>
    (Array.isArray(item.store?.menus) ? item.store.menus : [])
      .map((menu, menuIndex) => {
        const normalizedMenu = buildNormalizedMenuBase(menu, menuIndex, {
          placeName: item.row?.name,
        });
        if (!normalizedMenu) {
          return null;
        }

        const primaryMenuTag = resolvePrimaryMenuTag(normalizedMenu.menuName);

        return {
          seed_index: `${index + 1}-${menuIndex + 1}`,
          restaurant_seed_index: index + 1,
          display_order: normalizedMenu.displayOrder,
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
  const items = listRestaurantPreviewFiles();
  const storesByPlaceId = loadAreaStoresByPlaceId();
  const combinedByDedupKey = new Map();
  const duplicates = [];

  for (const item of items) {
    const restaurantRows = loadJsonArray(item.restaurantsPath);

    for (const restaurantRow of restaurantRows) {
      const normalized = normalizeRestaurantRow(
        restaurantRow,
        item.areaName,
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
        buildRestaurantQualityScore(normalized.row, normalized.store) >
        buildRestaurantQualityScore(existing.row, existing.store);
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

  const restaurantMenuItems = buildCombinedRestaurantMenuItems(normalizedRows);

  const tagPreview = buildRestaurantTagPreview(
    normalizedRows.map((item, index) =>
      buildTagSourceFromRestaurantRow({
        restaurantSeedIndex: index + 1,
        restaurantRow: {
          ...item.row,
          seed_index: index + 1,
        },
        store: item.store,
      })
    )
  );

  return {
    areaNames: items.map((item) => item.areaName),
    restaurants,
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
  const menuMappedCount = combined.restaurants.filter((restaurantRow) =>
    combined.restaurantMenuItems.some(
      (menuItem) => menuItem.restaurant_seed_index === restaurantRow.seed_index
    )
  ).length;

  const inputPairs = listRestaurantPreviewFiles().map((item) => ({
    area_name: item.areaName,
    restaurants_path: item.restaurantsPath,
  }));

  const summary = {
    generated_at: new Date().toISOString(),
    area_count: combined.areaNames.length,
    area_names: combined.areaNames,
    configured_area_count: getConfiguredAreaNames().length,
    configured_area_names: getConfiguredAreaNames(),
    configured_area_distribution: buildConfiguredAreaDistribution(
      combined.restaurants
    ),
    restaurant_count: combined.restaurants.length,
    menu_item_count: combined.restaurantMenuItems.length,
    tag_count: combined.tags.length,
    restaurant_tag_count: combined.restaurantTags.length,
    duplicate_count: combined.duplicates.length,
    menu_mapped_count: menuMappedCount,
    tag_validation_report: combined.tagValidationReport,
    tag_candidate_report: combined.tagCandidateReport,
    input_pairs: inputPairs,
  };

  const restaurantsPreviewPath = saveJson(
    GENERIC_RESTAURANTS_PREVIEW,
    combined.restaurants
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
    GENERIC_TAG_CANDIDATE_REPORT,
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
    menuItemCount: combined.restaurantMenuItems.length,
    duplicateCount: combined.duplicates.length,
    menuMappedCount,
    restaurantsPreviewPath,
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
