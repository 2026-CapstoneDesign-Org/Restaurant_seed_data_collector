# Naver Seed src Guide

`Naver_seed/src` 내부 파일의 역할과 수정 포인트를 정리한 문서다.
팀원이 수집기 코드를 이어받을 때 어디를 봐야 하는지 빠르게 파악하는 용도다.

기준일: `2026-04-10`

## 전체 흐름

```text
index.js
  -> seed.js
    -> seed_config.js
    -> pcmap.js
    -> menu_normalizer.js
    -> region_utils.js
    -> tag_extractor.js
    -> utils.js

index.js
  -> combine_seed.js
    -> seed_config.js
    -> menu_normalizer.js
    -> region_utils.js
    -> tag_extractor.js
    -> utils.js
```

정리:

- `index.js`
  - CLI 진입점
- `seed.js`
  - 실제 수집 실행
- `combine_seed.js`
  - 수집 결과를 generic preview로 재가공
- `pcmap.js`
  - 네이버 `pcmap` 호출과 상세 파싱
- `menu_normalizer.js`
  - 메뉴명, 가격, 설명 1차 정규화
- `region_utils.js`
  - 시/구/군 region schema 생성
- `tag_extractor.js`
  - 메뉴 기반 태그 추출과 검증
- `utils.js`
  - 공통 유틸

## 파일별 설명

### `src/index.js`

역할:

- CLI entrypoint
- `.env` 로드
- 명령 분기 처리

현재 지원 명령:

- `node src/index.js`
  - 실제 수집 실행
- `node src/index.js areas`
  - 활성 지역 목록 출력
- `node src/index.js combine-seed`
  - 기존 `output/` 기준 generic preview 재생성
- `node src/index.js refresh-seed`
  - 수집 후 combine까지 연속 실행

이 파일을 수정해야 하는 경우:

- CLI 명령을 추가할 때
- 실행 로그 형식을 바꿀 때

주의:

- 실제 비즈니스 로직은 여기에 넣지 않는다.
- 이 파일은 orchestration만 담당한다.

### `src/seed_config.js`

역할:

- 수집 지역 설정
- 기본 검색 키워드 관리
- 지역 alias 처리

주요 책임:

- `RAW_AREA_CONFIGS`
  - 수집 대상 지역 목록
- `DEFAULT_SEARCH_KEYWORDS`
  - 기본 검색 키워드 목록
- `findMatchedArea()`
  - 주소 문자열에서 설정 지역과 매칭
- `resolveRequestedAreaNames()`
  - 환경변수 override 처리

이 파일을 수정해야 하는 경우:

- 수집 지역을 추가/제거할 때
- 지역 alias를 추가할 때
- 기본 검색 키워드를 조정할 때

현재 기준:

- 활성 지역: `삼가동`, `남동`, `김량장동`, `서리`

### `src/seed.js`

역할:

- 실제 수집 파이프라인 본체

주요 처리 순서:

1. `seed_config.js`에서 지역/키워드 로드
2. 검색 query 생성
3. `pcmap.searchPlaces()`로 후보 수집
4. 지역 필터링과 후보 dedup
5. `pcmap.fetchPlaceDetail()`로 상세 수집
6. 메뉴/region/category/tag 정규화
7. preview JSON 저장

출력 파일:

- `pcmap-area-seed-result.json`
- `restaurants-seed-preview.json`
- `restaurant-categories-seed-preview.json`
- `restaurant-menu-items-seed-preview.json`
- `tags-seed-preview.json`
- `restaurant-tags-seed-preview.json`
- `tag-validation-report.json`
- `tag-candidate-report.json`

이 파일을 수정해야 하는 경우:

- 수집 후보 필터링 로직을 바꿀 때
- preview 스키마를 바꿀 때
- output 파일을 추가할 때

현재 핵심 규칙:

- region은 `시 + 구` 또는 `군 단독`으로 정규화
- 메뉴 이미지는 버리고 `name/price_text/price_value/description`만 유지
- 태그는 메뉴 기반만 생성

### `src/combine_seed.js`

역할:

- `output/`에 있는 수집 결과를 다시 읽어 generic preview를 재생성

주요 책임:

- area별 preview 탐색
- 중복 식당 dedup
- region 재정규화
- 메뉴 payload 재정규화
- 메뉴 태그 재생성
- `combined-seed-summary.json`, `combined-seed-duplicates.json` 생성

이 파일을 수정해야 하는 경우:

- 여러 지역 결과를 합치는 규칙을 바꿀 때
- dedup 우선순위를 조정할 때
- generic preview 산출 형식을 바꿀 때

주의:

- 이 파일은 다시 수집하지 않는다.
- 기존 `output/`을 재가공하는 단계다.

### `src/pcmap.js`

역할:

- 네이버 비공식 `pcmap` 호출
- 응답 파싱

주요 exported 함수:

- `searchPlaces(query)`
  - 검색 결과 후보 수집
- `fetchPlaceDetail(placeId)`
  - 식당 상세 수집
- HTML fallback 메뉴 파싱 함수들

이 파일을 수정해야 하는 경우:

- 네이버 응답 구조가 바뀌었을 때
- 상세 페이지에서 추가 필드가 필요할 때
- 요청 헤더, 쿠키, 파라미터를 조정해야 할 때

주의:

- 네트워크와 파싱 리스크가 큰 파일이다.
- 다른 파일에서 `pcmap` raw 응답 구조를 직접 가정하지 말고 여기 반환 형식을 기준으로 본다.

### `src/menu_normalizer.js`

역할:

- 메뉴명, 가격, 설명 1차 정규화

주요 함수:

- `normalizeMenuName()`
  - 괄호/보조 문구 정리
- `toNullableNumber()`
  - 가격 문자열 숫자 변환
- `buildNormalizedMenuBase()`
  - 메뉴 row 공통 스키마 생성
- `buildMenuPayload()`
  - `restaurants.menu_json`용 간소화 payload 생성

현재 추가 규칙:

- 비정상적으로 큰 가격은 `price_value`를 `null`로 둔다.
- `price_text`는 원본 표시 문자열을 유지한다.

이 파일을 수정해야 하는 경우:

- 메뉴명 정제 규칙을 보강할 때
- 가격 파싱 규칙을 조정할 때
- `menu_json` 스키마를 바꿀 때

### `src/tag_extractor.js`

역할:

- 메뉴 기반 태그 추출
- 태그 검증
- `tags`, `restaurant_tags` preview 생성
- 신규 태그 후보 리포트 생성

주요 함수:

- `extractMenuTagMatches(menuName)`
  - 메뉴명에 매칭되는 태그 규칙 조회
- `resolvePrimaryMenuTag(menuName)`
  - 대표 메뉴 태그 결정
- `buildRestaurantTagPreview(...)`
  - `tags-seed-preview.json`, `restaurant-tags-seed-preview.json` 생성
- `buildTagCandidateReport(...)`
  - `tag-candidate-report.json` 생성

현재 정책:

- `MENU` tag만 생성
- category/attribute/region 태그는 생성하지 않음
- `tags`는 자동 확장하지 않고 후보 리포트만 만든다

이 파일을 수정해야 하는 경우:

- 새 메뉴 태그 alias를 추가할 때
- 태그 검증 규칙을 보강할 때
- 신규 태그 후보 정책을 조정할 때

### `src/region_utils.js`

역할:

- 주소 문자열에서 region schema 생성

주요 함수:

- `buildRegionSchema(fallbackRegionName, ...values)`

현재 규칙:

- 시와 구가 모두 있으면 `region_name = "{시} {구}"`
- 군이 있으면 `region_name = "{군}"`
- 군이 있으면 `region_city_name`, `region_district_name`는 비운다

이 파일을 수정해야 하는 경우:

- region 규칙이 바뀔 때
- 행정구역 추출 우선순위를 조정할 때

### `src/utils.js`

역할:

- 공통 유틸 모음

주요 함수:

- `loadDotEnv()`
  - `.env` 로드
- `saveJson()`, `saveText()`
  - `output/` 저장
- `sanitizeText()`
  - HTML 제거, entity decode, 공백 정리
- `normalizeBusinessName()`
- `formatWon()`
- `buildSafeFileName()`

이 파일을 수정해야 하는 경우:

- 여러 파일이 공통으로 쓰는 문자열/파일 처리 로직을 수정할 때

## 권장 읽기 순서

1. [`README.md`](./README.md)
2. [`src/seed_config.js`](./src/seed_config.js)
3. [`src/index.js`](./src/index.js)
4. [`src/seed.js`](./src/seed.js)
5. [`src/pcmap.js`](./src/pcmap.js)
6. [`src/menu_normalizer.js`](./src/menu_normalizer.js)
7. [`src/tag_extractor.js`](./src/tag_extractor.js)
8. [`src/combine_seed.js`](./src/combine_seed.js)
9. [`src/region_utils.js`](./src/region_utils.js)
10. [`src/utils.js`](./src/utils.js)

## 수정 가이드

- 지역 추가가 목적이면 [`src/seed_config.js`](./src/seed_config.js)만 먼저 본다.
- `pcmap` 응답이 깨졌으면 [`src/pcmap.js`](./src/pcmap.js)를 본다.
- 메뉴 정규화가 이상하면 [`src/menu_normalizer.js`](./src/menu_normalizer.js)와 [`src/seed.js`](./src/seed.js)를 본다.
- 태그 결과가 이상하면 [`src/tag_extractor.js`](./src/tag_extractor.js)를 본다.
- combine 결과가 이상하면 [`src/combine_seed.js`](./src/combine_seed.js)를 본다.
