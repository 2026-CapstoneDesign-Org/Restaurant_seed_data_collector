# Naver Seed

`Naver_seed`는 네이버 `pcmap` 기반 식당 seed 수집기다.
이 저장소는 수집과 1차 정규화만 담당하고, DB 적재는 `Capstone/Capstone`이 담당한다.

기준일: `2026-04-10`

현재 활성 지역:

- `남동`
- `김량장동`
- `삼가동`
- `서리`

현재 최신 combine 결과:

- `restaurants`: `393`
- `restaurant_categories`: `393`
- `restaurant_menu_items`: `8103`
- `tags`: `35`
- `restaurant_tags`: `561`
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

수집 지역은 [`src/seed_config.js`](./src/seed_config.js)의 `RAW_AREA_CONFIGS`만 수정하면 된다.

현재 설정:

```js
const RAW_AREA_CONFIGS = ["삼가동", "남동", "김량장동", "서리"];
```

새 지역을 추가하려면 예를 들어 이렇게 넣는다.

```js
const RAW_AREA_CONFIGS = [
  "삼가동",
  "남동",
  "김량장동",
  "서리",
  { name: "역북동", aliases: ["역북"] },
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

combine 추가 가드:

- `combine-seed` 단계에서 현재 설정된 지역 토큰이 주소에 실제로 존재하는지 다시 확인한다.
- 상호명에 지역명이 우연히 포함된 오탐은 combine 단계에서 제외한다.

### 3. 메뉴 정규화

메뉴 이미지는 저장하지 않고 아래 필드만 유지한다.

- `name`
- `price_text`
- `price_value`
- `description`

정규화 결과는 두 군데에 저장된다.

- `restaurants-seed-preview.json`
  - 간소화된 `menu_json`
- `restaurant-menu-items-seed-preview.json`
  - 메뉴 row 단위 정규화 결과

추가 규칙:

- `price_value`는 숫자로 파싱 가능한 값만 저장한다.
- 영업시간 문자열이나 비정상적으로 큰 값은 `price_text`만 남기고 `price_value`는 `null`로 둔다.

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
- `parent_tag_key`는 현재 데이터 기준 `menu:`만 사용

### 5. 신규 태그 추가 정책

`tags`는 계속 자동으로 늘리는 대상이 아니라, 관리되는 canonical tag master로 본다.
새 지역을 추가해도 `restaurant_tags`는 계속 다시 생성하지만, `tags`는 후보 검토 후 수동 승인 방식으로만 늘린다.

생성 파일:

- `output/tag-validation-report.json`
- `output/tag-candidate-report.json`

정책 요약:

- `APPROVAL_READY`
  - 메뉴 등장 수와 식당 수가 충분하고, 명칭이 안정적인 후보
- `REVIEW_READY`
  - 후보성은 있지만 아직 수동 검토가 필요한 후보
- `WATCHLIST`
  - 더 많은 데이터가 쌓여야 판단 가능한 후보
- `BLOCKED`
  - 플랫폼 문구, 세트/정식류, 공기밥/음료수 같은 제외 대상

즉시 `tags`에 넣지 말고 `MENU_TAG_RULES`를 수정해서만 승격한다.

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

## Capstone 연동 순서

1. `Naver_seed`에서 `npm run seed:refresh`
2. 아래 5개 파일을 `Capstone/Capstone/seed-data/`로 복사
   - `restaurants-seed-preview.json`
   - `restaurant-categories-seed-preview.json`
   - `restaurant-menu-items-seed-preview.json`
   - `tags-seed-preview.json`
   - `restaurant-tags-seed-preview.json`
3. 필요하면 dev DB 초기화
4. `Capstone/Capstone`에서 seed import 실행

복사 예시:

```powershell
Copy-Item "output/restaurants-seed-preview.json" "../../Capstone/Capstone/seed-data/restaurants-seed-preview.json" -Force
Copy-Item "output/restaurant-categories-seed-preview.json" "../../Capstone/Capstone/seed-data/restaurant-categories-seed-preview.json" -Force
Copy-Item "output/restaurant-menu-items-seed-preview.json" "../../Capstone/Capstone/seed-data/restaurant-menu-items-seed-preview.json" -Force
Copy-Item "output/tags-seed-preview.json" "../../Capstone/Capstone/seed-data/tags-seed-preview.json" -Force
Copy-Item "output/restaurant-tags-seed-preview.json" "../../Capstone/Capstone/seed-data/restaurant-tags-seed-preview.json" -Force
```

자세한 import 설명은 [`../../Capstone/README.md`](../../Capstone/README.md)를 본다.

## 빠른 검증 명령

```bash
node src/index.js areas
node -e "const fs=require('fs'); const tags=JSON.parse(fs.readFileSync('./output/tags-seed-preview.json','utf8')); console.log([...new Set(tags.map(tag => tag.tag_type))]);"
node -e "const fs=require('fs'); const rows=JSON.parse(fs.readFileSync('./output/restaurant-tags-seed-preview.json','utf8')); console.log([...new Set(rows.map(row => row.source_type))]);"
node -e "const fs=require('fs'); const rows=JSON.parse(fs.readFileSync('./output/restaurant-menu-items-seed-preview.json','utf8')); const max=Math.max(...rows.map(row => row.price_value || 0)); console.log(max);"
```

기대값:

- `tags.tag_type` -> `["MENU"]`
- `restaurant_tags.source_type` -> `["MENU"]`
- `price_value` 최대값 -> 비정상 시간 파싱 값 없이 합리적 범위
