# Naver Seed

`Naver_seed`는 네이버 `pcmap`을 기준으로 식당 seed preview JSON을 만드는 수집기다.
현재 역할은 수집과 1차 정규화까지만이다.

- 지역/키워드 기준으로 식당 후보를 수집한다.
- `Capstone`이 import 할 수 있는 preview JSON을 만든다.
- 메뉴에서 큰 틀의 dish tag를 뽑는다.
- 메뉴/태그/지역 데이터를 후속 검색, 유사도, 추천 로직이 가공하기 쉬운 형태로 맞춘다.

## 현재 기준

- 수집 대상 설정 파일: [`src/seed_config.js`](./src/seed_config.js)
- 현재 활성 지역: `역북동`
- 기준 실행일: `2026-04-09`
- 최근 실수집 결과
  - restaurants: `234`
  - categories: `234`
  - menu items: `5027`
  - tags: `136`
  - restaurant_tags: `2832`

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
  - 현재 활성화된 수집 지역 확인
- `npm run seed`
  - 현재 활성 지역과 기본 키워드로 실수집
- `npm run seed:combine`
  - `output` 기준으로 generic preview 재생성
- `npm run seed:refresh`
  - `seed` 후 `combine`까지 연속 수행

## 수집 흐름

1. [`src/seed_config.js`](./src/seed_config.js) 에서 지역과 기본 키워드를 관리한다.
2. [`src/seed.js`](./src/seed.js) 가 `pcmap` 검색 결과를 모은다.
3. 후보별 상세 페이지에서 주소, 카테고리, 편의정보, 결제정보, 메뉴를 읽는다.
4. 메뉴 이미지는 버리고, 메뉴명/가격/설명 중심의 preview를 만든다.
5. 메뉴 기반 dish tag, category tag, attribute tag, region tag를 만든다.
6. validation flow로 잘못된 tag를 걸러낸다.
7. preview JSON을 `output/`에 저장한다.

## output 파일

기본 결과물은 `output/` 아래에 저장된다.

- `pcmap-area-seed-result.json`
  - raw 수집 summary
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
  - tag 검증 결과
- `combined-seed-summary.json`
  - combine 결과 요약
- `combined-seed-duplicates.json`
  - combine 중복 확인용

## 지역 규칙

지역은 동 기준이 아니라 시/구/군 기준으로 정리한다.

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
  - 시/구 주소면 `[시, 구]`
  - 군 주소면 `[군]`

중요 규칙:

- 시/구는 같이 존재할 수 있다.
- 군이 존재하면 시/구는 같이 저장하지 않는다.

## 태그 규칙

### 태그 타입

- `MENU`
- `CATEGORY`
- `ATTRIBUTE`
- `REGION`

### 메뉴 태그화 방향

메뉴는 최대한 큰 틀의 dish tag로 정규화한다.

- `수제 안심 카츠동` -> `카츠동`
- `숙성 연어 초밥` -> `초밥`
- `얼큰 순대국` -> `순대국`

현재 기준 파일: [`src/tag_extractor.js`](./src/tag_extractor.js)

### parent_tag_key 규칙

`parent_tag_key`는 `menu:` 또는 `category:` prefix만 허용한다.
현재 실제로는 메뉴 태그 계층에서만 사용한다.

예:

- `menu:카츠동` -> parent `menu:덮밥`
- `menu:순대국` -> parent `menu:국밥`

### 태그 검증 플로우

현재는 아래 규칙으로 잘못된 태그를 막는다.

- 필수값 없는 tag 제거
- `parent_tag_key` prefix 검증
- `parent_tag_key`는 `MENU`, `CATEGORY` 타입만 허용
- `CATEGORY` 길이 2 미만 tag 제거
- `MENU` 길이 2 미만 tag 제거

이 검증으로 예전 `와플 -> 플` 같은 깨진 category tag가 다시 생기지 않도록 막는다.

검증 결과는 `tag-validation-report.json`에 남는다.

## 메뉴 정규화 규칙

`restaurants.menu_json`는 더 이상 이미지 중심 raw payload가 아니다.
현재는 가볍게 아래만 남긴다.

- `name`
- `price_text`
- `price_value`
- `description`

추가로 정규화 메뉴는 별도 preview로 뽑는다.

`restaurant-menu-items-seed-preview.json` 주요 필드:

- `restaurant_seed_index`
- `display_order`
- `source_menu_id`
- `menu_name`
- `normalized_menu_name`
- `menu_tag_key`
- `price_text`
- `price_value`
- `description`

예:

```json
{
  "restaurant_seed_index": 1,
  "display_order": 0,
  "source_menu_id": "1383309803_0",
  "menu_name": "얼큰순대국",
  "normalized_menu_name": "순대국",
  "menu_tag_key": "menu:순대국",
  "price_text": "12,000원",
  "price_value": 12000,
  "description": "대표 메뉴"
}
```

## 지역 추가 방법

현재는 [`src/seed_config.js`](./src/seed_config.js)의 `RAW_AREA_CONFIGS`만 수정하면 된다.

예:

```js
const RAW_AREA_CONFIGS = [
  "역북동",
  "망포동",
  { name: "김량장동", aliases: ["중앙동"] },
];
```

가이드:

- 주소에 다른 행정명이 자주 섞이면 `aliases`를 같이 넣는다.
- 새 지역을 추가한 뒤 `npm run seed` 또는 `npm run seed:refresh`를 다시 실행한다.

## Capstone 연동

수집은 이 저장소에서 하고, DB import는 `Capstone`에서 한다.

현재 기본 순서:

1. `Naver_seed`에서 `npm run seed`
2. 아래 파일들을 `Capstone/Capstone/seed-data/`로 복사
   - `restaurants-seed-preview.json`
   - `restaurant-categories-seed-preview.json`
   - `restaurant-menu-items-seed-preview.json`
   - `tags-seed-preview.json`
   - `restaurant-tags-seed-preview.json`
   - `tag-validation-report.json`
3. `Capstone`에서 import 실행

## output과 Capstone DB 매핑

### `restaurants-seed-preview.json`

- 대상 테이블: `restaurants`

핵심 필드:

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

- 대상 테이블: `restaurant_categories`

핵심 필드:

- `restaurant_seed_index`
- `category_name`

### `restaurant-menu-items-seed-preview.json`

- 대상 테이블: `restaurant_menu_items`

핵심 필드:

- `restaurant_seed_index`
- `display_order`
- `menu_name`
- `normalized_menu_name`
- `menu_tag_key`
- `price_text`
- `price_value`
- `description`

### `tags-seed-preview.json`

- 대상 테이블: `tags`

핵심 필드:

- `tag_key`
- `tag_name`
- `tag_type`
- `parent_tag_key`
- `is_active`

### `restaurant-tags-seed-preview.json`

- 대상 테이블: `restaurant_tags`

핵심 필드:

- `restaurant_seed_index`
- `tag_key`
- `source_type`
- `source_text`
- `weight`
- `confidence`
- `matched_menu_count`
- `is_primary`

## 환경 변수

`.env.example`를 복사해서 `.env`를 만든 뒤 필요한 값을 채운다.

현재 수집에는 네이버 쿠키 등 `pcmap` 접근용 값이 필요하다.

## 팀 handoff 메모

- `Naver_seed`는 수집과 preview 생성만 담당한다.
- `Capstone`은 import와 DB 반영만 담당한다.
- 태그는 완성형 추천 결과가 아니라 후속 활용을 위한 1차 가공 데이터다.
- 메뉴 이미지는 현재 preview와 DB 기준에서 사용하지 않는다.
