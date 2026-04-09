# Naver Seed src Guide

`Naver_seed/src` 내부 파일 구조와 역할을 정리한 문서다.  
팀원이 수집기 코드를 이어받을 때 어디를 수정해야 하는지 빠르게 찾는 용도로 쓴다.

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

정리하면:

- `index.js`는 CLI 진입점
- `seed.js`는 실제 수집 실행
- `combine_seed.js`는 수집된 결과를 다시 합쳐 generic preview 생성
- `pcmap.js`는 네이버 `pcmap` 호출
- `menu_normalizer.js`, `region_utils.js`, `tag_extractor.js`는 정규화 로직
- `utils.js`는 공통 유틸

## 파일별 설명

### [src/index.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/index.js)

역할:

- 수집기 CLI entrypoint
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

- 새 CLI 명령을 추가할 때
- 실행 결과 로그 포맷을 바꿀 때

주의:

- 실제 도메인 로직은 여기서 구현하지 않는다.
- 이 파일은 orchestration만 담당한다.

### [src/seed_config.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/seed_config.js)

역할:

- 수집 지역 설정의 단일 진실 소스
- 기본 검색 키워드 관리
- 지역 alias 처리

주요 책임:

- `RAW_AREA_CONFIGS`
  - 수집할 행정동 목록
- `DEFAULT_SEARCH_KEYWORDS`
  - 기본 검색 키워드 목록
- `findMatchedArea()`
  - 주소 문자열에서 설정된 지역과 매칭
- `resolveRequestedAreaNames()`
  - 환경변수 override 처리

이 파일을 수정해야 하는 경우:

- 수집 지역을 추가/삭제할 때
- 지역 alias를 추가할 때
- 기본 검색 키워드를 조정할 때

현재 기준:

- 활성 지역은 `역북동` 하나다.

### [src/seed.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/seed.js)

역할:

- 실제 수집 파이프라인 본체

주요 처리 순서:

1. `seed_config.js`에서 지역/키워드 로드
2. 검색 query 생성
3. `pcmap.searchPlaces()`로 후보 수집
4. 지역 필터링과 후보 dedup
5. `pcmap.fetchPlaceDetail()`로 상세 수집
6. 메뉴/지역/카테고리 정규화
7. preview JSON 저장

출력 파일:

- `pcmap-area-seed-result.json`
- `restaurants-seed-preview.json`
- `restaurant-categories-seed-preview.json`
- `restaurant-menu-items-seed-preview.json`
- `tags-seed-preview.json`
- `restaurant-tags-seed-preview.json`
- `tag-validation-report.json`

이 파일을 수정해야 하는 경우:

- 수집 후보 필터링 로직을 바꿀 때
- preview row 스키마를 바꿀 때
- 새로운 output 파일을 추가할 때

현재 기준 주요 규칙:

- region은 `시+구` 또는 `군 단독` 구조로 정규화
- menu 이미지는 버리고 `name/price_text/price_value/description`만 유지
- tag는 `menu`에서만 추출

### [src/combine_seed.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/combine_seed.js)

역할:

- `output/`에 이미 있는 area별 결과를 다시 읽어서 generic preview를 재생성

주요 책임:

- area별 preview pair 탐색
- 중복 식당 dedup
- 메뉴 payload 재구성
- region 재정규화
- menu tag 재생성
- `combined-seed-summary.json`, `combined-seed-duplicates.json` 생성

이 파일을 수정해야 하는 경우:

- 여러 지역 결과를 합치는 규칙을 바꿀 때
- dedup 우선순위를 조정할 때
- generic preview 산출 형식을 바꿀 때

주의:

- 이 파일은 실시간 수집을 하지 않는다.
- `output/` 기준 재조합만 담당한다.

### [src/pcmap.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/pcmap.js)

역할:

- 네이버 비공식 `pcmap` 호출 전담 파일

주요 exported 함수:

- `searchPlaces(query)`
  - 검색 결과 후보 수집
- `fetchPlaceDetail(placeId)`
  - 식당 상세 수집
- `extractMenuItemsFromHtml(...)`
  - 메뉴 fallback 파싱

이 파일을 수정해야 하는 경우:

- 네이버 응답 스펙이 바뀌었을 때
- 상세 페이지에서 파싱해야 할 필드가 바뀔 때
- request header/cookie/params를 조정해야 할 때

주의:

- 네트워크와 파싱 리스크가 가장 큰 파일이다.
- 다른 파일에서 `pcmap` 응답 구조를 직접 가정하지 말고, 이 파일의 반환 형태를 기준으로 맞추는 게 안전하다.

### [src/menu_normalizer.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/menu_normalizer.js)

역할:

- 메뉴명/가격/설명을 1차 정규화

주요 함수:

- `normalizeMenuName()`
  - 괄호, 대괄호 등 부가 텍스트 정리
- `toNullableNumber()`
  - 가격 문자열을 숫자로 변환
- `buildNormalizedMenuBase()`
  - 메뉴 row 공통 스키마 생성
- `buildMenuPayload()`
  - `restaurants.menu_json`용 간소화 payload 생성

이 파일을 수정해야 하는 경우:

- 메뉴명 정제 규칙을 강화할 때
- 가격 파싱 규칙을 바꿀 때
- `menu_json` 스키마를 바꿀 때

주의:

- 검색/추천용 후처리를 생각하면 원본을 과하게 훼손하지 않는 선에서 정제해야 한다.

### [src/tag_extractor.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/tag_extractor.js)

역할:

- 메뉴 기반 태그 추출
- 태그 validation
- `tags`, `restaurant_tags` preview 생성

주요 함수:

- `extractMenuTagMatches(menuName)`
  - 메뉴명에서 매칭되는 태그 규칙 찾기
- `resolvePrimaryMenuTag(menuName)`
  - 대표 메뉴 태그 결정
- `buildRestaurantTagPreview(tagSources)`
  - `tags-seed-preview.json`, `restaurant-tags-seed-preview.json` 생성
- `buildTagSourceFromStore()`
- `buildTagSourceFromRestaurantRow()`

현재 정책:

- `MENU` tag만 생성
- category/attribute/region 기반 tag는 생성하지 않음
- `parent_tag_key`는 메뉴 계층에만 사용

이 파일을 수정해야 하는 경우:

- 새 메뉴 태그 alias를 추가할 때
- 태그 validation 규칙을 보강할 때
- `primary` 계산 로직을 조정할 때

주의:

- 이번 기준으로 tag master는 전부 여기서 결정된다.
- 잘못 건드리면 `tags`와 `restaurant_tags`가 동시에 바뀐다.

### [src/region_utils.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/region_utils.js)

역할:

- 주소 문자열에서 region schema 생성

주요 함수:

- `buildRegionSchema(fallbackRegionName, ...values)`

현재 규칙:

- 시와 구가 모두 있으면 `region_name = "{시} {구}"`
- 군이 있으면 `region_name = "{군}"`
- 군이 있으면 `region_city_name`, `region_district_name`는 비움

이 파일을 수정해야 하는 경우:

- region 규칙이 바뀔 때
- 행정구역 추출 우선순위를 조정할 때

주의:

- 현재 프로젝트에서 region 일치 규칙은 중요하므로 이 파일 수정은 영향 범위를 먼저 확인해야 한다.

### [src/utils.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/utils.js)

역할:

- 공통 유틸 모음

주요 함수:

- `loadDotEnv()`
  - `.env` 로드
- `saveJson()`, `saveText()`
  - `output/` 저장
- `sanitizeText()`
  - HTML 제거, entity decode, whitespace 정리
- `normalizeBusinessName()`
- `formatWon()`
- `buildSafeFileName()`

이 파일을 수정해야 하는 경우:

- 문자열 sanitize 공통 규칙을 바꿀 때
- output 저장 형식을 바꿀 때
- env 로드 규칙을 바꿀 때

주의:

- 거의 모든 파일이 `sanitizeText()`에 의존한다.
- 여기서 문자열 정규화 규칙을 바꾸면 region/menu/tag 전부 같이 영향을 받는다.

## 어떤 파일을 수정해야 하는가

### 수집 지역만 바꾸고 싶을 때

- [seed_config.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/seed_config.js)

### 네이버 응답 파싱이 깨졌을 때

- [pcmap.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/pcmap.js)

### 메뉴 정제 규칙을 강화하고 싶을 때

- [menu_normalizer.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/menu_normalizer.js)
- [tag_extractor.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/tag_extractor.js)

### region 규칙이 바뀌었을 때

- [region_utils.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/region_utils.js)
- 필요하면 [seed.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/seed.js)
- 필요하면 [combine_seed.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/combine_seed.js)

### output preview 스키마를 바꾸고 싶을 때

- [seed.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/seed.js)
- [combine_seed.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/combine_seed.js)

## 팀 인수인계 기준 권장 순서

처음 보는 팀원이 읽을 순서는 아래가 가장 빠르다.

1. [README.md](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/README.md)
2. [seed_config.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/seed_config.js)
3. [index.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/index.js)
4. [seed.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/seed.js)
5. [pcmap.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/pcmap.js)
6. [menu_normalizer.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/menu_normalizer.js)
7. [tag_extractor.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/tag_extractor.js)
8. [combine_seed.js](/C:/Users/gkswh/OneDrive/바탕%20화면/26-1/캡스톤%20디자인/Capstone_Root/Naver_pcmap_api/Naver_seed/src/combine_seed.js)

이 순서면 실행 흐름, 수집, 정규화, 후처리 순으로 이해할 수 있다.
