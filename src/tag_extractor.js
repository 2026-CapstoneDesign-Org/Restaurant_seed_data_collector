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
  createMenuRule("김치찌개", ["김치찌개"], "찌개", 63),
  createMenuRule("된장찌개", ["된장찌개"], "찌개", 62),
  createMenuRule("부대찌개", ["부대찌개"], "찌개", 61),
  createMenuRule("순두부", ["순두부", "순두부찌개"], "찌개", 60),
  createMenuRule("제육", ["제육", "제육볶음"], null, 59),
  createMenuRule("삼겹살", ["삼겹살"], "구이", 58),
  createMenuRule("곱창", ["곱창"], "구이", 57),
  createMenuRule("막창", ["막창"], "구이", 56),
  createMenuRule("닭발", ["닭발"], null, 55),
  createMenuRule("보쌈", ["보쌈"], null, 54),
  createMenuRule("족발", ["족발"], null, 53),
  createMenuRule("마라탕", ["마라탕", "마라샹궈"], null, 52),
  createMenuRule("양꼬치", ["양꼬치"], null, 51),
  createMenuRule("쭈꾸미", ["쭈꾸미", "주꾸미"], null, 50),
  createMenuRule("찜닭", ["찜닭"], null, 49),
  createMenuRule("닭볶음탕", ["닭볶음탕", "닭도리탕"], null, 48),
  createMenuRule("아구찜", ["아구찜", "아귀찜"], "찜", 47),
  createMenuRule("해물찜", ["해물찜"], "찜", 46),
  createMenuRule("텐동", ["텐동"], "덮밥", 45),
  createMenuRule("포케", ["포케"], null, 44),
  createMenuRule("샐러드", ["샐러드"], null, 43),
  createMenuRule("타코", ["타코"], null, 42),
  createMenuRule("버거", ["버거", "햄버거"], null, 41),
  createMenuRule("샌드위치", ["샌드위치"], null, 40),
  createMenuRule("아메리카노", ["아메리카노", "카페 아메리카노"], "커피", 39),
  createMenuRule("카페라떼", ["카페라떼", "카페 라떼"], "라떼", 38),
  createMenuRule("바닐라라떼", ["바닐라라떼", "바닐라 라떼"], "라떼", 37),
  createMenuRule("초코라떼", ["초코라떼", "초코 라떼"], "라떼", 36),
  createMenuRule("딸기라떼", ["딸기라떼", "딸기 라떼"], "라떼", 35),
  createMenuRule("돌체라떼", ["돌체라떼", "돌체 라떼"], "라떼", 34),
  createMenuRule("말차라떼", ["말차라떼", "말차 라떼"], "라떼", 33),
  createMenuRule("라떼", ["라떼"], "커피", 32),
  createMenuRule("카페모카", ["카페모카", "카페 모카"], "커피", 31),
  createMenuRule("카푸치노", ["카푸치노"], "커피", 30),
  createMenuRule("에스프레소", ["에스프레소"], "커피", 29),
  createMenuRule("아인슈페너", ["아인슈페너"], "커피", 28),
  createMenuRule("아포카토", ["아포카토", "아포가토"], "커피", 27),
  createMenuRule("아샷추", ["아샷추"], "커피", 26),
  createMenuRule("아이스티", ["아이스티"], null, 25),
  createMenuRule("자몽에이드", ["자몽에이드", "자몽 에이드"], "에이드", 24),
  createMenuRule("레몬에이드", ["레몬에이드", "레몬 에이드"], "에이드", 23),
  createMenuRule("에이드", ["에이드"], null, 22),
  createMenuRule("대추차", ["대추차"], null, 21),
  createMenuRule("계란찜", ["계란찜", "달걀찜"], "찜", 20),
  createMenuRule("탕수육", ["탕수육"], null, 19),
  createMenuRule("사천탕수육", ["사천탕수육"], "탕수육", 18),
  createMenuRule("꿔바로우", ["꿔바로우"], null, 17),
  createMenuRule("깐풍기", ["깐풍기"], null, 16),
  createMenuRule("양장피", ["양장피"], null, 15),
  createMenuRule("유린기", ["유린기"], null, 14),
  createMenuRule("지삼선", ["지삼선"], null, 13),
  createMenuRule("짜장면", ["짜장면", "자장면"], null, 12),
  createMenuRule("간짜장", ["간짜장"], "짜장면", 11),
  createMenuRule("볶음밥", ["볶음밥"], null, 10),
  createMenuRule("새우볶음밥", ["새우볶음밥", "새우 볶음밥"], "볶음밥", 9),
  createMenuRule("김치볶음밥", ["김치볶음밥", "김치 볶음밥"], "볶음밥", 8),
  createMenuRule("잡채밥", ["잡채밥"], "덮밥", 7),
  createMenuRule("육개장", ["육개장"], null, 6),
  createMenuRule("황태해장국", ["황태해장국", "황태 해장국"], "해장국", 5),
  createMenuRule("내장탕", ["내장탕"], null, 4),
  createMenuRule("술국", ["술국"], null, 3),
  createMenuRule("어묵탕", ["어묵탕", "오뎅탕"], null, 2),
  createMenuRule("쫄면", ["쫄면"], null, 1),
  createMenuRule("라면", ["라면"], null, 0),
  createMenuRule("오므라이스", ["오므라이스"], null, -1),
  createMenuRule("떡국", ["떡국"], null, -2),
  createMenuRule("메밀전병", ["메밀전병"], null, -3),
  createMenuRule("주먹밥", ["주먹밥"], null, -4),
  createMenuRule("튀김", ["튀김"], null, -5),
  createMenuRule("감자튀김", ["감자튀김", "감자 튀김", "프렌치프라이"], "튀김", -6),
  createMenuRule("새우튀김", ["새우튀김", "새우 튀김"], "튀김", -7),
  createMenuRule("야채튀김", ["야채튀김", "야채 튀김"], "튀김", -8),
  createMenuRule("오징어튀김", ["오징어튀김", "오징어 튀김"], "튀김", -9),
  createMenuRule("후라이드", ["후라이드", "프라이드"], "치킨", -10),
  createMenuRule("소금빵", ["소금빵", "소금 빵"], null, -11),
  createMenuRule("단팥빵", ["단팥빵", "단팥 빵"], null, -12),
  createMenuRule("까르보나라", ["까르보나라"], "파스타", -13),
  createMenuRule("크림새우", ["크림새우", "크림 새우"], null, -14),
  createMenuRule("크림치즈볼", ["크림치즈볼", "크림 치즈볼"], null, -15),
  createMenuRule("수육", ["수육"], null, -16),
  createMenuRule("순대", ["순대"], null, -17),
  createMenuRule("토종순대", ["토종순대", "토종 순대"], "순대", -18),
  createMenuRule("오소리감투", ["오소리감투"], null, -19),
  createMenuRule("소주", ["소주"], null, -20),
  createMenuRule("막걸리", ["막걸리"], null, -21),
  createMenuRule("청하", ["청하"], null, -22),
];

const CATEGORY_SPLIT_PATTERN = /\s*(?:,|\/|&|·)\s*|\s+및\s+|\s+and\s+/i;
const MENU_SEGMENT_SPLIT_PATTERN = /\+|\/|,|&|\s+와\s+|\s+및\s+/;
const TAG_PARENT_PREFIXES = ["menu:", "category:"];
const TAG_CANDIDATE_POLICY = {
  autoTagCreationEnabled: false,
  reviewMinMenuOccurrenceCount: 3,
  reviewMinRestaurantCount: 2,
  approvalMinMenuOccurrenceCount: 5,
  approvalMinRestaurantCount: 3,
  minNameLength: 2,
  maxNameLength: 20,
  maxWordCount: 4,
  maxDigitRatio: 0.4,
  blockedKeywords: [
    "네이버",
    "예약",
    "주문",
    "스마트콜",
    "식신",
    "명지대",
    "에버라인",
    "배달",
    "리뷰",
    "세트",
    "정식",
    "코스",
  ],
  blockedExactNames: [
    "공기밥",
    "음료수",
    "대표메뉴",
    "인기메뉴",
    "다이닝코드",
  ],
  trailingSuffixTokens: ["세트", "정식", "코스", "플래터", "모둠", "한상", "도시락"],
};
const MENU_TAG_CONTEXT_POLICY = {
  blockedAliasSuffixes: ["맛", "향", "소스", "국물", "육수"],
  blockedFollowingTokens: ["소스", "국물", "육수", "시즈닝"],
};

function createMenuRule(tagName, aliases, parentTagName = null, priority = 0) {
  return {
    tagName,
    tagKey: buildTagKey("menu", tagName),
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
    if (rule.aliases.some((alias) => matchesMenuAlias(normalizedSegment, alias))) {
      return rule;
    }
  }

  return null;
}

function matchesMenuAlias(normalizedSegment, alias) {
  const aliasIndex = normalizedSegment.indexOf(alias);
  if (aliasIndex < 0) {
    return false;
  }

  const compactTail = normalizedSegment.slice(aliasIndex + alias.length).replace(/\s+/g, "");
  if (
    MENU_TAG_CONTEXT_POLICY.blockedAliasSuffixes.some((suffix) =>
      compactTail.startsWith(suffix)
    )
  ) {
    return false;
  }

  const tokens = normalizedSegment.split(/\s+/).filter(Boolean);
  const aliasTokenIndex = tokens.findIndex((token) => token.includes(alias));
  if (aliasTokenIndex >= 0) {
    const nextToken = tokens[aliasTokenIndex + 1];
    if (MENU_TAG_CONTEXT_POLICY.blockedFollowingTokens.includes(nextToken)) {
      return false;
    }
  }

  return true;
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

function stripTrailingCandidateTokens(value) {
  const tokens = normalizeMenuName(value)
    .split(/\s+/)
    .map((token) => sanitizeText(token))
    .filter(Boolean);

  while (
    tokens.length > 1 &&
    TAG_CANDIDATE_POLICY.trailingSuffixTokens.includes(tokens[tokens.length - 1])
  ) {
    tokens.pop();
  }

  return tokens.join(" ");
}

function evaluateTagCandidateName(candidateName) {
  const normalizedCandidateName = stripTrailingCandidateTokens(candidateName);
  const compactName = normalizedCandidateName.replace(/\s+/g, "");
  const digitCount = compactName.replace(/[^\d]/g, "").length;
  const reasons = [];

  if (!normalizedCandidateName) {
    reasons.push("empty-name");
  }

  if (compactName.length < TAG_CANDIDATE_POLICY.minNameLength) {
    reasons.push("too-short");
  }

  if (compactName.length > TAG_CANDIDATE_POLICY.maxNameLength) {
    reasons.push("too-long");
  }

  if (!/[가-힣A-Za-z]/.test(normalizedCandidateName)) {
    reasons.push("no-letter");
  }

  if (
    normalizedCandidateName.split(/\s+/).filter(Boolean).length >
    TAG_CANDIDATE_POLICY.maxWordCount
  ) {
    reasons.push("too-many-words");
  }

  if (digitCount && digitCount === compactName.length) {
    reasons.push("digits-only");
  } else if (
    digitCount &&
    digitCount / compactName.length > TAG_CANDIDATE_POLICY.maxDigitRatio
  ) {
    reasons.push("too-many-digits");
  }

  if (
    TAG_CANDIDATE_POLICY.blockedKeywords.some((keyword) =>
      normalizedCandidateName.includes(keyword)
    )
  ) {
    reasons.push("blocked-keyword");
  }

  if (TAG_CANDIDATE_POLICY.blockedExactNames.includes(normalizedCandidateName)) {
    reasons.push("blocked-exact-name");
  }

  if (
    normalizedCandidateName &&
    extractMenuTagMatches(normalizedCandidateName).length > 0
  ) {
    reasons.push("covered-by-existing-tag");
  }

  return {
    normalizedCandidateName,
    accepted: reasons.length === 0,
    reasons,
  };
}

function buildCandidateRecord(candidateName, stats, decision, decisionReasons) {
  return {
    candidate_name: candidateName,
    candidate_tag_key: buildTagKey("menu", candidateName),
    decision,
    decision_reasons: decisionReasons,
    menu_occurrence_count: stats.menuOccurrenceCount,
    distinct_restaurant_count: stats.restaurantIds.size,
    sample_restaurant_names: Array.from(stats.restaurantNames).slice(0, 5),
    sample_menu_names: Array.from(stats.menuNames).slice(0, 10),
  };
}

function validateTagDefinition(definition) {
  if (!definition?.tagKey || !definition?.tagName) {
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

  if (definition.tagName.length < 2) {
    return {
      accepted: false,
      reason: "tag-too-short",
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

function buildTagCandidateReport(tagSources, existingTags = []) {
  const candidateStatsByName = new Map();
  let totalMenuCount = 0;
  let matchedMenuCount = 0;
  let unmatchedMenuCount = 0;

  for (const source of tagSources) {
    for (const menu of source.menus || []) {
      const menuName = sanitizeText(menu?.name);
      const normalizedMenuName = normalizeMenuName(menuName);

      if (!normalizedMenuName) {
        continue;
      }

      totalMenuCount += 1;

      if (extractMenuTagMatches(normalizedMenuName).length > 0) {
        matchedMenuCount += 1;
        continue;
      }

      unmatchedMenuCount += 1;

      const segments = splitMenuSegments(normalizedMenuName);
      const candidateNames = Array.from(
        new Set(
          (segments.length ? segments : [normalizedMenuName])
            .map((segment) => stripTrailingCandidateTokens(segment))
            .map((segment) => sanitizeText(segment))
            .filter(Boolean)
        )
      );

      for (const candidateName of candidateNames) {
        const stats = candidateStatsByName.get(candidateName) || {
          menuOccurrenceCount: 0,
          restaurantIds: new Set(),
          restaurantNames: new Set(),
          menuNames: new Set(),
        };

        stats.menuOccurrenceCount += 1;
        stats.restaurantIds.add(source.restaurantSeedIndex);

        if (source.restaurantName) {
          stats.restaurantNames.add(source.restaurantName);
        }

        stats.menuNames.add(menuName);
        candidateStatsByName.set(candidateName, stats);
      }
    }
  }

  const approvalCandidates = [];
  const reviewCandidates = [];
  const watchlistCandidates = [];
  const blockedCandidates = [];
  const blockedReasonSummary = new Map();

  for (const [candidateName, stats] of candidateStatsByName.entries()) {
    const evaluation = evaluateTagCandidateName(candidateName);

    if (!evaluation.accepted) {
      blockedCandidates.push(
        buildCandidateRecord(candidateName, stats, "BLOCKED", evaluation.reasons)
      );

      evaluation.reasons.forEach((reason) => {
        blockedReasonSummary.set(reason, (blockedReasonSummary.get(reason) || 0) + 1);
      });
      continue;
    }

    if (
      stats.menuOccurrenceCount >= TAG_CANDIDATE_POLICY.approvalMinMenuOccurrenceCount &&
      stats.restaurantIds.size >= TAG_CANDIDATE_POLICY.approvalMinRestaurantCount
    ) {
      approvalCandidates.push(
        buildCandidateRecord(candidateName, stats, "APPROVAL_READY", [
          "meets-approval-threshold",
        ])
      );
      continue;
    }

    if (
      stats.menuOccurrenceCount >= TAG_CANDIDATE_POLICY.reviewMinMenuOccurrenceCount &&
      stats.restaurantIds.size >= TAG_CANDIDATE_POLICY.reviewMinRestaurantCount
    ) {
      reviewCandidates.push(
        buildCandidateRecord(candidateName, stats, "REVIEW_READY", [
          "meets-review-threshold",
        ])
      );
      continue;
    }

    watchlistCandidates.push(
      buildCandidateRecord(candidateName, stats, "WATCHLIST", [
        "insufficient-frequency",
      ])
    );
  }

  const sortCandidates = (left, right) => {
    if (right.distinct_restaurant_count !== left.distinct_restaurant_count) {
      return right.distinct_restaurant_count - left.distinct_restaurant_count;
    }

    if (right.menu_occurrence_count !== left.menu_occurrence_count) {
      return right.menu_occurrence_count - left.menu_occurrence_count;
    }

    return left.candidate_name.localeCompare(right.candidate_name, "ko");
  };

  return {
    generated_at: new Date().toISOString(),
    policy: {
      ...TAG_CANDIDATE_POLICY,
      current_tag_count: existingTags.length,
      note: "APPROVAL_READY also requires manual review and explicit MENU_TAG_RULES update.",
    },
    summary: {
      total_menu_count: totalMenuCount,
      matched_menu_count: matchedMenuCount,
      unmatched_menu_count: unmatchedMenuCount,
      unique_unmatched_candidate_count: candidateStatsByName.size,
      approval_ready_count: approvalCandidates.length,
      review_ready_count: reviewCandidates.length,
      watchlist_count: watchlistCandidates.length,
      blocked_count: blockedCandidates.length,
    },
    approval_ready_candidates: approvalCandidates.sort(sortCandidates),
    review_ready_candidates: reviewCandidates.sort(sortCandidates),
    watchlist_candidates: watchlistCandidates.sort(sortCandidates),
    blocked_candidates: blockedCandidates.sort(sortCandidates),
    blocked_reason_summary: Array.from(blockedReasonSummary.entries())
      .map(([reason, count]) => ({
        reason,
        count,
      }))
      .sort((left, right) => right.count - left.count),
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
        matched_menu_count: tagRow.matched_menu_count,
        is_primary: tagRow.tag_key === primaryMenuTagKey,
      });
    });
  }

  const tags = Array.from(tagDefinitionsByKey.values()).sort((left, right) =>
    left.tag_name.localeCompare(right.tag_name, "ko")
  );

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
    candidateReport: buildTagCandidateReport(tagSources, tags),
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
  const menus = Array.isArray(store?.menus) ? store.menus : [];

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
  TAG_CANDIDATE_POLICY,
  buildTagCandidateReport,
  buildRestaurantTagPreview,
  buildTagKey,
  buildTagSourceFromRestaurantRow,
  buildTagSourceFromStore,
  extractMenuTagMatches,
  normalizeCategoryParts,
  resolvePrimaryMenuTag,
};
