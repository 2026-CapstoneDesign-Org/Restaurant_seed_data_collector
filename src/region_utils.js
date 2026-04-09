const { sanitizeText } = require("./utils");

const CITY_SUFFIX = "시";
const DISTRICT_SUFFIX = "구";
const COUNTY_SUFFIX = "군";

function tokenizeAddressParts(...values) {
  return values
    .flatMap((value) => sanitizeText(value).split(/\s+/))
    .map((token) => sanitizeText(token))
    .filter(Boolean);
}

function findLastTokenWithSuffix(tokens, suffix) {
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (tokens[index].endsWith(suffix)) {
      return tokens[index];
    }
  }

  return "";
}

function buildRegionSchema(fallbackRegionName, ...values) {
  const tokens = tokenizeAddressParts(...values);
  const county = findLastTokenWithSuffix(tokens, COUNTY_SUFFIX);

  if (county) {
    return {
      regionName: county,
      regionCityName: null,
      regionDistrictName: null,
      regionCountyName: county,
      regionFilterNames: [county],
    };
  }

  const city = findLastTokenWithSuffix(tokens, CITY_SUFFIX);
  const district = findLastTokenWithSuffix(tokens, DISTRICT_SUFFIX);

  if (city && district) {
    return {
      regionName: `${city} ${district}`,
      regionCityName: city,
      regionDistrictName: district,
      regionCountyName: null,
      regionFilterNames: [city, district],
    };
  }

  if (city) {
    return {
      regionName: city,
      regionCityName: city,
      regionDistrictName: null,
      regionCountyName: null,
      regionFilterNames: [city],
    };
  }

  if (district) {
    return {
      regionName: district,
      regionCityName: null,
      regionDistrictName: district,
      regionCountyName: null,
      regionFilterNames: [district],
    };
  }

  const fallback = sanitizeText(fallbackRegionName);

  return {
    regionName: fallback,
    regionCityName: null,
    regionDistrictName: null,
    regionCountyName: null,
    regionFilterNames: fallback ? [fallback] : [],
  };
}

module.exports = {
  buildRegionSchema,
};
