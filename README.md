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
