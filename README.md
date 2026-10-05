# 스포이즘 ERP

> 아파트 커뮤니티 시설 위탁운영 기업을 가정한 **다지점(멀티테넌트) 회원·인사 관리 ERP**입니다.
> 실제 제안요청서(RFP)를 기반으로 설계했으나, **실배포용이 아닌 포트폴리오/졸업작품 프로젝트**입니다.

[![Node](https://img.shields.io/badge/Node-20%2B-339933?logo=node.js&logoColor=white)](.nvmrc)
[![NestJS](https://img.shields.io/badge/API-NestJS-E0234E?logo=nestjs&logoColor=white)](apps/api)
[![React](https://img.shields.io/badge/Web-React%20%2B%20Vite-61DAFB?logo=react&logoColor=white)](apps/admin-web)
[![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL-4169E1?logo=postgresql&logoColor=white)](docker-compose.yml)
[![License](https://img.shields.io/badge/license-Portfolio--only-lightgrey)](#license)

**📊 [2주차 진행상황 발표 자료 보기](https://claude.ai/code/artifact/cea04fa5-eabc-4b78-a55b-838a5da1a402)** — 화살표키/버튼으로 슬라이드를 넘기며 볼 수 있는 웹 발표자료입니다.

**📄 산출물(원본 RFP 대응)** — [기업 분석 자료](docs/deliverables/5-1_기업분석자료.html)(산출물2) · [개발 작업계획서](docs/deliverables/5-2_개발작업계획서.html)(산출물3) — 저장소 보관본, 보기 좋은 버전은 [문서 목차 §5.deliverables](#5deliverables--원본-rfp-산출물-제출본) 참고

---

## 소개

아파트·오피스텔 커뮤니티 시설(헬스장·수영장·골프연습장·독서실 등)을 여러 지점에서 위탁 운영하는 회사를 가정하고, 본사·지점·회원 3계층 구조로 인사/근태/회원/예약·결제/혼잡도를 통합 관리하는 ERP를 만듭니다.

- 지점(Branch) 단위로 데이터가 격리되는 **멀티테넌시** 구조
- 예약 정원 초과를 막는 **동시성 처리**(트랜잭션 락)
- 실 PG 대신 **모의 결제 모듈**로 재현한 결제 상태 전이(대기→승인→환불)
- 시설별 **혼잡도 5단계 게시**(관리자 수동 보정 — 자동 계산은 향후 확장)

## 기술 스택

| 영역 | 스택 |
|---|---|
| 관리자 웹 | React + TypeScript + Vite |
| 회원 앱 | React Native (Expo) — Phase 3 착수 예정 |
| API | NestJS + TypeScript |
| DB / ORM | PostgreSQL + Prisma |
| 인증 | JWT(Access/Refresh) + RBAC |
| 로컬 인프라 | Docker Compose(PostgreSQL) |
| 배포 | Cloudflare Pages(admin-web) · Render(api) · Supabase(예정, 실 DB 전환 시) |

## 폴더 구조

```
apps/
  api/          NestJS + Prisma + PostgreSQL — 백엔드 API
  admin-web/    React + Vite — 본사/지점 관리자 웹
  member-app/   React Native(Expo) — 개발 범위 제외(2026-09-30, D37). README만 있음
packages/
  types/        클라이언트-서버가 공유하는 타입
docs/
  STATUS.md       지금 상태와 다음 할 일 (세션 시작점)
  domains/        도메인 9개 — 도메인당 문서 1개(요구사항 → Driver → ADR → 검증 → 부록 레퍼런스)
  architecture/   도메인에 안 걸리는 횡단 규칙(공유 엔티티·정합성·KST 날짜·설계 상수 등)
  decisions/      횡단 결정 기록 D1~ (결정 하나에 파일 하나)
  process/        작업 방법론(RFP 분류·우선순위·도메인 사이클 템플릿)
  log/            진행 기록 (한 건에 파일 하나) · 트러블슈팅
  reference/      원본 RFP·요구사항추적표·차별화전략·기업 분석
  design/         admin-web 디자인 시스템
  presentation/   주간 발표 자료(지침·구성안·덱 소스)
  deliverables/   원본 RFP 산출물 제출본(자기완결형 HTML)
```

## 문서

전체 지도는 [docs/README.md](docs/README.md)에 있습니다. 처음 보는 분은 아래 순서를 권장합니다.

1. **[CLAUDE.md](CLAUDE.md)의 "사업 구조"** — 지점은 매장이 아니라 위탁계약 현장, 직원은 본사 소속 파견 인력이라는 재해석이 모든 설계의 전제입니다.
2. **[docs/STATUS.md](docs/STATUS.md)** — 지금 어디까지 왔는지.
3. **[docs/domains/](docs/domains/)** — 관심 있는 도메인 문서의 맨 위 "요약 카드". 왜 그렇게 만들었는지는 같은 문서 본문(Driver·ADR), 데이터 모델·API는 부록 A.
4. **[docs/decisions/](docs/decisions/README.md)** — 도메인에 안 걸리는 결정(실DB 전환, 배포 인프라 등)의 인덱스.

| 폴더 | 내용 |
|---|---|
| [domains/](docs/domains/) | [권한관리](docs/domains/권한관리.md) · [인사정보관리](docs/domains/인사정보관리.md) · [근태관리](docs/domains/근태관리.md) · [회원관리](docs/domains/회원관리.md) · [예약및결제](docs/domains/예약및결제.md) · [강사프로그램게시](docs/domains/강사프로그램게시.md) · [게시판](docs/domains/게시판.md) · [혼잡도관리](docs/domains/혼잡도관리.md) · [자원문서관리](docs/domains/자원문서관리.md) |
| [architecture/](docs/architecture/) | [공유 엔티티](docs/architecture/entities.md) · [시스템 개요](docs/architecture/system-overview.md) · [데이터 정합성](docs/architecture/data-integrity.md) · [날짜·시간](docs/architecture/date-time-handling.md) · [설계 상수](docs/architecture/design-constants.md) · [트래픽·인프라 검토](docs/architecture/traffic-infra-review.md) |
| [decisions/](docs/decisions/README.md) | 횡단 결정 D1~ — 요약표·종합 평가 |
| [process/](docs/process/) | [RFP 분류](docs/process/01_RFP_분류와_되묻기.md) · [도메인 우선순위](docs/process/02_도메인별_우선순위.md) · [도메인 사이클 템플릿](docs/process/03_도메인_사이클_템플릿.md) |
| [log/](docs/log/README.md) | 진행 기록(왜 이렇게 일하게 됐나) · [트러블슈팅](docs/log/troubleshooting.md) |
| [reference/](docs/reference/) | [요구사항추적표](docs/reference/요구사항추적표.md)(RFP ↔ 설계 ↔ 코드) · [차별화전략](docs/reference/차별화전략.md) · [기업 구조 분석](docs/reference/기업구조및관리시스템분석.md) · [시스템 비유 설명](docs/reference/시스템_비유_설명.md) · 원본 RFP PDF |
| [design/](docs/design/디자인시스템.md) | admin-web 디자인 토큰·레이아웃 원칙(고밀도 엔터프라이즈 라이트). 새 화면 작업 전 필독 |

### 발표 자료 (presentation/)

| # | 문서 | 내용 |
|---|---|---|
| 4-0 | [발표자료 공통 지침](docs/presentation/4-0_발표자료_공통지침.md) | 주간 진행상황 발표를 만드는 순서·내용 원칙·슬라이드 디자인 규칙·캡처 규칙 — 발표자료 작성 시 먼저 읽을 것 |
| 4-1 | [발표자료 핸드오프](docs/presentation/4-1_발표자료_핸드오프.md) | 진행상황 발표 준비용 핸드오프 요약 — 발표자료 작성 시에만 갱신 |
| 4-2 | [2주차 발표 슬라이드 구성](docs/presentation/4-2_2주차발표_슬라이드구성.md) | [배포된 발표자료 보기](https://claude.ai/code/artifact/cea04fa5-eabc-4b78-a55b-838a5da1a402) |
| 4-3 | [3주차 발표 슬라이드 구성](docs/presentation/4-3_3주차발표_슬라이드구성.md) | 덱 제작 완료본(29장) — 산출물 3종과 도메인 9개별 구조·구현 화면. 덱 소스는 `docs/presentation/assets/4-3_3주차발표/deck-source/` |
| 4-4 | [4주차 발표 슬라이드 구성](docs/presentation/4-4_4주차발표_슬라이드구성.md) | 트래픽·인프라 관점 재검토 후보 이슈 + D23→D24→D26 결정 타임라인 — [배포된 발표자료 보기](https://claude.ai/artifact/HGeWH6auvL1k9TjjCo31Hk) |
| 4-5 | [종합 발표 슬라이드 구성](docs/presentation/4-5_종합발표_슬라이드구성.md) | Proposal·요구사항·데이터·설계·기술스택(AI) + 4주차 이후 진행 내역(39장) — [배포된 발표자료 보기](https://claude.ai/artifact/M6jdRHTH54pfGy884PiyxG) |

### 원본 RFP 산출물 제출본 (deliverables/)

다른 문서를 참조하지 않는 자기완결형 HTML입니다 — 근거는 "기반 문서"에 있지만 산출물 자체는 별개로 완결되어 있습니다.

| # | 산출물 | 내용 | 기반 문서 |
|---|---|---|---|
| 5-1 | [기업 분석 자료](docs/deliverables/5-1_기업분석자료.html) ([보기 좋은 버전](https://claude.ai/code/artifact/460e474f-2ded-4031-ae5b-07cf1efa3731)) | 산출물2 — 사업구조 재해석, 지점·계약 현황, 인적/물적자원 관리 현황 | [기업 구조 분석](docs/reference/기업구조및관리시스템분석.md) |
| 5-2 | [개발 작업계획서](docs/deliverables/5-2_개발작업계획서.html) ([보기 좋은 버전](https://claude.ai/code/artifact/05918b0b-f045-42c8-928e-bdf0f44133b7)) | 산출물3 — 개발 단계(Phase 0~6) 흐름과 단계별 범위·데모 산출물 | [시스템 개요 §7](docs/architecture/system-overview.md) |

## 시작하기

```bash
# 1. Node 20 이상 확인 (.nvmrc 참고)
node -v

# 2. 루트에서 워크스페이스 전체 설치 (admin-web, api, types 한번에)
npm install

# 3. 환경변수 파일 준비
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/admin-web/.env.example apps/admin-web/.env
# 각 .env의 비밀번호/시크릿 값은 로컬용으로 직접 채워주세요.

# 4. PostgreSQL 실행 (Docker)
npm run db:up

# 5. Prisma 클라이언트 생성 + 최초 마이그레이션
npm run prisma:generate
npm run prisma:migrate

# 6. 개발 서버 실행 (터미널 2개)
npm run dev:api     # http://localhost:3000/api/v1/health
npm run dev:web     # http://localhost:5173
```

## 배포

현재 구성과 진행 상태는 [docs/STATUS.md](docs/STATUS.md)를 보세요. 결정 경위는 [D23](docs/decisions/D23.md)(Render+Supabase) → [D24](docs/decisions/D24.md)·[D25](docs/decisions/D25.md)(Cloudflare Worker 엣지 + admin-web 정적 자산) → [D37](docs/decisions/D37.md)(api를 AWS Lambda로 이전, 진행 중)입니다.

| 구성 요소 | 위치 | 설정 문서 |
|---|---|---|
| api | AWS Lambda(서울, Function URL, 별칭 `live`) — `main-5x9td9` push 시 [deploy-api-lambda.yml](.github/workflows/deploy-api-lambda.yml)이 배포. 이전 완료 전까지 Render([render.yaml](render.yaml))가 병행 | [aws-lambda/README.md](aws-lambda/README.md) |
| admin-web + 앞단 프록시 | Cloudflare Worker(정적 자산 + API 프록시 + rate limit, SPA 404는 `not_found_handling`으로 처리) | [cloudflare-worker/README.md](cloudflare-worker/README.md) |
| DB | Supabase Postgres(서울) — 무료 프로젝트는 7일 미사용 시 일시정지되니 시연 전 한 번 깨워 둘 것 | `.env.example`, [진행 기록 044~050](docs/log/README.md)(시드 적용 절차) |

## 로드맵

`docs/architecture/entities.md` §7의 Phase 구성을 따릅니다. 각 Phase는 세로로(기능 하나씩) 완성하며, 끝날 때마다 실제로 눌러볼 수 있는 데모가 나오는 것을 목표로 합니다.

- [x] **Phase 0 — 프로젝트 셋업**: 모노레포 구조, Git, 환경설정, Prisma 스타터 스키마
- [ ] **Phase 1 — 권한관리 + 회원관리**: 로그인/JWT/RBAC, BranchScopeGuard, 회원 CRUD ([1-2](docs/domains/권한관리.md), [1-6](docs/domains/회원관리.md)) — 로그인·토큰갱신·Role전환과 회원 등록/수정/상태전환 API+화면 모두 완료. **수강내역·PT잔여세션·예약결제 탭만 백엔드 미구현이라 안내 문구만 노출(데모 기준 미완료)**
- [ ] **Phase 2 — 인사정보관리 + 근태관리**: 직원 CRUD, 파견 모델, 출퇴근/휴가 ([1-3](docs/domains/인사정보관리.md), [1-4](docs/domains/근태관리.md)) — 근태관리는 API+화면 모두 완료. 인사정보관리는 API는 완료(채용/파견/퇴사)했지만 **화면이 아직 없어 데모 기준 미완료**
- [ ] **Phase 3 — 강사·프로그램 + 예약/결제**: pricingType, 정원 동시성 처리, 모의 결제, 회원 앱 착수 ([1-8](docs/domains/강사프로그램게시.md), [1-7](docs/domains/예약및결제.md)) — 강사·프로그램게시(회차 등록 포함)와 예약/결제(모의결제·부가세분리 포함) 모두 Phase 1+2 핵심 API+화면 완료(2026-09-18). 강사 정산·노쇼 자동처리는 범위 제외(2026-09-20, 향후 확장 가능). **PT 패키지(회원 PT 잔여세션 포함)와 회원 앱(React Native)은 아직 미착수**
- [ ] **Phase 4 — 게시판 + 혼잡도관리**: 계층형 게시판, 혼잡도 자동계산 ([1-5](docs/domains/게시판.md), [1-9](docs/domains/혼잡도관리.md)) — 게시판은 API+화면 모두 완료(2026-09-18, 첨부파일·상단고정·교육 실시 기록만 미구현). 혼잡도관리도 Phase 1(시설 등록/수정, 수동 보정) API+화면 완료(2026-09-18). QR 체크인·5분 주기 자동계산은 범위 제외(향후 확장 가능). **남은 건 게시판 교육자료 첨부(URL 방식)뿐**
- [ ] **Phase 5 — 통합·배포·발표 준비**: 통합 테스트, UI 폴리싱, 배포, 시연 시나리오
- [ ] **Phase 6(확장) — 자산·비품관리 + 문서관리 + 매출/정산**: 원본 산출물2(기업 분석 자료) 대응 ([1-10](docs/reference/기업구조및관리시스템분석.md)) + 부가세 분리·매출 집계·강사 정산 ([1-7](docs/domains/예약및결제.md)) — 자산·비품(CRUD·자동판정·상태전이)과 문서함(CRUD·보존기한 자동계산·임박 목록) Phase 1 API+화면 완료(2026-09-19), 부가세 분리도 완료. 감가상각·강사 정산은 범위 제외(향후 확장 가능), 재물조사는 보류(선택)

## License

포트폴리오/학습 목적으로 공개된 저장소이며, 실제 서비스 배포를 목적으로 하지 않습니다.
