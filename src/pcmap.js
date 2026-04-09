const https = require("https");
const vm = require("vm");

const {
  buildSafeFileName,
  decodeHtmlEntities,
  formatWon,
  normalizeWhitespace,
  sanitizeText,
  saveJson,
  saveText,
  stripHtmlTags,
} = require("./utils");

const NAVER_SEARCH_CENTER_X = process.env.NAVER_SEARCH_CENTER_X || "127.1775537";
const NAVER_SEARCH_CENTER_Y = process.env.NAVER_SEARCH_CENTER_Y || "37.2410864";
const PCMAP_SEARCH_DISPLAY = Number(process.env.PCMAP_SEARCH_DISPLAY || 20);
const PCMAP_SEARCH_MAX_PAGES = Number(process.env.PCMAP_SEARCH_MAX_PAGES || 3);
const PCMAP_SAVE_SEARCH_DEBUG =
  String(process.env.PCMAP_SAVE_SEARCH_DEBUG || "false").toLowerCase() === "true";
const PCMAP_SAVE_DETAIL_DEBUG =
  String(process.env.PCMAP_SAVE_DETAIL_DEBUG || "false").toLowerCase() === "true";
const PCMAP_REQUEST_DELAY_MS = Number(process.env.PCMAP_REQUEST_DELAY_MS || 1200);
const PCMAP_RETRY_COUNT = Number(process.env.PCMAP_RETRY_COUNT || 4);
const PCMAP_RETRY_DELAY_MS = Number(process.env.PCMAP_RETRY_DELAY_MS || 3000);

let lastRequestAt = 0;

function buildTimestamp() {
  return String(Date.now());
}

function buildHeaders(referer) {
  const headers = {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Encoding": "identity",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    Origin: "https://pcmap.place.naver.com",
    Referer: referer,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  };

  if (process.env.NAVER_COOKIE) {
    headers.Cookie = process.env.NAVER_COOKIE;
  }

  return headers;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });
}

async function waitForRequestSlot() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < PCMAP_REQUEST_DELAY_MS) {
    await sleep(PCMAP_REQUEST_DELAY_MS - elapsed);
  }

  lastRequestAt = Date.now();
}

function readRetryAfterMs(headers) {
  const retryAfter = headers?.["retry-after"];
  if (!retryAfter) {
    return null;
  }

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(retryAfter);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return null;
}

function httpGetText(url, headers) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method: "GET", headers }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode || 0,
          headers: response.headers || {},
          body,
        });
      });
    });

    request.on("error", reject);
    request.end();
  });
}

async function fetchPcmapHtml(url, options = {}) {
  const referer = options.referer || "https://map.naver.com/";
  const saveDebug = Boolean(options.saveDebug);
  const debugBaseName = buildSafeFileName(options.debugBaseName || "pcmap");
  let lastError = null;

  for (let attempt = 1; attempt <= PCMAP_RETRY_COUNT; attempt += 1) {
    try {
      await waitForRequestSlot();
      const response = await httpGetText(url, buildHeaders(referer));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (saveDebug) {
          saveText(`${debugBaseName}.html`, response.body);
        }

        return {
          url,
          html: response.body,
          statusCode: response.statusCode,
          headers: response.headers,
        };
      }

      const error = new Error(
        `pcmap request failed (${response.statusCode}) for ${url}`
      );
      error.statusCode = response.statusCode;
      error.headers = response.headers;
      throw error;
    } catch (error) {
      lastError = error;
      const retryable =
        [429, 500, 502, 503, 504].includes(error.statusCode) ||
        attempt < PCMAP_RETRY_COUNT;

      if (!retryable || attempt >= PCMAP_RETRY_COUNT) {
        break;
      }

      const retryAfterMs =
        readRetryAfterMs(error.headers) || PCMAP_RETRY_DELAY_MS * attempt;
      await sleep(retryAfterMs);
    }
  }

  throw lastError || new Error(`pcmap request failed for ${url}`);
}

function buildSearchPageKey(query, page) {
  return `${buildSafeFileName(query)}-page-${page}`;
}

function buildSearchUrl(query, page = 1, options = {}) {
  const url = new URL("https://pcmap.place.naver.com/place/list");
  url.searchParams.set("query", query);
  url.searchParams.set("x", String(options.x || NAVER_SEARCH_CENTER_X));
  url.searchParams.set("y", String(options.y || NAVER_SEARCH_CENTER_Y));
  url.searchParams.set("clientX", String(options.clientX || NAVER_SEARCH_CENTER_X));
  url.searchParams.set("clientY", String(options.clientY || NAVER_SEARCH_CENTER_Y));
  url.searchParams.set("from", "map");
  url.searchParams.set("display", String(options.display || PCMAP_SEARCH_DISPLAY));
  url.searchParams.set("locale", "ko");
  url.searchParams.set("svcName", "map_pcv5");
  url.searchParams.set("noredirect", "1");

  if (page > 1) {
    url.searchParams.set("page", String(page));
  }

  return url.toString();
}

function buildMenuUrl(placeId) {
  const url = new URL(
    `https://pcmap.place.naver.com/restaurant/${encodeURIComponent(placeId)}/menu/list`
  );
  url.searchParams.set("fromPanelNum", "1");
  url.searchParams.set("additionalHeight", "76");
  url.searchParams.set("timestamp", buildTimestamp());
  url.searchParams.set("locale", "ko");
  url.searchParams.set("svcName", "map_pcv5");
  return url.toString();
}

async function fetchPcmapSearchPage(query, page = 1, options = {}) {
  const url = buildSearchUrl(query, page, options);
  return fetchPcmapHtml(url, {
    referer: "https://map.naver.com/",
    saveDebug: PCMAP_SAVE_SEARCH_DEBUG,
    debugBaseName: `${buildSearchPageKey(query, page)}-pcmap-search-page`,
  });
}

async function fetchMenuPageHtml(placeId) {
  const url = buildMenuUrl(placeId);
  return fetchPcmapHtml(url, {
    referer: `https://pcmap.place.naver.com/restaurant/${placeId}/home`,
    saveDebug: PCMAP_SAVE_DETAIL_DEBUG,
    debugBaseName: `${buildSafeFileName(placeId)}-pcmap-menu-response`,
  });
}

function parseEmbeddedJson(text) {
  try {
    return JSON.parse(text);
  } catch (jsonError) {
    return vm.runInNewContext(`(${text})`, {}, { timeout: 1000 });
  }
}

function extractBalancedJsonObject(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (character === "\\") {
        escape = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return "";
}

function extractApolloStateFromHtml(html) {
  const markers = [
    "window.__APOLLO_STATE__ =",
    "window.__APOLLO_STATE__=",
  ];

  for (const marker of markers) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex < 0) {
      continue;
    }

    const objectStart = html.indexOf("{", markerIndex + marker.length);
    if (objectStart < 0) {
      continue;
    }

    const objectText = extractBalancedJsonObject(html, objectStart);
    if (!objectText) {
      continue;
    }

    try {
      return parseEmbeddedJson(objectText);
    } catch (error) {
      continue;
    }
  }

  return null;
}

function resolveApolloValue(apolloState, value) {
  if (!value) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveApolloValue(apolloState, item));
  }

  if (value && typeof value === "object" && typeof value.__ref === "string") {
    return apolloState?.[value.__ref] || null;
  }

  if (value && typeof value === "object" && Array.isArray(value.__refs)) {
    return value.__refs
      .map((reference) => apolloState?.[reference])
      .filter(Boolean);
  }

  return value;
}

function getByPath(target, path) {
  return path.reduce((current, segment) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    return current[segment];
  }, target);
}

function pickFromPaths(target, paths) {
  for (const path of paths) {
    const value = getByPath(target, path);
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
}

function getPcmapPlacesKey(apolloState) {
  const rootQuery = apolloState?.ROOT_QUERY;
  if (!rootQuery || typeof rootQuery !== "object") {
    return "";
  }

  return (
    Object.keys(rootQuery).find((key) => key.startsWith("places(")) ||
    Object.keys(rootQuery).find((key) => key.includes("places(")) ||
    ""
  );
}

function extractPcmapPlacesResult(apolloState) {
  const rootQuery = apolloState?.ROOT_QUERY;
  if (!rootQuery) {
    return { raw: null, items: [], totalAvailable: 0 };
  }

  const placesKey = getPcmapPlacesKey(apolloState);
  if (!placesKey) {
    return { raw: null, items: [], totalAvailable: 0 };
  }

  const rawResult = resolveApolloValue(apolloState, rootQuery[placesKey]);
  const items = pickFromPaths(rawResult, [
    ["items"],
    ["place", "list"],
    ["list"],
    ["places", "items"],
  ]);
  const totalAvailable = Number(
    pickFromPaths(rawResult, [
      ["total"],
      ["totalCount"],
      ["place", "total"],
      ["count"],
    ]) || 0
  );

  return {
    raw: rawResult,
    items: Array.isArray(items)
      ? items.map((item) => resolveApolloValue(apolloState, item)).filter(Boolean)
      : [],
    totalAvailable: Number.isFinite(totalAvailable) ? totalAvailable : 0,
  };
}

function normalizeStringList(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return sanitizeText(item);
        }

        if (item && typeof item === "object") {
          return sanitizeText(
            item.name || item.title || item.text || item.label || item.value
          );
        }

        return "";
      })
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return sanitizeText(value) ? [sanitizeText(value)] : [];
  }

  return [];
}

function normalizeImageList(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return sanitizeText(item);
        }

        if (item && typeof item === "object") {
          return sanitizeText(item.url || item.imageUrl || item.src);
        }

        return "";
      })
      .filter(Boolean);
  }

  return [];
}

function normalizeSearchCandidate(rawCandidate) {
  if (!rawCandidate || typeof rawCandidate !== "object") {
    return null;
  }

  const categoryCodeList = Array.isArray(rawCandidate.cidList)
    ? rawCandidate.cidList.map((value) => sanitizeText(value)).filter(Boolean)
    : Array.isArray(rawCandidate.categoryCodeList)
    ? rawCandidate.categoryCodeList
        .map((value) => sanitizeText(value))
        .filter(Boolean)
    : [];

  return {
    source: "pcmap",
    placeId: sanitizeText(rawCandidate.placeId || rawCandidate.id),
    name: sanitizeText(rawCandidate.name),
    category: sanitizeText(rawCandidate.category || rawCandidate.categoryName),
    roadAddress: sanitizeText(rawCandidate.roadAddress),
    address: sanitizeText(rawCandidate.address),
    fullAddress: sanitizeText(rawCandidate.fullAddress),
    commonAddress: sanitizeText(rawCandidate.commonAddress),
    telephone: sanitizeText(rawCandidate.telephone || rawCandidate.phone),
    x: sanitizeText(rawCandidate.x || rawCandidate.longitude),
    y: sanitizeText(rawCandidate.y || rawCandidate.latitude),
    businessHours: rawCandidate.businessHours || null,
    daysOff: rawCandidate.daysOff || null,
    bookingUrl: sanitizeText(rawCandidate.bookingUrl),
    hasBooking: Boolean(rawCandidate.hasBooking || rawCandidate.bookingUrl),
    hasNPay: Boolean(rawCandidate.hasNPay),
    visitorReviewCount: sanitizeText(rawCandidate.visitorReviewCount),
    blogCafeReviewCount: sanitizeText(rawCandidate.blogCafeReviewCount),
    newBusinessHours: rawCandidate.newBusinessHours || null,
    hasWheelchairEntrance: Boolean(rawCandidate.hasWheelchairEntrance),
    imageUrl: sanitizeText(rawCandidate.imageUrl),
    imageCount:
      Number.isFinite(rawCandidate.imageCount) || rawCandidate.imageCount === 0
        ? Number(rawCandidate.imageCount)
        : null,
    categoryCodeList,
    raw: rawCandidate,
  };
}

function extractPcmapSearchCandidates(html) {
  const apolloState = extractApolloStateFromHtml(html);
  if (!apolloState) {
    return {
      apolloState: null,
      candidates: [],
      totalAvailable: 0,
    };
  }

  const placesResult = extractPcmapPlacesResult(apolloState);
  const candidates = placesResult.items
    .map((item) => normalizeSearchCandidate(item))
    .filter((item) => item && item.placeId);

  return {
    apolloState,
    candidates,
    totalAvailable:
      placesResult.totalAvailable || placesResult.items.length || candidates.length,
  };
}

function findPlaceBaseData(apolloState, placeId) {
  if (!apolloState || typeof apolloState !== "object") {
    return null;
  }

  const directKeys = [
    `PlaceDetailBase:${placeId}`,
    `Restaurant:${placeId}`,
    `Place:${placeId}`,
  ];

  for (const key of directKeys) {
    if (apolloState[key]) {
      return apolloState[key];
    }
  }

  for (const [key, value] of Object.entries(apolloState)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    if (sanitizeText(value.placeId) === sanitizeText(placeId)) {
      if (
        value.name ||
        value.category ||
        value.address ||
        value.roadAddress ||
        key.includes("Place")
      ) {
        return value;
      }
    }
  }

  return null;
}

function buildNormalizedMenu(menu, index, keyHint = "") {
  if (!menu || typeof menu !== "object") {
    return null;
  }

  const name = sanitizeText(menu.name || menu.title || menu.menu || menu.menuName);
  const rawPrice = menu.price ?? menu.priceText ?? menu.salePrice;
  const priceText = rawPrice === 0 || rawPrice ? formatWon(rawPrice) || sanitizeText(rawPrice) : "";
  const description = sanitizeText(menu.description || menu.summary || menu.desc);
  const images = normalizeImageList(menu.images || menu.imageUrls || menu.imageList);
  const recommend = Boolean(menu.recommend || menu.isRecommend || menu.represent);

  if (!name) {
    return null;
  }

  return {
    id: sanitizeText(menu.id || keyHint),
    index: Number.isFinite(menu.index) ? menu.index : index,
    name,
    price: priceText,
    description: description || null,
    recommend,
    images,
    raw: menu,
  };
}

function extractPlaceDataFromApolloState(apolloState, placeId) {
  const placeBase = findPlaceBaseData(apolloState, placeId);
  if (!placeBase) {
    return null;
  }

  const coordinate = resolveApolloValue(apolloState, placeBase.coordinate) || null;
  const missingInfo = resolveApolloValue(apolloState, placeBase.missingInfo) || null;
  const conveniences = normalizeStringList(
    resolveApolloValue(apolloState, placeBase.conveniences)
  );
  const paymentInfo = normalizeStringList(
    resolveApolloValue(apolloState, placeBase.paymentInfo)
  );
  const directMenus = resolveApolloValue(apolloState, placeBase.menus);

  let menus = Array.isArray(directMenus)
    ? directMenus
        .map((menu, index) => buildNormalizedMenu(menu, index))
        .filter(Boolean)
    : [];

  if (!menus.length) {
    menus = Object.entries(apolloState)
      .filter(([key, value]) => {
        if (!value || typeof value !== "object") {
          return false;
        }

        if (sanitizeText(value.placeId) === sanitizeText(placeId)) {
          return String(value.__typename || "").toLowerCase().includes("menu");
        }

        return key.includes(`:${placeId}_`) || key.includes(`:${placeId}:`);
      })
      .map(([key, value], index) => buildNormalizedMenu(value, index, key))
      .filter(Boolean);
  }

  return {
    placeId: sanitizeText(placeBase.placeId || placeId),
    name: sanitizeText(placeBase.name),
    category: sanitizeText(placeBase.category || placeBase.categoryName),
    categoryCode: sanitizeText(placeBase.categoryCode),
    categoryCodeList: Array.isArray(placeBase.categoryCodeList)
      ? placeBase.categoryCodeList.map((item) => sanitizeText(item)).filter(Boolean)
      : Array.isArray(placeBase.cidList)
      ? placeBase.cidList.map((item) => sanitizeText(item)).filter(Boolean)
      : [],
    address: sanitizeText(placeBase.address),
    roadAddress: sanitizeText(placeBase.roadAddress),
    phone: sanitizeText(placeBase.phone),
    virtualPhone: sanitizeText(placeBase.virtualPhone),
    coordinate,
    x: sanitizeText(placeBase.x || coordinate?.x || coordinate?.longitude),
    y: sanitizeText(placeBase.y || coordinate?.y || coordinate?.latitude),
    openingHours: resolveApolloValue(apolloState, placeBase.openingHours) || null,
    newBusinessHours:
      resolveApolloValue(apolloState, placeBase.newBusinessHours) || null,
    visitorReviewsTotal:
      Number(placeBase.visitorReviewsTotal || placeBase.reviewerCount || 0) || null,
    visitorReviewsScore:
      Number(placeBase.visitorReviewsScore || placeBase.reviewScore || 0) || null,
    visitorReviewsTextReviewTotal:
      Number(placeBase.visitorReviewsTextReviewTotal || 0) || null,
    conveniences,
    paymentInfo,
    description: sanitizeText(
      placeBase.description || placeBase.introduction || placeBase.summary
    ),
    missingInfo:
      missingInfo && typeof missingInfo === "object"
        ? {
            ...missingInfo,
            businessType: sanitizeText(missingInfo.businessType),
          }
        : { businessType: sanitizeText(placeBase.businessType) },
    menus,
    raw: placeBase,
  };
}

function extractJsonBlocksFromHtml(html) {
  const results = [];
  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptRegex)) {
    const candidate = sanitizeText(match[1]);
    if (!candidate) {
      continue;
    }

    try {
      results.push(parseEmbeddedJson(match[1]));
    } catch (error) {
      continue;
    }
  }

  return results;
}

function pushMenuCandidate(value, sink) {
  if (!value || typeof value !== "object") {
    return;
  }

  const candidate = buildNormalizedMenu(value, sink.length);
  if (!candidate) {
    return;
  }

  const blockedNames = [
    "이미지",
    "메뉴 안내",
    "메뉴정보",
    "방문자 리뷰",
    "리뷰",
    "사진",
    "원산지",
  ];

  if (blockedNames.some((blocked) => candidate.name.includes(blocked))) {
    return;
  }

  sink.push(candidate);
}

function walkForMenuCandidates(value, sink, visited = new Set()) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (visited.has(value)) {
    return;
  }
  visited.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      walkForMenuCandidates(item, sink, visited);
    }
    return;
  }

  pushMenuCandidate(value, sink);

  for (const nestedValue of Object.values(value)) {
    walkForMenuCandidates(nestedValue, sink, visited);
  }
}

function dedupeMenuItems(menuItems) {
  const menuByKey = new Map();

  for (const menu of menuItems) {
    const key = `${sanitizeText(menu.name)}::${sanitizeText(menu.price)}`;
    if (!sanitizeText(menu.name) || menuByKey.has(key)) {
      continue;
    }

    menuByKey.set(key, menu);
  }

  return Array.from(menuByKey.values()).map((menu, index) => ({
    ...menu,
    index,
    id: sanitizeText(menu.id) || `menu-${index}`,
  }));
}

function extractMenuItemsFromHtml(html) {
  const candidates = [];
  const apolloState = extractApolloStateFromHtml(html);

  if (apolloState) {
    walkForMenuCandidates(apolloState, candidates);
  }

  for (const jsonBlock of extractJsonBlocksFromHtml(html)) {
    walkForMenuCandidates(jsonBlock, candidates);
  }

  let deduped = dedupeMenuItems(candidates);
  if (deduped.length > 0) {
    return deduped;
  }

  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(li|p|div|span|strong|em|a|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const lines = stripHtmlTags(text)
    .split(/\n+/)
    .map((line) => normalizeWhitespace(decodeHtmlEntities(line)))
    .filter(Boolean);

  const lineCandidates = [];
  const pricePattern = /(\d{1,3}(,\d{3})*)(\s*원)?$/;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const priceMatch = line.match(pricePattern);
    if (!priceMatch) {
      continue;
    }

    const nameFromSameLine = normalizeWhitespace(line.replace(pricePattern, ""));
    const previousLine = lines[index - 1] || "";
    const menuName =
      sanitizeText(nameFromSameLine) || sanitizeText(previousLine);

    if (!menuName || menuName.length > 80) {
      continue;
    }

    if (
      ["이미지", "리뷰", "안내", "원산지", "사진"].some((blocked) =>
        menuName.includes(blocked)
      )
    ) {
      continue;
    }

    lineCandidates.push({
      id: `html-menu-${lineCandidates.length}`,
      index: lineCandidates.length,
      name: menuName,
      price: formatWon(priceMatch[1]),
      description: null,
      recommend: false,
      images: [],
      raw: {
        source: "html-fallback",
        line,
      },
    });
  }

  deduped = dedupeMenuItems(lineCandidates);
  return deduped;
}

async function searchPlaces(query, options = {}) {
  const display = Number(options.display || PCMAP_SEARCH_DISPLAY);
  const maxPages = Number(options.maxPages || PCMAP_SEARCH_MAX_PAGES);
  const candidatesByPlaceId = new Map();
  const pageReports = [];
  let totalAvailable = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const pageResult = await fetchPcmapSearchPage(query, page, {
      display,
      x: options.x,
      y: options.y,
      clientX: options.clientX,
      clientY: options.clientY,
    });
    const extracted = extractPcmapSearchCandidates(pageResult.html);

    totalAvailable = Math.max(totalAvailable, extracted.totalAvailable);
    for (const candidate of extracted.candidates) {
      if (!candidate.placeId || candidatesByPlaceId.has(candidate.placeId)) {
        continue;
      }
      candidatesByPlaceId.set(candidate.placeId, candidate);
    }

    pageReports.push({
      page,
      url: pageResult.url,
      candidateCount: extracted.candidates.length,
      totalAvailable: extracted.totalAvailable,
    });

    if (
      extracted.candidates.length === 0 ||
      extracted.candidates.length < display
    ) {
      break;
    }
  }

  const candidates = Array.from(candidatesByPlaceId.values());

  if (PCMAP_SAVE_SEARCH_DEBUG) {
    saveJson(`${buildSearchPageKey(query, "results")}-pcmap-search-results.json`, {
      query,
      totalAvailable,
      candidates,
      pageReports,
    });
  }

  return {
    query,
    totalAvailable,
    candidates,
    pageReports,
  };
}

async function fetchPlaceDetail(placeId) {
  const menuPageResult = await fetchMenuPageHtml(placeId);
  const apolloState = extractApolloStateFromHtml(menuPageResult.html);
  const extractedPlaceData = extractPlaceDataFromApolloState(apolloState, placeId);
  const menus =
    extractedPlaceData?.menus?.length > 0
      ? extractedPlaceData.menus
      : extractMenuItemsFromHtml(menuPageResult.html);

  const placeData = {
    ...(extractedPlaceData || {}),
    placeId: sanitizeText(placeId),
    menus,
  };

  if (PCMAP_SAVE_DETAIL_DEBUG) {
    if (apolloState) {
      saveJson("pcmap-place-apollo-state.json", apolloState);
    }
    saveJson("pcmap-place-data.json", placeData);
  }

  return {
    placeId: sanitizeText(placeId),
    menuPageResult: {
      ...menuPageResult,
      apolloState,
    },
    placeData,
  };
}

module.exports = {
  extractApolloStateFromHtml,
  extractMenuItemsFromHtml,
  extractPcmapPlacesResult,
  fetchMenuPageHtml,
  fetchPlaceDetail,
  searchPlaces,
};
