const assert = require("assert");

const {
  TAG_CANDIDATE_POLICY,
  buildTagCandidateReport,
  extractMenuTagMatches,
} = require("./tag_extractor");

function tagNames(menuName) {
  return extractMenuTagMatches(menuName).map((tag) => tag.tagName);
}

function assertTags(menuName, expectedTagNames) {
  assert.deepStrictEqual(tagNames(menuName), expectedTagNames, menuName);
}

assertTags("진짜짬뽕", ["짬뽕"]);
assertTags("해물짬뽕", ["짬뽕"]);
assertTags("나가사키짬뽕", ["짬뽕"]);
assertTags("짬뽕밥", ["짬뽕"]);
assertTags("짬뽕면", ["짬뽕"]);

assertTags("짬뽕맛 감자튀김", ["감자튀김"]);
assertTags("짬뽕 소스", []);
assertTags("짬뽕국물", []);
assertTags("짬뽕육수", []);

assertTags("아이스 아메리카노", ["아메리카노"]);
assertTags("바닐라라떼", ["바닐라라떼"]);
assertTags("탕수육 소", ["탕수육"]);
assertTags("새우볶음밥", ["새우볶음밥"]);
assertTags("감자튀김", ["감자튀김"]);
assertTags("황태해장국", ["황태해장국"]);
assertTags("토종순대 한접시", ["토종순대"]);

const candidateReport = buildTagCandidateReport([
  { restaurantSeedIndex: 1, restaurantName: "A", menus: [{ name: "새로운특제면" }] },
  { restaurantSeedIndex: 2, restaurantName: "B", menus: [{ name: "새로운특제면" }] },
  { restaurantSeedIndex: 3, restaurantName: "C", menus: [{ name: "새로운특제면" }] },
  { restaurantSeedIndex: 4, restaurantName: "D", menus: [{ name: "새로운특제면" }] },
  { restaurantSeedIndex: 5, restaurantName: "E", menus: [{ name: "새로운특제면" }] },
]);

assert.strictEqual(TAG_CANDIDATE_POLICY.autoTagCreationEnabled, false);
assert.deepStrictEqual(
  candidateReport.approval_ready_candidates.map((candidate) => candidate.candidate_name),
  ["새로운특제면"]
);

console.log("tag extractor tests passed");
