const { sanitizeText } = require("./utils");

const CITY_SUFFIX = "\uC2DC";
const DISTRICT_SUFFIX = "\uAD6C";
const COUNTY_SUFFIX = "\uAD70";
const TOWN_SUFFIXES = ["\uC74D", "\uBA74", "\uB3D9", "\uB9AC"];
const COUNTY_TOWN_SUFFIXES = ["\uC74D", "\uBA74"];
const DISTRICT_TOWN_SUFFIXES = ["\uB3D9"];
const BUILDING_DONG_PATTERN = /^(?:\S*?)(?:\d+|[A-Za-z]+)\uB3D9$/;

function tokenizeAddressParts(...values) {
  return values
    .flatMap((value) => sanitizeText(value).split(/\s+/))
    .map((token) => sanitizeText(token))
    .filter(Boolean);
}

function compactRegionFilterNames(...values) {
  return Array.from(
    new Set(values.map((value) => sanitizeText(value)).filter(Boolean))
  );
}

function findLastTokenWithSuffix(tokens, suffix) {
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (tokens[index].endsWith(suffix)) {
      return { token: tokens[index], index };
    }
  }

  return { token: "", index: -1 };
}

function hasTownSuffix(token, suffixes) {
  return suffixes.some((suffix) => token.endsWith(suffix));
}

function isAdministrativeTownToken(token) {
  if (!token) {
    return false;
  }

  const normalized = sanitizeText(token);
  if (!normalized) {
    return false;
  }

  if (hasTownSuffix(normalized, TOWN_SUFFIXES)) {
    return !BUILDING_DONG_PATTERN.test(normalized);
  }

  return /.+(?:\d)?\uAC00$/.test(normalized);
}

function isDistrictTownToken(token) {
  if (!isAdministrativeTownToken(token)) {
    return false;
  }

  const normalized = sanitizeText(token);
  return hasTownSuffix(normalized, DISTRICT_TOWN_SUFFIXES) || /.+(?:\d)?\uAC00$/.test(normalized);
}

function isCountyTownToken(token) {
  if (!isAdministrativeTownToken(token)) {
    return false;
  }

  return hasTownSuffix(sanitizeText(token), COUNTY_TOWN_SUFFIXES);
}

function findTownToken(tokens, anchorIndex, predicate = isAdministrativeTownToken) {
  const startIndex = anchorIndex < 0 ? 0 : anchorIndex + 1;
  for (let index = startIndex; index < tokens.length; index += 1) {
    if (predicate(tokens[index])) {
      return tokens[index];
    }
  }

  return "";
}

function buildRegionSchema(fallbackRegionName, addressValue, ...fallbackValues) {
  const primaryTokens = tokenizeAddressParts(addressValue);
  const allTokens = tokenizeAddressParts(addressValue, ...fallbackValues);

  const primaryCounty = findLastTokenWithSuffix(primaryTokens, COUNTY_SUFFIX);
  const primaryCity = findLastTokenWithSuffix(primaryTokens, CITY_SUFFIX);
  const primaryDistrict = findLastTokenWithSuffix(primaryTokens, DISTRICT_SUFFIX);
  const fallbackCounty = findLastTokenWithSuffix(allTokens, COUNTY_SUFFIX);
  const fallbackCity = findLastTokenWithSuffix(allTokens, CITY_SUFFIX);
  const fallbackDistrict = findLastTokenWithSuffix(allTokens, DISTRICT_SUFFIX);

  const county = primaryCounty.token || fallbackCounty.token;
  const city = primaryCity.token || fallbackCity.token;
  const district = primaryDistrict.token || fallbackDistrict.token;

  const townAnchorIndex = county
    ? (primaryCounty.token ? primaryCounty.index : -1)
    : district
      ? (primaryDistrict.token ? primaryDistrict.index : -1)
      : primaryCity.index;
  const town = county
    ? findTownToken(primaryTokens, townAnchorIndex, isCountyTownToken)
    : district
      ? findTownToken(primaryTokens, townAnchorIndex, isDistrictTownToken)
        || findTownToken(primaryTokens, townAnchorIndex, isCountyTownToken)
      : findTownToken(primaryTokens, townAnchorIndex);

  if (county) {
    return {
      regionName: county,
      regionCityName: city || null,
      regionDistrictName: null,
      regionCountyName: county,
      regionTownName: town || null,
      regionFilterNames: compactRegionFilterNames(city, county, town),
    };
  }

  if (city && district) {
    return {
      regionName: `${city} ${district}`,
      regionCityName: city,
      regionDistrictName: district,
      regionCountyName: null,
      regionTownName: town || null,
      regionFilterNames: compactRegionFilterNames(city, district, town),
    };
  }

  if (city) {
    return {
      regionName: city,
      regionCityName: city,
      regionDistrictName: null,
      regionCountyName: null,
      regionTownName: town || null,
      regionFilterNames: compactRegionFilterNames(city, town),
    };
  }

  if (district) {
    return {
      regionName: district,
      regionCityName: null,
      regionDistrictName: district,
      regionCountyName: null,
      regionTownName: town || null,
      regionFilterNames: compactRegionFilterNames(district, town),
    };
  }

  const fallback = sanitizeText(fallbackRegionName);

  return {
    regionName: fallback,
    regionCityName: null,
    regionDistrictName: null,
    regionCountyName: null,
    regionTownName: town || null,
    regionFilterNames: compactRegionFilterNames(fallback, town),
  };
}

module.exports = {
  buildRegionSchema,
};
