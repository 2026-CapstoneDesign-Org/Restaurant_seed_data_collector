# Naver Seed

`Naver_seed`는 네이버 `pcmap` 기반 식당 seed 수집기다.
이 저장소는 수집, 1차 정규화, preview JSON 생성까지만 담당하고 DB 적재는 `Capstone/Capstone`이 담당한다.

기준일: `2026-04-10`

## 현재 기준

현재 활성 지역:

- `역북동`
- `삼가동`
- `남동`
- `김량장동`
- `서리`

현재 최신 `seed:refresh` + `combine` 결과:

- `restaurants`: `616`
- `restaurant_categories`: `616`
- `restaurant_menu_items`: `12822`
- `tags`: `37`
- `restaurant_tags`: `1072`

지역별 식당 수:

- `역북동`: `230`
- `삼가동`: `74`
- `남동`: `50`
- `김량장동`: `224`
- `서리`: `38`

## 역할 분리

- `Naver_seed`
  - `pcmap` 검색/상세 수집
  - 메뉴, region, tag 1차 정규화
  - import용 preview JSON 생성
- `Capstone/Capstone`
  - preview JSON import
  - `restaurants`, `restaurant_categories`, `restaurant_menu_items`, `tags`, `restaurant_tags` 반영

## 실행 명령

```bash
npm run help
npm run seed:areas
npm run seed
npm run seed:combine
npm run seed:refresh
```

설명:

- `npm run seed:areas`
  - 현재 활성 지역 출력
- `npm run seed`
  - `pcmap` 재수집 후 `output/` 생성
- `npm run seed:combine`
  - 현재 `output/` 기준 generic preview 재생성
- `npm run seed:refresh`
  - `seed`와 `combine` 연속 실행

## 수집 설정

수집 지역은 [`src/seed_config.js`](./src/seed_config.js)의 `RAW_AREA_CONFIGS`만 수정하면 된다.

현재 설정:

```js
const RAW_AREA_CONFIGS = ["역북동", "삼가동", "남동", "김량장동", "서리"];
```

새 지역 추가 예시:

```js
const RAW_AREA_CONFIGS = [
  "역북동",
  "삼가동",
  "남동",
  "김량장동",
  "서리",
  { name: "망포동", aliases: ["망포역"] },
];
```

가이드:

- 주소 문자열에 다른 행정명이 자주 섞이면 `aliases`를 같이 넣는다.
- 지역을 바꿨으면 반드시 `npm run seed:refresh`를 다시 돌린다.

## region 규칙

region은 동 기준이 아니라 `시/구/군` 기준으로 정규화한다.

- 시 + 구 주소
  - `region_name = "{시} {구}"`
  - 예: `용인시 처인구`
- 군 주소
  - `region_name = "{군}"`
  - 예: `가평군`

보조 필드:

- `region_city_name`
- `region_district_name`
- `region_county_name`
- `region_filter_names`

제약:

- `시`와 `구`는 같이 존재해야 한다.
- `군`이 존재하면 `시`, `구`는 같이 저장되면 안 된다.

## 메뉴 정규화 규칙

메뉴 이미지는 저장하지 않는다.
유지 필드는 아래 4개다.

- `name`
- `price_text`
- `price_value`
- `description`

정규화 결과는 두 곳에 들어간다.

- `restaurants-seed-preview.json`
  - 간소화된 `menu_json`
- `restaurant-menu-items-seed-preview.json`
  - 메뉴 row 단위 정규화 결과

추가 규칙:

- 비정상적으로 큰 가격은 `price_text`만 남기고 `price_value`는 `null`
- 검색/후처리는 `menu_json`보다 `restaurant-menu-items-seed-preview.json`을 우선 사용

## 태그 정책

태그는 `menu` 기반만 사용한다.

- `tags.tag_type = MENU`
- `restaurant_tags.source_type = MENU`
- `parent_tag_key`도 현재 정책상 `menu:`만 사용

예시:

- `수제 안심 카츠동` -> `카츠동`
- `숙성 연어 초밥` -> `초밥`
- `순대국밥` -> `국밥`

중요:

- `tags`는 자동 증식 대상이 아니다.
- `restaurant_tags`는 매 수집 때 다시 계산되는 파생 결과다.
- 신규 태그 후보는 `output/tag-candidate-report.json`으로만 보고, 실제 태그 승격은 `src/tag_extractor.js`의 `MENU_TAG_RULES` 수정으로만 한다.

## non-food 검증 규칙

현재 수집기에서는 아래 과정을 거친다.

1. 카테고리 기반 1차 제외
2. 상호명 키워드 기반 2차 제외
3. 메뉴 raw type 기반 신뢰도 검사
4. 수동 검수 후 exact block 적용

현재 수동 exact block:

- `명지카페`
- `막퍼주는 팔팔수산물 직판장`

이번 검수에서 제외된 대표 오탐:

- `한신판넬샌드위치판넬칸막이공사조립식판넬`
- `샌드위치판넬경량칸막이천장방수SMC석고텍스철거방음데코타일ALC`
- `CGV 드라이브인 용인크랙사이드`
- `아이엠지`
- `파티룸 르모먼트 스튜디오`

## manual review 후보

자동 제외까지는 하지 않았지만 메뉴 신뢰도가 낮은 식당은 `output/manual-review-candidates.json`으로 별도 저장한다.

용도:

- 메뉴가 버스 노선/지하철/안내 정보로만 파싱된 매장 재검수
- 다음 수집 전 exact block 또는 규칙 추가 판단

현재 최신 결과:

- `manual_review_candidate_count`: `0`
- `confirmed_restaurant_place_ids`: `11`

설명:

- 기존 review 후보 11건은 직접 검수 후 정상 음식점으로 확정했다.
- 다만 이 중 일부는 `pcmap` 메뉴 응답이 버스/지하철/리뷰 텍스트로만 들어와서, 식당은 유지하고 메뉴는 빈 배열로 정제했다.
- 즉 `restaurants`에는 적재되지만 `restaurant_menu_items`는 `0`건일 수 있다.

## output 파일

기본 결과물은 `output/` 아래에 생성된다.

- `pcmap-area-seed-result.json`
  - 수집 summary와 raw store payload
- `restaurants-seed-preview.json`
  - `Capstone.restaurants` import 기준
- `restaurant-categories-seed-preview.json`
  - `Capstone.restaurant_categories` import 기준
- `restaurant-menu-items-seed-preview.json`
  - `Capstone.restaurant_menu_items` import 기준
- `tags-seed-preview.json`
  - `Capstone.tags` import 기준
- `restaurant-tags-seed-preview.json`
  - `Capstone.restaurant_tags` import 기준
- `tag-validation-report.json`
  - 태그 검증 결과
- `tag-candidate-report.json`
  - 신규 태그 후보 검토용 결과
- `manual-review-candidates.json`
  - 메뉴 신뢰도 낮은 식당 재검토용 결과
- `combined-seed-summary.json`
  - combine 결과 요약
- `combined-seed-duplicates.json`
  - combine 중복 확인 결과

## Capstone import

### import 대상 파일

아래 5개 파일만 import 대상이다.

- `output/restaurants-seed-preview.json`
- `output/restaurant-categories-seed-preview.json`
- `output/restaurant-menu-items-seed-preview.json`
- `output/tags-seed-preview.json`
- `output/restaurant-tags-seed-preview.json`

관리용 파일이라 import하지 않는 것:

- `tag-validation-report.json`
- `tag-candidate-report.json`
- `manual-review-candidates.json`
- `combined-seed-summary.json`
- `combined-seed-duplicates.json`

### 복사

루트 디렉터리 기준:

```powershell
Copy-Item "Naver_pcmap_api/Naver_seed/output/restaurants-seed-preview.json" "Capstone/Capstone/seed-data/restaurants-seed-preview.json" -Force
Copy-Item "Naver_pcmap_api/Naver_seed/output/restaurant-categories-seed-preview.json" "Capstone/Capstone/seed-data/restaurant-categories-seed-preview.json" -Force
Copy-Item "Naver_pcmap_api/Naver_seed/output/restaurant-menu-items-seed-preview.json" "Capstone/Capstone/seed-data/restaurant-menu-items-seed-preview.json" -Force
Copy-Item "Naver_pcmap_api/Naver_seed/output/tags-seed-preview.json" "Capstone/Capstone/seed-data/tags-seed-preview.json" -Force
Copy-Item "Naver_pcmap_api/Naver_seed/output/restaurant-tags-seed-preview.json" "Capstone/Capstone/seed-data/restaurant-tags-seed-preview.json" -Force
```

### Capstone import 실행

```powershell
cd Capstone/Capstone
.\gradlew.bat bootRun --args="--seed.import.enabled=true --seed.import.exit-after-run=true --server.port=18080"
```

### dev DB 전체 초기화가 필요할 때

```powershell
docker exec postgres-dev psql -U dev_user -d dev_db -c "TRUNCATE TABLE list_restaurants, restaurant_categories, restaurant_menu_items, restaurant_tags, restaurants, tags, user_lists, users RESTART IDENTITY CASCADE;"
```

주의:

- 위 명령은 식당 seed만 지우는 게 아니라 `users`, `user_lists`, `list_restaurants`도 함께 비운다.

## 참고 문서

- [`SRC_FILE_GUIDE.md`](./SRC_FILE_GUIDE.md)
- [`../../NAVER_SEED_ANALYSIS_PLAN_2026-04-09.md`](../../NAVER_SEED_ANALYSIS_PLAN_2026-04-09.md)
