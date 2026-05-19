# Restaurant Seed Data Collector

네이버 pcmap 페이지 응답을 기반으로 Capstone 식당 seed preview JSON을 생성하는 수집기입니다.

이 저장소는 수집, 정제, preview JSON 생성까지만 담당합니다. DB 적재와 서비스 API 동작은 `2026-CapstoneDesign` 백엔드 저장소에서 담당합니다.

## 역할 분리

- `Restaurant_seed_data_collector`
  - pcmap 검색 및 상세 데이터 수집
  - 식당, 메뉴, 영업시간, 사진, 편의정보, 지역 필드 정규화
  - 메뉴 기반 tag 후보와 `restaurant_tags` preview 생성
  - Capstone import용 JSON 산출
- `2026-CapstoneDesign`
  - preview JSON import
  - DB schema와 서비스 API 운영
  - 외부 fallback 식당의 검증 후 등록

Capstone 백엔드 내부에는 seed 원본 JSON을 커밋하지 않습니다. 필요한 경우 이 수집기에서 생성한 `output/*.json`을 실행 환경의 임시 `import-data/` 경로로 전달해 import합니다.

## 요구사항

- Node.js 18 이상 권장
- npm
- 네이버 pcmap 접근이 가능한 네트워크
- 필요한 경우 `.env`에 pcmap 요청용 cookie 또는 실행 옵션 설정

`.env.example`을 참고해 로컬 `.env`를 만들 수 있습니다. `.env`는 커밋하지 않습니다.

## 설치

```bash
npm install
```

## 주요 명령

```bash
npm run help
npm run seed:areas
npm run seed
npm run seed:combine
npm run seed:refresh
npm run test:tags
```

명령 설명:

- `npm run seed:areas`
  - 현재 수집 대상 지역 설정을 출력합니다.
- `npm run seed`
  - 지역별 pcmap 수집을 수행하고 `output/*-restaurants-seed-preview.json`, raw summary를 생성합니다.
- `npm run seed:combine`
  - 기존 `output/` 지역별 결과를 Capstone import용 공통 preview JSON으로 병합합니다.
- `npm run seed:refresh`
  - `seed` 실행 후 `combine`까지 연속 수행합니다.
- `npm run test:tags`
  - 메뉴 태그 추출 규칙 테스트를 실행합니다.

## 수집 지역 설정

수집 지역은 `src/seed_config.js`의 `RAW_AREA_CONFIGS`에서 관리합니다.

예시:

```js
const RAW_AREA_CONFIGS = [
  "역북동",
  "김량장동",
  { name: "마포구", aliases: ["마포"] },
];
```

지역명을 바꾼 뒤에는 `npm run seed:refresh`로 수집과 병합을 다시 수행합니다.

## 산출물

기본 산출물은 `output/` 아래에 생성됩니다.

Capstone import 대상:

- `output/restaurants-seed-preview.json`
- `output/restaurant-menu-items-seed-preview.json`
- `output/tags-seed-preview.json`
- `output/restaurant-tags-seed-preview.json`

검증 및 운영 참고용:

- `output/pcmap-area-seed-result.json`
- `output/tag-validation-report.json`
- `output/tag-candidate-report.json`
- `output/manual-review-candidates.json`
- `output/combined-seed-summary.json`
- `output/combined-seed-duplicates.json`

`output/`의 대용량 산출물은 기본적으로 git에 커밋하지 않습니다. 필요한 release 또는 전달 과정에서 별도 artifact로 관리합니다.

## 정규화 정책

### 지역

지역은 단순 동 기준이 아니라 `시/군/구` 주소를 기준으로 정규화합니다.

- `region_name`
- `region_city_name`
- `region_district_name`
- `region_county_name`
- `region_filter_names`

검색 aliases는 주소 표현 차이가 큰 지역에서 보조 키워드로 사용합니다.

### 메뉴

메뉴는 이미지 저장 없이 텍스트 기반으로 정규화합니다.

- `name`
- `price_text`
- `price_value`
- `description`

비정상적으로 큰 가격은 `price_text`는 보존하고 `price_value=null`로 처리합니다.

### 태그

태그는 메뉴 기반 규칙만 사용합니다.

- `tags.tag_type = MENU`
- `restaurant_tags.source_type = MENU`
- `parent_tag_key`는 `menu:` prefix 계층만 사용합니다.

새 태그 후보는 자동 확정하지 않고 `output/tag-candidate-report.json`으로 검토합니다. 실제 태그 확정은 `src/tag_extractor.js`의 `MENU_TAG_RULES`를 수정해 반영합니다.

### 음식점 검증

수집기는 다음 단계를 거쳐 non-food 후보를 제외합니다.

1. pcmap category 기반 1차 제외
2. 상호명 금지 키워드 기반 2차 제외
3. 메뉴 raw type 기반 음식점 신호 확인
4. 수동 exact block 적용
5. manual review 후보 분리

## Capstone import 흐름

1. 이 저장소에서 `npm run seed:refresh`를 실행합니다.
2. `output/`의 import 대상 JSON 4개를 검증합니다.
3. Capstone 실행 환경의 임시 `import-data/` 경로에 전달합니다.
4. Capstone에서 seed import runner를 실행합니다.

예시:

```powershell
cd Capstone/Capstone
.\gradlew.bat bootRun --args="--seed.import.enabled=true --seed.import.exit-after-run=true --seed.import.restaurants-file-path=import-data/restaurants-seed-preview.json --seed.import.menu-items-file-path=import-data/restaurant-menu-items-seed-preview.json --seed.import.tags-file-path=import-data/tags-seed-preview.json --seed.import.restaurant-tags-file-path=import-data/restaurant-tags-seed-preview.json"
```

## 주의사항

- 네이버 pcmap HTML 또는 Apollo state 구조가 바뀌면 파싱이 실패할 수 있습니다.
- 수집 결과는 운영 DB에 바로 넣기 전에 row count, duplicate report, manual review 후보를 확인해야 합니다.
- Capstone 앱 저장소에 seed 원본 JSON을 커밋하지 않습니다.
