# Naver Seed

`Naver_seed`는 네이버 `pcmap` 기반 식당 seed 수집기다.  
역할은 수집과 1차 정규화까지이며, DB 적재는 `Capstone`이 담당한다.

현재 기준점:

- 수집 범위: `역북동`
- 결과 기준일: `2026-04-10`
- 최신 수집 결과
  - restaurants: `234`
  - restaurant_categories: `234`
  - restaurant_menu_items: `5027`
  - tags: `37`
  - restaurant_tags: `510`
- 태그 정책: `menu` 기반만 추출

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
  - 현재 활성 지역 확인
- `npm run seed`
  - `pcmap` 재수집 후 `output/` preview 생성
- `npm run seed:combine`
  - `output/` 기준 generic preview 재생성
- `npm run seed:refresh`
  - `seed`와 `combine` 연속 실행

## 현재 수집 규칙

### 1. 지역 설정

수집 지역은 [`src/seed_config.js`](./src/seed_config.js) 의 `RAW_AREA_CONFIGS`만 수정하면 된다.

현재 설정:

```js
const RAW_AREA_CONFIGS = ["역북동"];
```

새 지역을 추가하려면 예를 들어 이렇게 넣는다.

```js
const RAW_AREA_CONFIGS = [
  "역북동",
  "망포동",
  { name: "김량장동", aliases: ["중앙동"] },
];
```

가이드:

- 주소 문자열에 다른 행정명이 자주 섞이면 `aliases`를 같이 넣는다.
- 지역 추가 후 반드시 `npm run seed` 또는 `npm run seed:refresh`를 다시 실행한다.

### 2. region 정규화

region은 동 기준이 아니라 `시/구/군` 기준으로 만든다.

- 시 + 구 주소
  - `region_name = "{시} {구}"`
  - 예: `용인시 처인구`
- 군 주소
  - `region_name = "{군}"`
  - 예: `가평군`

필드 규칙:

- `region_city_name`
  - 시가 있을 때만 저장
- `region_district_name`
  - 구가 있을 때만 저장
- `region_county_name`
  - 군이 있을 때만 저장
- `region_filter_names`
  - 시 + 구 주소면 `["용인시", "처인구"]`
  - 군 주소면 `["가평군"]`

중요 규칙:

- 시와 구는 같이 존재해야 한다.
- 군이 존재하면 시와 구는 같이 저장되면 안 된다.

### 3. 메뉴 정규화

메뉴 이미지는 버리고 아래 필드만 유지한다.

- `name`
- `price_text`
- `price_value`
- `description`

정규화 결과는 두 군데에 저장된다.

- `restaurants-seed-preview.json`
  - 간소화된 `menu_json`
- `restaurant-menu-items-seed-preview.json`
  - 메뉴 row 단위 정규화 결과

### 4. 태그 추출 규칙

태그는 `menu`에서만 추출한다.  
`category`, `attribute`, `region`은 이제 `tags`, `restaurant_tags` 생성에 사용하지 않는다.

예시:

- `수제 안심 카츠동` -> `카츠동`
- `숙성 연어 초밥` -> `초밥`
- `순대국밥` -> `국밥`

현재 구현 파일:

- [`src/tag_extractor.js`](./src/tag_extractor.js)
- [`src/menu_normalizer.js`](./src/menu_normalizer.js)

현재 태그 규칙:

- `tags.tag_type`은 `MENU`만 생성
- `restaurant_tags.source_type`도 `MENU`만 생성
- `parent_tag_key`는 현재 실제 데이터 기준 `menu:`만 사용

### 5. 태그 검증 플로우

잘못된 짧은 태그가 들어가지 않도록 validation을 먼저 통과시킨다.

현재 검증:

- 필수값 없는 tag 제거
- `parent_tag_key` prefix 검증
- 너무 짧은 `MENU` tag 제거

검증 결과는 `output/tag-validation-report.json`에 저장한다.

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
- `combined-seed-summary.json`
  - combine 결과 요약
- `combined-seed-duplicates.json`
  - combine 중복 확인 결과

## output과 DB 매핑

### `restaurants-seed-preview.json`

대상 테이블: `restaurants`

주요 필드:

- `name`
- `address`
- `region_name`
- `region_city_name`
- `region_district_name`
- `region_county_name`
- `region_filter_names`
- `pcmap_place_id`
- `menu_json`
- `menu_updated_at`

### `restaurant-categories-seed-preview.json`

대상 테이블: `restaurant_categories`

주요 필드:

- `restaurant_seed_index`
- `category_name`

### `restaurant-menu-items-seed-preview.json`

대상 테이블: `restaurant_menu_items`

주요 필드:

- `restaurant_seed_index`
- `display_order`
- `source_menu_id`
- `menu_name`
- `normalized_menu_name`
- `menu_tag_key`
- `price_text`
- `price_value`
- `description`

### `tags-seed-preview.json`

대상 테이블: `tags`

주요 필드:

- `seed_index`
- `tag_key`
- `tag_name`
- `tag_type`
- `parent_tag_key`
- `is_active`

현재는 `MENU` tag만 들어간다.

### `restaurant-tags-seed-preview.json`

대상 테이블: `restaurant_tags`

주요 필드:

- `restaurant_seed_index`
- `tag_key`
- `source_type`
- `source_text`
- `weight`
- `confidence`
- `matched_menu_count`
- `is_primary`

현재는 `MENU` source만 들어간다.

## Capstone 연동 절차

1. `Naver_seed`에서 `npm run seed`
2. 필요하면 `npm run seed:combine`
3. 아래 파일을 `Capstone/Capstone/seed-data/`로 복사
   - `restaurants-seed-preview.json`
   - `restaurant-categories-seed-preview.json`
   - `restaurant-menu-items-seed-preview.json`
   - `tags-seed-preview.json`
   - `restaurant-tags-seed-preview.json`
   - `tag-validation-report.json`
4. `Capstone`에서 seed import 실행

## 빠른 검증 명령

```bash
node src/index.js areas
node -e "const fs=require('fs'); const tags=JSON.parse(fs.readFileSync('./output/tags-seed-preview.json','utf8')); console.log([...new Set(tags.map(tag => tag.tag_type))]);"
node -e "const fs=require('fs'); const rows=JSON.parse(fs.readFileSync('./output/restaurant-tags-seed-preview.json','utf8')); console.log([...new Set(rows.map(row => row.source_type))]);"
```

기대값:

- `tags.tag_type` -> `["MENU"]`
- `restaurant_tags.source_type` -> `["MENU"]`

## 2026-04-10 Tag Governance Update

`tags`와 `restaurant_tags`는 운영 방식이 다르다.

- `tags`
  - 승인된 canonical menu tag master
  - 자동으로 계속 늘리지 않는다
- `restaurant_tags`
  - 식당별 파생 결과
  - 새 지역, 새 식당이 들어올 때마다 계속 다시 계산한다

현재 정책:

- 태그 자동 생성은 `MENU_TAG_RULES`에 정의된 항목만 허용
- 신규 태그는 raw 데이터에서 바로 `tags`에 넣지 않음
- 대신 `tag-candidate-report.json`으로 후보를 검토한 뒤 수동으로 `MENU_TAG_RULES`에 추가

### 신규 태그 추가 조건

신규 menu tag는 아래 조건을 통과한 후보만 검토한다.

하드 필터:

- 메뉴 기반 후보여야 함
- 최소 글자 수 `2`
- 최대 글자 수 `20`
- 최대 단어 수 `4`
- 숫자 비율 `40%` 초과 금지
- 숫자만 있는 이름 금지
- 기존 tag로 이미 커버되는 이름 금지
- 플랫폼/서비스성 키워드 금지
  - 예: `네이버`, `예약`, `주문`, `스마트콜`, `식신`
- 즉시 제외 exact name
  - 예: `공기밥`, `음료수`, `대표메뉴`, `다이닝코드`

수량 조건:

- `APPROVAL_READY`
  - 메뉴 출현 수 `5` 이상
  - 서로 다른 식당 수 `3` 이상
- `REVIEW_READY`
  - 메뉴 출현 수 `3` 이상
  - 서로 다른 식당 수 `2` 이상

중요:

- `APPROVAL_READY`도 자동 반영이 아니다
- 최종 반영은 사람이 `MENU_TAG_RULES`를 수정하는 방식으로만 진행한다

### 신규 산출물

이제 아래 파일이 추가로 생성된다.

- `tag-candidate-report.json`
  - 신규 태그 후보 리포트
  - `APPROVAL_READY / REVIEW_READY / WATCHLIST / BLOCKED`로 분류

### 운영 권장 방식

1. 새 지역을 계속 수집한다
2. `restaurant_menu_items`와 `restaurant_tags`는 계속 누적/재계산한다
3. `tag-candidate-report.json`에서 반복 등장 후보를 본다
4. 승인할 태그만 `src/tag_extractor.js`의 `MENU_TAG_RULES`에 수동 추가한다

현재 `src/seed_config.js` 기준 활성 지역:

- `역북동`
- `삼가동`
- `남동`
- `김량장동`
- `서리`
