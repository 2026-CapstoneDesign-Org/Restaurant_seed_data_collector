const { normalizeMenuName } = require("./menu_normalizer");
const { sanitizeText } = require("./utils");

const MENU_TAG_RULES = [
  createMenuRule("카츠동", ["카츠동", "안심카츠동", "돈카츠동"], "덮밥", 120),
  createMenuRule("사케동", ["사케동"], "덮밥", 115),
  createMenuRule("규동", ["규동"], "덮밥", 110),
  createMenuRule("라멘", ["돈코츠라멘", "라멘"], null, 105),
  createMenuRule("초밥", ["초밥"], null, 100),
  createMenuRule("우동", ["우동"], null, 95),
  createMenuRule("소바", ["소바", "모밀"], null, 94),
  createMenuRule("냉면", ["냉면"], null, 93),
  createMenuRule("쌀국수", ["쌀국수"], "국수", 92),
  createMenuRule("막국수", ["막국수"], "국수", 91),
  createMenuRule("칼국수", ["칼국수"], "국수", 90),
  createMenuRule("국수", ["국수"], null, 89),
  createMenuRule("짬뽕", ["짬뽕"], null, 88),
  createMenuRule("떡볶이", ["떡볶이"], null, 87),
  createMenuRule("김밥", ["김밥"], null, 86),
  createMenuRule("비빔밥", ["비빔밥"], "덮밥", 85),
  createMenuRule("덮밥", ["덮밥", "차슈덮밥", "치킨마요덮밥", "유부동"], null, 84),
  createMenuRule("돈까스", ["돈까스", "돈카츠"], "카츠", 83),
  createMenuRule("카츠", ["카츠", "히레카츠", "치즈카츠"], null, 82),
  createMenuRule("국밥", ["국밥"], null, 81),
  createMenuRule("순대국", ["순댓국", "순대국"], "국밥", 80),
  createMenuRule("만둣국", ["만둣국"], "만두", 79),
  createMenuRule("만두", ["만두"], null, 78),
  createMenuRule("치킨", ["치킨"], null, 77),
  createMenuRule("피자", ["피자"], null, 76),
  createMenuRule("파스타", ["파스타"], null, 75),
  createMenuRule("샤브샤브", ["샤브샤브"], null, 74),
  createMenuRule("장어", ["장어"], null, 73),
  createMenuRule("갈비", ["갈비"], null, 72),
  createMenuRule("육회", ["육회"], null, 71),
  createMenuRule("물회", ["물회"], null, 70),
  createMenuRule("스테이크", ["스테이크"], null, 69),
  createMenuRule("장칼국수", ["장칼국수"], "국수", 68),
  createMenuRule("고로케", ["고로케"], null, 67),
  createMenuRule("하이볼", ["하이볼"], null, 66),
  createMenuRule("맥주", ["생맥주", "맥주"], null, 65),
  createMenuRule("와플", ["와플"], null, 64),
];

const CATEGORY_SPLIT_PATTERN = /\s*(?:,|\/|&|·)\s*|\s+및\s+|\s+and\s+/i;
const MENU_SEGMENT_SPLIT_PATTERN = /\+|\/|,|&|\s+와\s+|\s+및\s+/;
const TAG_PARENT_PREFIXES = ["menu:", "category:"];

function createMenuRule(tagName, aliases, parentTagName = null, priority = 0) {
  return {
    tagName,
    tagKey: buildTagKey("menu", tagName),
    tagType: "MENU",
    parentTagName,
    parentTagKey: parentTagName ? buildTagKey("menu", parentTagName) : null,
    priority,
    aliases: aliases
      .map((alias) => sanitizeText(alias))
      .filter(Boolean)
      .sort((left, right) => right.length - left.length),
  };
}

const SORTED_MENU_TAG_RULES = [...MENU_TAG_RULES].sort((left, right) => {
  const leftMaxAliasLength = Math.max(...left.aliases.map((alias) => alias.length));
  const rightMaxAliasLength = Math.max(
    ...right.aliases.map((alias) => alias.length)
  );

  if (rightMaxAliasLength !== leftMaxAliasLength) {
    return rightMaxAliasLength - leftMaxAliasLength;
  }

  return right.priority - left.priority;
});

function buildTagKey(prefix, name) {
  const normalized = sanitizeText(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .trim()
    .replace(/\s+/g, "-");

  return `${prefix}:${normalized}`;
}

function sanitizeArray(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => sanitizeText(value))
        .filter(Boolean)
    )
  );
}

function normalizeCategoryParts(value) {
  return sanitizeArray(
    sanitizeText(value)
      .split(CATEGORY_SPLIT_PATTERN)
      .map((part) => sanitizeText(part))
      .filter((part) => part.length >= 2)
  );
}

function splitMenuSegments(menuName) {
  const normalized = normalizeMenuName(menuName);
  if (!normalized) {
    return [];
  }

  const segments = normalized
    .split(MENU_SEGMENT_SPLIT_PATTERN)
    .map((segment) => sanitizeText(segment))
    .filter(Boolean);

  return segments.length > 0 ? segments : [normalized];
}

function findMenuRuleForSegment(segment) {
  const normalizedSegment = normalizeMenuName(segment);
  if (!normalizedSegment) {
    return null;
  }

  for (const rule of SORTED_MENU_TAG_RULES) {
    if (rule.aliases.some((alias) => normalizedSegment.includes(alias))) {
      return rule;
    }
  }

  return null;
}

function extractMenuTagMatches(menuName) {
  const segments = splitMenuSegments(menuName);
  const extractedRules = [];

  for (const segment of segments) {
    const matchedRule = findMenuRuleForSegment(segment);
    if (matchedRule) {
      extractedRules.push(matchedRule);
    }
  }

  if (extractedRules.length === 0) {
    const matchedWholeRule = findMenuRuleForSegment(menuName);
    if (matchedWholeRule) {
      extractedRules.push(matchedWholeRule);
    }
  }

  return Array.from(
    new Map(extractedRules.map((rule) => [rule.tagKey, rule])).values()
  );
}

function resolvePrimaryMenuTag(menuName) {
  return extractMenuTagMatches(menuName)[0] || null;
}

function roundWeight(value) {
  return Math.round(Number(value) * 100) / 100;
}

function validateTagDefinition(definition) {
  if (!definition?.tagKey || !definition?.tagName || !definition?.tagType) {
    return {
      accepted: false,
      reason: "missing-required-field",
    };
  }

  if (
    definition.parentTagKey &&
    !TAG_PARENT_PREFIXES.some((prefix) => definition.parentTagKey.startsWith(prefix))
  ) {
    return {
      accepted: false,
      reason: "invalid-parent-prefix",
    };
  }

  if (
    definition.parentTagKey &&
    !["MENU", "CATEGORY"].includes(definition.tagType)
  ) {
    return {
      accepted: false,
      reason: "parent-not-allowed-for-tag-type",
    };
  }

  if (definition.tagType === "CATEGORY" && definition.tagName.length < 2) {
    return {
      accepted: false,
      reason: "category-tag-too-short",
    };
  }

  if (definition.tagType === "MENU" && definition.tagName.length < 2) {
    return {
      accepted: false,
      reason: "menu-tag-too-short",
    };
  }

  return {
    accepted: true,
    reason: null,
  };
}

function pushValidationIssue(validationIssues, definition, validationResult, sourceText) {
  validationIssues.push({
    tag_key: definition?.tagKey || null,
    tag_name: definition?.tagName || null,
    tag_type: definition?.tagType || null,
    parent_tag_key: definition?.parentTagKey || null,
    source_text: sanitizeText(sourceText) || null,
    reason: validationResult.reason,
  });
}

function addTagDefinition(tagDefinitionsByKey, validationIssues, definition, sourceText) {
  if (!definition) {
    return false;
  }

  if (definition.parentTagName && definition.parentTagKey) {
    addTagDefinition(
      tagDefinitionsByKey,
      validationIssues,
      {
        tagKey: definition.parentTagKey,
        tagName: definition.parentTagName,
        tagType: definition.tagType,
        parentTagKey: null,
      },
      sourceText
    );
  }

  const validationResult = validateTagDefinition(definition);
  if (!validationResult.accepted) {
    pushValidationIssue(validationIssues, definition, validationResult, sourceText);
    return false;
  }

  if (!tagDefinitionsByKey.has(definition.tagKey)) {
    tagDefinitionsByKey.set(definition.tagKey, {
      tag_key: definition.tagKey,
      tag_name: definition.tagName,
      tag_type: definition.tagType,
      parent_tag_key: definition.parentTagKey || null,
      is_active: true,
    });
  }

  return true;
}

function addRestaurantTag(aggregatedTagsByKey, tagRow) {
  const existing = aggregatedTagsByKey.get(tagRow.tag_key);

  if (!existing) {
    aggregatedTagsByKey.set(tagRow.tag_key, {
      ...tagRow,
      source_text: sanitizeText(tagRow.source_text) || null,
    });
    return;
  }

  aggregatedTagsByKey.set(tagRow.tag_key, {
    ...existing,
    weight: roundWeight(existing.weight + tagRow.weight),
    confidence: Math.max(existing.confidence, tagRow.confidence),
    matched_menu_count: existing.matched_menu_count + tagRow.matched_menu_count,
    source_text: existing.source_text || tagRow.source_text,
  });
}

function createDynamicTagDefinition(tagType, tagName) {
  return {
    tagKey: buildTagKey(tagType.toLowerCase(), tagName),
    tagName,
    tagType,
    parentTagKey: null,
  };
}

function buildRestaurantTagPreview(tagSources) {
  const tagDefinitionsByKey = new Map();
  const restaurantTags = [];
  const validationIssues = [];

  for (const source of tagSources) {
    const aggregatedTagsByKey = new Map();

    for (const menu of source.menus || []) {
      const matchedRules = extractMenuTagMatches(menu.name);

      matchedRules.forEach((rule, index) => {
        const accepted = addTagDefinition(
          tagDefinitionsByKey,
          validationIssues,
          rule,
          menu.name
        );
        if (!accepted) {
          return;
        }

        addRestaurantTag(aggregatedTagsByKey, {
          tag_key: rule.tagKey,
          source_type: "MENU",
          source_text: menu.name,
          weight: roundWeight((index === 0 ? 5 : 3) + (menu.recommend ? 1 : 0)),
          confidence: index === 0 ? 0.95 : 0.8,
          matched_menu_count: 1,
          is_primary: false,
        });
      });
    }

    const aggregatedTags = Array.from(aggregatedTagsByKey.values()).sort((left, right) => {
      if (right.weight !== left.weight) {
        return right.weight - left.weight;
      }

      return left.tag_key.localeCompare(right.tag_key, "ko");
    });

    const primaryMenuTagKey = aggregatedTags
      .filter((tagRow) => tagRow.source_type === "MENU")
      .sort((left, right) => right.weight - left.weight)[0]?.tag_key;

    aggregatedTags.forEach((tagRow) => {
      restaurantTags.push({
        restaurant_seed_index: source.restaurantSeedIndex,
        tag_key: tagRow.tag_key,
        source_type: tagRow.source_type,
        source_text: tagRow.source_text,
        weight: tagRow.weight,
        confidence: tagRow.confidence,
        matched_menu_count: tagRow.matched_menu_count,
        is_primary: tagRow.tag_key === primaryMenuTagKey,
      });
    });
  }

  const tags = Array.from(tagDefinitionsByKey.values()).sort((left, right) => {
    if (left.tag_type !== right.tag_type) {
      return left.tag_type.localeCompare(right.tag_type, "ko");
    }

    return left.tag_name.localeCompare(right.tag_name, "ko");
  });

  return {
    tags: tags.map((tag, index) => ({
      seed_index: index + 1,
      ...tag,
    })),
    restaurantTags: restaurantTags.sort((left, right) => {
      if (left.restaurant_seed_index !== right.restaurant_seed_index) {
        return left.restaurant_seed_index - right.restaurant_seed_index;
      }

      if (right.weight !== left.weight) {
        return right.weight - left.weight;
      }

      return left.tag_key.localeCompare(right.tag_key, "ko");
    }),
    validationReport: {
      accepted_tag_count: tags.length,
      rejected_tag_count: validationIssues.length,
      rejected_tags: validationIssues,
    },
  };
}

function buildTagSourceFromStore(store, restaurantSeedIndex) {
  return {
    restaurantSeedIndex,
    restaurantName: sanitizeText(store?.name),
    menus: (store?.menus || []).map((menu) => ({
      name: sanitizeText(menu?.name || menu?.raw?.name),
      recommend: Boolean(menu?.recommend ?? menu?.raw?.recommend),
    })),
  };
}

function buildTagSourceFromRestaurantRow({
  restaurantSeedIndex,
  restaurantRow,
  categoryRow,
  store,
}) {
  const menus = Array.isArray(restaurantRow?.menu_json?.menus)
    ? restaurantRow.menu_json.menus
    : [];

  return {
    restaurantSeedIndex,
    restaurantName: sanitizeText(restaurantRow?.name || store?.name),
    menus: menus.map((menu) => ({
      name: sanitizeText(menu?.name),
      recommend: false,
    })),
  };
}

module.exports = {
  MENU_TAG_RULES,
  buildRestaurantTagPreview,
  buildTagKey,
  buildTagSourceFromRestaurantRow,
  buildTagSourceFromStore,
  extractMenuTagMatches,
  normalizeCategoryParts,
  resolvePrimaryMenuTag,
};
