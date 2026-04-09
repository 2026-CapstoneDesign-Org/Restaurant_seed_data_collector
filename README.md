# Naver Seed

`Naver_seed`는 네이버 `pcmap` 페이지를 기준으로 식당 seed preview JSON을 만드는 수집기다.
현재 역할은 두 가지다.

- 지역/키워드 기준으로 식당 후보를 수집한다.
- `Capstone`이 바로 import 할 수 있는 JSON 4종을 만든다.

현재 추천/랭킹 계산은 하지 않는다. 대신 검색, 유사도, 후속 추천 로직에서 가공하기 쉬운 러프한 데이터까지 같이 만든다.

## 현재 기준

- 수집 대상 설정 파일: [`src/seed_config.js`](./src/seed_config.js)
- 현재 `RAW_AREA_CONFIGS`는 `역북동`만 활성화
- 기준 실행일: `2026-04-09`
- 최근 실수집 결과
  - restaurants: `234`
  - tags: `138`
  - restaurant_tags: `2839`

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
  - 현재 활성화된 수집 지역 목록 확인
- `npm run seed`
  - 현재 활성 지역과 기본 키워드로 실수집
- `npm run seed:combine`
  - `output`에 있는 preview를 기준으로 generic preview 재생성
- `npm run seed:refresh`
  - `seed` 실행 후 `combine`까지 연속 수행

## 수집 흐름

1. [`src/seed_config.js`](./src/seed_config.js) 에서 지역과 기본 키워드를 관리한다.
2. [`src/seed.js`](./src/seed.js) 가 `pcmap` 검색 결과를 모은다.
3. 후보별 상세 페이지를 읽어서 주소, 카테고리, 편의정보, 결제정보, 메뉴를 정리한다.
4. preview JSON 4종과 raw summary JSON을 `output/` 아래에 저장한다.
5. [`src/combine_seed.js`](./src/combine_seed.js) 는 여러 area 결과를 합쳐 generic preview를 다시 만든다.

## output 파일

기본 결과물은 `output/` 아래에 저장된다.

- `pcmap-area-seed-result.json`
  - raw store summary
- `restaurants-seed-preview.json`
  - `Capstone`의 `restaurants` import 기준 파일
- `restaurant-categories-seed-preview.json`
  - `Capstone`의 `restaurant_categories` import 기준 파일
- `tags-seed-preview.json`
  - `Capstone`의 `tags` import 기준 파일
- `restaurant-tags-seed-preview.json`
  - `Capstone`의 `restaurant_tags` import 기준 파일
- `combined-seed-summary.json`
  - combine 결과 요약
- `combined-seed-duplicates.json`
  - combine 중복 확인용

## 지역 필드 규칙

`region_name`은 동 기준이 아니다.

- 시 주소면 `"{시} {구}"` 형식
  - 예: `용인시 처인구`
- 군 주소면 `"{군}"` 형식
  - 예: `가평군`

시/구를 각각 필터링할 수 있도록 아래 필드를 같이 넣는다.

- `region_name`
- `region_city_name`
- `region_district_name`
- `region_county_name`
- `region_filter_names`

예시:

```json
{
  "region_name": "용인시 처인구",
  "region_city_name": "용인시",
  "region_district_name": "처인구",
  "region_county_name": null,
  "region_filter_names": ["용인시", "처인구"]
}
```

## 태그 추출 규칙

태그는 추천 계산용 완성 데이터가 아니라, 후속 검색/유사도/추천 로직에서 다시 가공하기 쉬운 1차 러프 데이터다.

### 태그 원천

- 메뉴명
- 카테고리
- 편의정보
- 결제정보
- 지역

### 현재 태그 타입

- `MENU`
- `CATEGORY`
- `ATTRIBUTE`
- `REGION`

### 메뉴 태그화 방향

메뉴는 최대한 큰 틀의 dish tag로 정규화한다.

- `수제 안심 카츠동` -> `카츠동`
- `숙성 연어 초밥` -> `초밥`
- `얼큰 순대국` -> `순대국`

현재는 [`src/tag_extractor.js`](./src/tag_extractor.js) 에서 alias 기반으로 1차 매핑한다.
완벽한 정규화가 목적은 아니고, downstream에서 다시 가공하기 좋게 만드는 것이 목적이다.

### restaurant_tags 필드 의미

- `tag_key`
  - 시스템 식별 키
- `source_type`
  - `MENU`, `CATEGORY`, `ATTRIBUTE`, `REGION`
- `source_text`
  - 태그가 나온 원문
- `weight`
  - 후속 검색/유사도에서 재가중치할 수 있는 러프 점수
- `confidence`
  - 1차 매핑 신뢰도
- `matched_menu_count`
  - 동일 태그에 매칭된 메뉴 수
- `is_primary`
  - 해당 식당의 대표 메뉴 태그 1개

## 지역 추가 방법

현재는 [`src/seed_config.js`](./src/seed_config.js)의 `RAW_AREA_CONFIGS`만 수정하면 된다.

예시:

```js
const RAW_AREA_CONFIGS = [
  "역북동",
  "망포동",
  { name: "김량장동", aliases: ["중앙동"] },
];
```

가이드:

- 주소에 자주 다른 행정명이 섞이면 `aliases`를 같이 넣는다.
- 새 지역을 추가한 뒤 `npm run seed` 또는 `npm run seed:refresh`를 다시 실행한다.
- 여러 지역을 함께 돌리면 `combine-seed` 기준 preview가 다시 합쳐진다.

## Capstone 연동

`Capstone`은 collector가 아니다. 수집은 이 저장소에서 하고 import는 `Capstone`에서 한다.

현재 기본 연동 순서:

1. `Naver_seed`에서 `npm run seed`
2. 아래 4개 파일을 `Capstone/Capstone/seed-data/`로 복사
   - `restaurants-seed-preview.json`
   - `restaurant-categories-seed-preview.json`
   - `tags-seed-preview.json`
   - `restaurant-tags-seed-preview.json`
3. `Capstone`에서 import 실행

## 환경 변수

`.env.example`를 복사해서 `.env`를 만든 뒤 필요한 값을 채운다.

현재 수집에는 네이버 쿠키 등 pcmap 접근용 값이 필요하다.

## 팀 handoff 메모

- `Naver_seed`는 수집과 preview 생성만 담당한다.
- `Capstone`은 import와 DB 반영만 담당한다.
- 태그는 완성형 추천 결과가 아니라 후속 활용을 위한 1차 가공 데이터다.
- 검색/유사도 로직은 이 output을 그대로 읽기보다 `Capstone` DB의 `tags`, `restaurant_tags`를 기준으로 이어서 개발하면 된다.
