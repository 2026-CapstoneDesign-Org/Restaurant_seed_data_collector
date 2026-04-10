const {
  extractMenuItemsFromHtml,
  fetchPlaceDetail,
  searchPlaces,
} = require("./pcmap");
const {
  findMatchedArea,
  getConfiguredAreaNames,
  getConfiguredSearchKeywords,
  parseCsvList,
  resolveRequestedAreaNames,
} = require("./seed_config");
const {
  buildRestaurantTagPreview,
  buildTagSourceFromStore,
  resolvePrimaryMenuTag,
} = require("./tag_extractor");
const {
  buildMenuPayload,
  buildNormalizedMenuBase,
  toNullableNumber,
} = require("./menu_normalizer");
const { buildRegionSchema } = require("./region_utils");
const { saveJson, sanitizeText } = require("./utils");

const ALLOWED_ADMIN_AREAS = resolveRequestedAreaNames(process.env.SEED_ADMIN_AREAS);

const SEARCH_KEYWORDS = parseCsvList(process.env.SEED_SEARCH_KEYWORDS).length
  ? parseCsvList(process.env.SEED_SEARCH_KEYWORDS)
  : getConfiguredSearchKeywords();

const OUTPUT_PREFIX = sanitizeText(process.env.SEED_OUTPUT_PREFIX);

const FOOD_CATEGORY_KEYWORDS = [
  "음식점",
  "식당",
  "한식",
  "중식",
  "일식",
  "양식",
  "분식",
  "국밥",
  "고기",
  "구이",
  "국수",
  "칼국수",
  "만두",
  "해장국",
  "추어탕",
  "초밥",
  "롤",
  "도시락",
  "치킨",
  "피자",
  "햄버거",
  "샌드위치",
  "브런치",
  "베이커리",
  "케이크",
  "디저트",
  "카페",
  "커피",
  "차",
  "주점",
  "호프",
  "맥주",
  "이자카야",
  "바",
  "쌀국수",
  "마라탕",
  "마라",
  "부자",
  "파스타",
  "뷔페",
  "도시락",
  "조개",
  "보쌈",
  "복어",
  "낙지",
  "육회",
  "순대",
  "순댓국",
  "김밥",
  "떡볶이",
  "와플",
];

const BLOCKED_CATEGORY_KEYWORDS = [
  "오토바이용품",
  "모터사이클",
  "스터디카페",
  "공유오피스",
  "사진",
  "스튜디오",
  "문구",
  "마트",
  "생활용품",
  "편의점",
  "가구",
  "의류",
  "인테리어",
  "반려동물",
  "자동차",
  "대리점",
  "플라워",
  "병원",
  "입시",
  "키즈카페",
  "실내놀이터",
  "조립식건축",
  "조립식",
  "건축자재",
  "건물해체",
  "해체공사",
  "중고가전",
  "식료품제조",
  "육류가공",
  "제조",
  "가공",
  "주방기구",
  "주방집기",
  "폐기물",
  "영화관",
  "명함인쇄",
  "장소대여",
  "애견훈련",
];

const BLOCKED_PLACE_NAME_KEYWORDS = [
  "판넬",
  "패널",
  "칸막이",
  "공사",
  "철거",
  "방수",
  "석고",
  "텍스",
  "데코타일",
  "조립식",
  "원상복구",
  "집기매입",
  "주방기구",
  "주방집기",
  "폐기물",
];

const BLOCKED_MENU_RAW_TYPES = new Set([
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
];

const MANUALLY_BLOCKED_PLACE_NAMES = new Set([
  "명지카페",
  "막퍼주는 팔팔수산물 직판장",
]);
const MANUALLY_CONFIRMED_RESTAURANT_PLACE_IDS = new Set([
  "1627681710",
  "2008487933",
  "1574215759",
  "1920563237",
  "1903159052",
  "1009678477",
  "36448174",
  "1435440737",
  "2082239866",
  "1812358468",
  "1437315652",
]);

function printHelp() {
  console.log(`
Naver Seed

Usage
  node src/index.js
  node src/index.js refresh-seed
  node src/index.js combine-seed
  node src/index.js areas
  npm run seed
  npm run seed:refresh
  npm run seed:combine

Role
  - Collect pcmap store data
  - Export area preview JSON files
  - Export merged preview JSON files for Spring import

Area config
  - Edit only: src/seed_config.js
  - Permanent area list: RAW_AREA_CONFIGS
  - Temporary area override: SEED_ADMIN_AREAS=역북동,망포동

Seed scope
  Source: pcmap
  Configured admin areas: ${getConfiguredAreaNames().join(", ")}
  Active admin areas: ${ALLOWED_ADMIN_AREAS.join(", ")}
  Search keywords: ${SEARCH_KEYWORDS.join(", ")}
`);
}

function buildSeedQueries() {
  return ALLOWED_ADMIN_AREAS.flatMap((area) =>
    SEARCH_KEYWORDS.map((keyword) => `용인 처인구 ${area} ${keyword}`)
  );
}

function withOutputPrefix(fileName) {
  return OUTPUT_PREFIX ? `${OUTPUT_PREFIX}-${fileName}` : fileName;
}

function normalizeKey(value) {
  return sanitizeText(value).replace(/\s+/g, "").toLowerCase();
}

function buildAddressText(...values) {
  return values
    .map((value) => sanitizeText(value))
    .filter(Boolean)
    .join(" ");
}

function detectAdminArea(...values) {
  return findMatchedArea(buildAddressText(...values), ALLOWED_ADMIN_AREAS);
}

function isCandidateInAllowedArea(candidate) {
  return Boolean(
    detectAdminArea(
      candidate.address,
      candidate.roadAddress,
      candidate.fullAddress,
      candidate.commonAddress
    )
  );
}

function mergeText(left, right) {
  const leftText = sanitizeText(left);
  const rightText = sanitizeText(right);

  if (!leftText) {
    return rightText;
  }

  if (!rightText) {
    return leftText;
  }

  return rightText.length > leftText.length ? rightText : leftText;
}

function mergeArray(left, right) {
  return Array.from(new Set([...(left || []), ...(right || [])]));
}

function mergeCandidate(existing, candidate, query) {
  const matchedArea = detectAdminArea(
    candidate.address,
    candidate.roadAddress,
    candidate.fullAddress,
    candidate.commonAddress
  );

  if (!existing) {
    return {
      ...candidate,
      broadCategory: candidate.category || "",
      matchedQueries: [query],
      matchedAdminAreas: matchedArea ? [matchedArea] : [],
    };
  }

  return {
    ...existing,
    name: mergeText(existing.name, candidate.name),
    category: mergeText(existing.category, candidate.category),
    broadCategory: mergeText(existing.broadCategory, candidate.category),
    roadAddress: mergeText(existing.roadAddress, candidate.roadAddress),
    address: mergeText(existing.address, candidate.address),
    fullAddress: mergeText(existing.fullAddress, candidate.fullAddress),
    commonAddress: mergeText(existing.commonAddress, candidate.commonAddress),
    telephone: mergeText(existing.telephone, candidate.telephone),
    x: mergeText(existing.x, candidate.x),
    y: mergeText(existing.y, candidate.y),
    imageUrl: mergeText(existing.imageUrl, candidate.imageUrl),
    imageCount: existing.imageCount ?? candidate.imageCount ?? null,
    businessHours: existing.businessHours || candidate.businessHours || null,
    daysOff: existing.daysOff || candidate.daysOff || null,
    bookingUrl: mergeText(existing.bookingUrl, candidate.bookingUrl),
    hasBooking: Boolean(existing.hasBooking || candidate.hasBooking),
    hasNPay: Boolean(existing.hasNPay || candidate.hasNPay),
    visitorReviewCount: mergeText(
      existing.visitorReviewCount,
      candidate.visitorReviewCount
    ),
    blogCafeReviewCount: mergeText(
      existing.blogCafeReviewCount,
      candidate.blogCafeReviewCount
    ),
    newBusinessHours:
      existing.newBusinessHours || candidate.newBusinessHours || null,
    hasWheelchairEntrance: Boolean(
      existing.hasWheelchairEntrance || candidate.hasWheelchairEntrance
    ),
    categoryCodeList: mergeArray(
      existing.categoryCodeList,
      candidate.categoryCodeList
    ),
    matchedQueries: mergeArray(existing.matchedQueries, [query]),
    matchedAdminAreas: mergeArray(
      existing.matchedAdminAreas,
      matchedArea ? [matchedArea] : []
    ),
    raw: existing.raw || candidate.raw,
  };
}

function hasKeywordMatch(text, keywords) {
  const normalizedText = normalizeKey(text);
  if (!normalizedText) {
    return false;
  }

  return keywords.some((keyword) =>
    normalizedText.includes(normalizeKey(keyword))
  );
}

function buildCategoryText(candidate, placeData) {
  return [
    sanitizeText(placeData?.category),
    sanitizeText(candidate?.category),
    sanitizeText(candidate?.broadCategory),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildPlaceNameText(candidate, placeData) {
  return [
    sanitizeText(placeData?.name),
    sanitizeText(candidate?.name),
  ]
    .filter(Boolean)
    .join(" ");
}

function hasBlockedCategorySignal(candidate, placeData) {
  return hasKeywordMatch(
    buildCategoryText(candidate, placeData),
    BLOCKED_CATEGORY_KEYWORDS
  );
}

function hasFoodCategorySignal(candidate, placeData) {
  return hasKeywordMatch(
    buildCategoryText(candidate, placeData),
    FOOD_CATEGORY_KEYWORDS
  );
}

function hasBlockedPlaceNameSignal(candidate, placeData) {
  return hasKeywordMatch(
    buildPlaceNameText(candidate, placeData),
    BLOCKED_PLACE_NAME_KEYWORDS
  );
}

function hasManualBlockedPlaceNameSignal(candidate, placeData) {
  return MANUALLY_BLOCKED_PLACE_NAMES.has(
    sanitizeText(placeData?.name || candidate?.name)
  );
}

function hasAlphaOrHangul(text) {
  return /[가-힣A-Za-z]/.test(sanitizeText(text));
}

function isDigitsOnlyText(text) {
  const normalized = sanitizeText(text).replace(/\s+/g, "");
  return Boolean(normalized) && /^\d[\d.-]*$/.test(normalized);
}

function isReliableFoodMenuItem(menuItem) {
  const menuName = sanitizeText(menuItem?.name);
  if (!menuName) {
    return false;
  }

  if (!hasAlphaOrHangul(menuName)) {
    return false;
  }

  if (isDigitsOnlyText(menuName)) {
    return false;
  }

  if (
    BLOCKED_MENU_NAME_KEYWORDS.some((keyword) => menuName.includes(keyword))
  ) {
    return false;
  }

  const rawTypeName = sanitizeText(menuItem?.raw?.__typename);
  if (BLOCKED_MENU_RAW_TYPES.has(rawTypeName)) {
    return false;
  }

  if (sanitizeText(menuItem?.price)) {
    return true;
  }

  if (resolvePrimaryMenuTag(menuName)) {
    return true;
  }

  return hasKeywordMatch(menuName, FOOD_CATEGORY_KEYWORDS);
}

function getReliableFoodMenuCount(menuItems) {
  return (menuItems || []).filter((menuItem) => isReliableFoodMenuItem(menuItem))
    .length;
}

function buildMenuDiagnostics(menuItems) {
  const items = Array.isArray(menuItems) ? menuItems : [];
  let reliableFoodMenuCount = 0;
  let pricedMenuCount = 0;
  let blockedRawTypeCount = 0;
  let blockedNameCount = 0;
  let digitOnlyNameCount = 0;

  for (const menuItem of items) {
    const menuName = sanitizeText(menuItem?.name);
    const rawTypeName = sanitizeText(menuItem?.raw?.__typename);

    if (isReliableFoodMenuItem(menuItem)) {
      reliableFoodMenuCount += 1;
    }

    if (sanitizeText(menuItem?.price)) {
      pricedMenuCount += 1;
    }

    if (BLOCKED_MENU_RAW_TYPES.has(rawTypeName)) {
      blockedRawTypeCount += 1;
    }

    if (
      menuName &&
      BLOCKED_MENU_NAME_KEYWORDS.some((keyword) => menuName.includes(keyword))
    ) {
      blockedNameCount += 1;
    }

    if (isDigitsOnlyText(menuName)) {
      digitOnlyNameCount += 1;
    }
  }

  return {
    menuCount: items.length,
    reliableFoodMenuCount,
    pricedMenuCount,
    blockedRawTypeCount,
    blockedNameCount,
    digitOnlyNameCount,
  };
}

function isFoodPlace(candidate, placeData, menuItems) {
  if (!candidate && !placeData) {
    return false;
  }

  if (hasBlockedCategorySignal(candidate, placeData)) {
    return false;
  }

  if (hasBlockedPlaceNameSignal(candidate, placeData)) {
    return false;
  }

  if (hasManualBlockedPlaceNameSignal(candidate, placeData)) {
    return false;
  }

  const businessType = sanitizeText(
    placeData?.missingInfo?.businessType
  ).toLowerCase();
  const menuDiagnostics = buildMenuDiagnostics(menuItems);
  const reliableFoodMenuCount = menuDiagnostics.reliableFoodMenuCount;

  if (businessType === "restaurant") {
    return true;
  }

  if (hasFoodCategorySignal(candidate, placeData)) {
    return true;
  }

  return reliableFoodMenuCount > 0;
}

function buildManualReviewCandidates(stores) {
  return (stores || [])
    .map((store) => {
      const placeId = sanitizeText(store?.placeId);
      const menuDiagnostics = buildMenuDiagnostics(store?.menus);
      const businessType = sanitizeText(store?.businessType).toLowerCase();

      if (MANUALLY_CONFIRMED_RESTAURANT_PLACE_IDS.has(placeId)) {
        return null;
      }

      if (menuDiagnostics.menuCount === 0) {
        return null;
      }

      if (menuDiagnostics.reliableFoodMenuCount > 0) {
        return null;
      }

      return {
        place_id: placeId,
        name: sanitizeText(store?.name),
        category: sanitizeText(store?.category),
        business_type: businessType || null,
        address: sanitizeText(store?.address || store?.fullAddress),
        matched_queries: Array.isArray(store?.matchedQueries)
          ? store.matchedQueries
          : [],
        menu_diagnostics: menuDiagnostics,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const rightRiskScore =
        right.menu_diagnostics.menuCount +
        right.menu_diagnostics.blockedRawTypeCount * 5;
      const leftRiskScore =
        left.menu_diagnostics.menuCount +
        left.menu_diagnostics.blockedRawTypeCount * 5;

      if (rightRiskScore !== leftRiskScore) {
        return rightRiskScore - leftRiskScore;
      }

      return left.name.localeCompare(right.name, "ko");
    });
}

function buildSeedStore(candidate, placeData, menuItems) {
  const adminArea =
    detectAdminArea(
      placeData?.address,
      placeData?.roadAddress,
      candidate.address,
      candidate.roadAddress,
      candidate.fullAddress,
      candidate.commonAddress
    ) || "";
  const regionSchema = buildRegionSchema(
    adminArea,
    placeData?.address,
    placeData?.roadAddress,
    candidate.address,
    candidate.roadAddress,
    candidate.fullAddress,
    candidate.commonAddress
  );

  return {
    source: "pcmap",
    placeId: candidate.placeId,
    name: sanitizeText(placeData?.name || candidate.name),
    broadCategory: sanitizeText(placeData?.category || candidate.category),
    category: sanitizeText(placeData?.category || candidate.category),
    categoryCode: sanitizeText(placeData?.categoryCode),
    categoryCodeList:
      placeData?.categoryCodeList || candidate.categoryCodeList || [],
    adminArea,
    regionName: regionSchema.regionName,
    regionCityName: regionSchema.regionCityName,
    regionDistrictName: regionSchema.regionDistrictName,
    regionCountyName: regionSchema.regionCountyName,
    regionFilterNames: regionSchema.regionFilterNames,
    address: sanitizeText(placeData?.address || candidate.address),
    roadAddress: sanitizeText(placeData?.roadAddress || candidate.roadAddress),
    fullAddress: buildAddressText(
      placeData?.roadAddress || candidate.roadAddress,
      placeData?.address || candidate.address
    ),
    x: sanitizeText(placeData?.x || candidate.x),
    y: sanitizeText(placeData?.y || candidate.y),
    coordinate: placeData?.coordinate || null,
    telephone: sanitizeText(
      placeData?.virtualPhone || placeData?.phone || candidate.telephone
    ),
    imageUrl: sanitizeText(candidate.imageUrl),
    imageCount: candidate.imageCount ?? null,
    visitorReviewsTotal: placeData?.visitorReviewsTotal ?? null,
    visitorReviewsTextReviewTotal:
      placeData?.visitorReviewsTextReviewTotal ?? null,
    openingHours: placeData?.openingHours || null,
    newBusinessHours:
      placeData?.newBusinessHours || candidate.newBusinessHours || null,
    conveniences: placeData?.conveniences || [],
    paymentInfo: placeData?.paymentInfo || [],
    description: sanitizeText(placeData?.description),
    menus: menuItems,
    menuCount: menuItems.length,
    businessType: sanitizeText(placeData?.missingInfo?.businessType),
    missingInfo: placeData?.missingInfo || null,
    matchedQueries: candidate.matchedQueries || [],
    matchedAdminAreas: candidate.matchedAdminAreas || [],
  };
}

function buildStoreDedupKey(store) {
  const nameKey = normalizeKey(store.name);
  const addressKey = normalizeKey(
    store.roadAddress || store.address || store.fullAddress
  );

  if (nameKey && addressKey) {
    return `${nameKey}::${addressKey}`;
  }

  const coordinateKey = `${normalizeKey(store.y)}::${normalizeKey(store.x)}`;
  if (nameKey && coordinateKey !== "::") {
    return `${nameKey}::${coordinateKey}`;
  }

  return `place:${sanitizeText(store.placeId)}`;
}

function buildStoreQualityScore(store) {
  return (
    (store.menuCount || 0) * 5 +
    (store.imageCount || 0) +
    (sanitizeText(store.imageUrl) ? 5 : 0) +
    (sanitizeText(store.telephone) ? 3 : 0) +
    (sanitizeText(store.roadAddress) ? 3 : 0) +
    (sanitizeText(store.address) ? 2 : 0) +
    (sanitizeText(store.description) ? 1 : 0)
  );
}

function mergeStore(existing, incoming) {
  const preferred =
    buildStoreQualityScore(incoming) > buildStoreQualityScore(existing)
      ? incoming
      : existing;
  const fallback = preferred === incoming ? existing : incoming;

  return {
    ...preferred,
    source: "pcmap",
    placeId: sanitizeText(preferred.placeId || fallback.placeId),
    name: mergeText(preferred.name, fallback.name),
    broadCategory: mergeText(preferred.broadCategory, fallback.broadCategory),
    category: mergeText(preferred.category, fallback.category),
    categoryCode: mergeText(preferred.categoryCode, fallback.categoryCode),
    categoryCodeList: mergeArray(
      preferred.categoryCodeList,
      fallback.categoryCodeList
    ),
    adminArea: mergeText(preferred.adminArea, fallback.adminArea),
    regionName: mergeText(preferred.regionName, fallback.regionName),
    regionCityName: mergeText(preferred.regionCityName, fallback.regionCityName),
    regionDistrictName: mergeText(
      preferred.regionDistrictName,
      fallback.regionDistrictName
    ),
    regionCountyName: mergeText(
      preferred.regionCountyName,
      fallback.regionCountyName
    ),
    regionFilterNames: mergeArray(
      preferred.regionFilterNames,
      fallback.regionFilterNames
    ),
    address: mergeText(preferred.address, fallback.address),
    roadAddress: mergeText(preferred.roadAddress, fallback.roadAddress),
    fullAddress: mergeText(preferred.fullAddress, fallback.fullAddress),
    x: mergeText(preferred.x, fallback.x),
    y: mergeText(preferred.y, fallback.y),
    telephone: mergeText(preferred.telephone, fallback.telephone),
    imageUrl: mergeText(preferred.imageUrl, fallback.imageUrl),
    imageCount: Math.max(preferred.imageCount || 0, fallback.imageCount || 0),
    visitorReviewsTotal: Math.max(
      preferred.visitorReviewsTotal || 0,
      fallback.visitorReviewsTotal || 0
    ),
    visitorReviewsTextReviewTotal: Math.max(
      preferred.visitorReviewsTextReviewTotal || 0,
      fallback.visitorReviewsTextReviewTotal || 0
    ),
    conveniences: mergeArray(preferred.conveniences, fallback.conveniences),
    paymentInfo: mergeArray(preferred.paymentInfo, fallback.paymentInfo),
    description: mergeText(preferred.description, fallback.description),
    menus:
      preferred.menuCount >= fallback.menuCount
        ? preferred.menus
        : fallback.menus,
    menuCount: Math.max(preferred.menuCount || 0, fallback.menuCount || 0),
    businessType: mergeText(preferred.businessType, fallback.businessType),
    matchedQueries: mergeArray(preferred.matchedQueries, fallback.matchedQueries),
    matchedAdminAreas: mergeArray(
      preferred.matchedAdminAreas,
      fallback.matchedAdminAreas
    ),
  };
}

async function collectSeedCandidates() {
  const queries = buildSeedQueries();
  const candidatesByPlaceId = new Map();
  const searchReports = [];

  for (const query of queries) {
    let searchResult;
    try {
      searchResult = await searchPlaces(query);
    } catch (error) {
      searchReports.push({
        query,
        pageCount: 0,
        totalAvailable: 0,
        totalCandidates: 0,
        acceptedCandidates: 0,
        failed: true,
        errorMessage: error.message,
        pageReports: [],
      });
      continue;
    }

    const filteredCandidates = searchResult.candidates.filter(
      isCandidateInAllowedArea
    );

    for (const candidate of filteredCandidates) {
      candidatesByPlaceId.set(
        candidate.placeId,
        mergeCandidate(candidatesByPlaceId.get(candidate.placeId), candidate, query)
      );
    }

    searchReports.push({
      query,
      pageCount: searchResult.pageReports.length,
      totalAvailable: searchResult.totalAvailable,
      totalCandidates: searchResult.candidates.length,
      acceptedCandidates: filteredCandidates.length,
      pageReports: searchResult.pageReports,
    });
  }

  return {
    queries,
    searchReports,
    candidates: Array.from(candidatesByPlaceId.values()),
  };
}

async function collectSeedStores(candidates) {
  const storesByKey = new Map();
  const skipped = [];

  for (const candidate of candidates) {
    let detailResult;
    try {
      detailResult = await fetchPlaceDetail(candidate.placeId);
    } catch (error) {
      skipped.push({
        placeId: candidate.placeId,
        name: candidate.name,
        reason: "detail-fetch-failed",
        errorMessage: error.message,
      });
      continue;
    }

    const menuItems =
      detailResult.placeData?.menus?.length > 0
        ? detailResult.placeData.menus
        : extractMenuItemsFromHtml(detailResult.menuPageResult.html);

    const adminArea =
      detectAdminArea(
        detailResult.placeData?.address,
        detailResult.placeData?.roadAddress,
        candidate.address,
        candidate.roadAddress,
        candidate.fullAddress,
        candidate.commonAddress
      ) || "";

    if (!adminArea) {
      skipped.push({
        placeId: candidate.placeId,
        name: candidate.name,
        reason: "outside-allowed-admin-area",
      });
      continue;
    }

    if (!isFoodPlace(candidate, detailResult.placeData, menuItems)) {
      skipped.push({
        placeId: candidate.placeId,
        name: candidate.name,
        reason: "not-food-place",
        category: sanitizeText(
          detailResult.placeData?.category || candidate.category
        ),
        businessType: sanitizeText(
          detailResult.placeData?.missingInfo?.businessType
        ),
      });
      continue;
    }

    const store = buildSeedStore(candidate, detailResult.placeData, menuItems);
    const dedupKey = buildStoreDedupKey(store);
    const existing = storesByKey.get(dedupKey);

    if (!existing) {
      storesByKey.set(dedupKey, store);
      continue;
    }

    storesByKey.set(dedupKey, mergeStore(existing, store));
    skipped.push({
      placeId: candidate.placeId,
      name: candidate.name,
      reason: "duplicate-store",
      duplicateOfPlaceId: existing.placeId,
      dedupKey,
    });
  }

  return {
    stores: Array.from(storesByKey.values()),
    skipped,
  };
}

function buildRestaurantSeedRows(stores) {
  return stores.map((store, index) => {
    const regionSchema = buildRegionSchema(
      store.adminArea,
      store.address,
      store.fullAddress,
      store.roadAddress,
      store.regionName
    );
    const menuPayload = buildMenuPayload(
      Array.isArray(store.menus) ? store.menus : [],
      { placeName: store.name }
    );

    return {
      seed_index: index + 1,
      source_place_id: store.placeId,
      address: sanitizeText(store.fullAddress || store.roadAddress || store.address),
      created_at: "NOW()",
      deleted_at: null,
      image_url: sanitizeText(store.imageUrl) || null,
      is_deleted: false,
      is_hidden: false,
      lat: toNullableNumber(store.y),
      lng: toNullableNumber(store.x),
      name: sanitizeText(store.name),
      region_name: sanitizeText(store.regionName || regionSchema.regionName),
      region_city_name: sanitizeText(
        store.regionCityName || regionSchema.regionCityName
      ) || null,
      region_district_name: sanitizeText(
        store.regionDistrictName || regionSchema.regionDistrictName
      ) || null,
      region_county_name: sanitizeText(
        store.regionCountyName || regionSchema.regionCountyName
      ) || null,
      region_filter_names:
        Array.isArray(store.regionFilterNames) && store.regionFilterNames.length > 0
          ? store.regionFilterNames
          : regionSchema.regionFilterNames,
      updated_at: "NOW()",
      pcmap_place_id: sanitizeText(store.placeId) || null,
      menu_json: {
        source: "pcmap",
        place_id: sanitizeText(store.placeId) || null,
        ...menuPayload,
      },
      menu_updated_at: "NOW()",
    };
  });
}

function buildRestaurantCategorySeedRows(stores) {
  return stores.map((store, index) => ({
    seed_index: index + 1,
    restaurant_seed_index: index + 1,
    category_name: sanitizeText(store.broadCategory || store.category) || "기타",
    created_at: "NOW()",
    updated_at: "NOW()",
  }));
}

function buildRestaurantMenuItemSeedRows(stores) {
  return stores.flatMap((store, storeIndex) =>
    (Array.isArray(store.menus) ? store.menus : [])
      .map((menu, menuIndex) => {
        const normalizedMenu = buildNormalizedMenuBase(menu, menuIndex, {
          placeName: store.name,
        });
        if (!normalizedMenu) {
          return null;
        }

        const primaryMenuTag = resolvePrimaryMenuTag(normalizedMenu.menuName);

        return {
          seed_index: `${storeIndex + 1}-${menuIndex + 1}`,
          restaurant_seed_index: storeIndex + 1,
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

function buildDatabaseSeedPreview(stores) {
  const restaurants = buildRestaurantSeedRows(stores);
  const restaurantCategories = buildRestaurantCategorySeedRows(stores);
  const restaurantMenuItems = buildRestaurantMenuItemSeedRows(stores);
  const tagPreview = buildRestaurantTagPreview(
    stores.map((store, index) => buildTagSourceFromStore(store, index + 1))
  );

  return {
    restaurants,
    restaurantCategories,
    restaurantMenuItems,
    tags: tagPreview.tags,
    restaurantTags: tagPreview.restaurantTags,
    tagValidationReport: tagPreview.validationReport,
    tagCandidateReport: tagPreview.candidateReport,
  };
}

async function runSeedPipeline() {
  console.log("[seed] pcmap collector");
  console.log(`[seed-areas] ${ALLOWED_ADMIN_AREAS.join(", ")}`);
  console.log(`[seed-keywords] ${SEARCH_KEYWORDS.join(", ")}`);
  console.log("");

  const candidateCollection = await collectSeedCandidates();

  console.log(`[seed-queries] total=${candidateCollection.queries.length}`);
  console.log(`[seed-candidates] unique=${candidateCollection.candidates.length}`);
  console.log("");

  const seedStoreCollection = await collectSeedStores(
    candidateCollection.candidates
  );
  const databaseSeedPreview = buildDatabaseSeedPreview(
    seedStoreCollection.stores
  );
  const manualReviewCandidates = buildManualReviewCandidates(
    seedStoreCollection.stores
  );

  const summary = {
    source: "pcmap",
    allowedAdminAreas: ALLOWED_ADMIN_AREAS,
    searchKeywords: SEARCH_KEYWORDS,
    queries: candidateCollection.queries,
    searchReports: candidateCollection.searchReports,
    uniqueCandidateCount: candidateCollection.candidates.length,
    skippedCount: seedStoreCollection.skipped.length,
    storeCount: seedStoreCollection.stores.length,
    skipped: seedStoreCollection.skipped,
    stores: seedStoreCollection.stores,
    databaseSeedPreview: {
      restaurantCount: databaseSeedPreview.restaurants.length,
      restaurantCategoryCount: databaseSeedPreview.restaurantCategories.length,
      restaurantMenuItemCount: databaseSeedPreview.restaurantMenuItems.length,
      tagCount: databaseSeedPreview.tags.length,
      restaurantTagCount: databaseSeedPreview.restaurantTags.length,
      tagValidationReport: databaseSeedPreview.tagValidationReport,
      tagCandidateReport: databaseSeedPreview.tagCandidateReport,
    },
  };

  const summaryPath = saveJson(
    withOutputPrefix("pcmap-area-seed-result.json"),
    summary
  );
  const restaurantsSeedPath = saveJson(
    withOutputPrefix("restaurants-seed-preview.json"),
    databaseSeedPreview.restaurants
  );
  const restaurantCategoriesSeedPath = saveJson(
    withOutputPrefix("restaurant-categories-seed-preview.json"),
    databaseSeedPreview.restaurantCategories
  );
  const restaurantMenuItemsSeedPath = saveJson(
    withOutputPrefix("restaurant-menu-items-seed-preview.json"),
    databaseSeedPreview.restaurantMenuItems
  );
  const tagsSeedPath = saveJson(
    withOutputPrefix("tags-seed-preview.json"),
    databaseSeedPreview.tags
  );
  const restaurantTagsSeedPath = saveJson(
    withOutputPrefix("restaurant-tags-seed-preview.json"),
    databaseSeedPreview.restaurantTags
  );
  const tagValidationReportPath = saveJson(
    withOutputPrefix("tag-validation-report.json"),
    databaseSeedPreview.tagValidationReport
  );
  const tagCandidateReportPath = saveJson(
    withOutputPrefix("tag-candidate-report.json"),
    databaseSeedPreview.tagCandidateReport
  );
  const manualReviewCandidatesPath = saveJson(
    withOutputPrefix("manual-review-candidates.json"),
    {
      generated_at: new Date().toISOString(),
      area_names: ALLOWED_ADMIN_AREAS,
      candidate_count: manualReviewCandidates.length,
      manually_blocked_place_names: Array.from(MANUALLY_BLOCKED_PLACE_NAMES),
      candidates: manualReviewCandidates,
    }
  );

  console.log(`[seed-stores] selected=${seedStoreCollection.stores.length}`);
  console.log(`[saved-summary] ${summaryPath}`);
  console.log(`[saved-restaurants-preview] ${restaurantsSeedPath}`);
  console.log(
    `[saved-restaurant-categories-preview] ${restaurantCategoriesSeedPath}`
  );
  console.log(
    `[saved-restaurant-menu-items-preview] ${restaurantMenuItemsSeedPath}`
  );
  console.log(`[saved-tags-preview] ${tagsSeedPath}`);
  console.log(`[saved-restaurant-tags-preview] ${restaurantTagsSeedPath}`);
  console.log(`[saved-tag-validation-report] ${tagValidationReportPath}`);
  console.log(`[saved-tag-candidate-report] ${tagCandidateReportPath}`);
  console.log(`[saved-manual-review-candidates] ${manualReviewCandidatesPath}`);
}

module.exports = {
  printHelp,
  runSeedPipeline,
};
