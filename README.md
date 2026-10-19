# 스포이즘 ERP

> 아파트 커뮤니티 시설 위탁운영 기업을 가정한 **다지점(멀티테넌트) 회원·인사 관리 ERP**입니다.
> 실제 제안요청서(RFP)를 기반으로 설계했으나, **실배포용이 아닌 포트폴리오/졸업작품 프로젝트**입니다.

[![Node](https://img.shields.io/badge/Node-20%2B-339933?logo=node.js&logoColor=white)](.nvmrc)
[![NestJS](https://img.shields.io/badge/API-NestJS-E0234E?logo=nestjs&logoColor=white)](apps/api)
[![React](https://img.shields.io/badge/Web-React%20%2B%20Vite-61DAFB?logo=react&logoColor=white)](apps/admin-web)
[![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL-4169E1?logo=postgresql&logoColor=white)](docker-compose.yml)
[![License](https://img.shields.io/badge/license-Portfolio--only-lightgrey)](#license)

**📊 [2주차 진행상황 발표 자료 보기](https://claude.ai/code/artifact/cea04fa5-eabc-4b78-a55b-838a5da1a402)** — 화살표키/버튼으로 슬라이드를 넘기며 볼 수 있는 웹 발표자료입니다.

**📄 산출물(원본 RFP 대응)** — [기업 분석 및 프로젝트 제안서](docs/deliverables/기업분석및제안서.docx) · [요구사항 정의서](docs/deliverables/요구사항정의서.xlsx) · [데이터 정의서](docs/deliverables/데이터정의서.xlsx) · [아키텍처 설계서](docs/deliverables/아키텍처설계서.docx) — 목록은 [원본 RFP 산출물 제출본](#원본-rfp-산출물-제출본-deliverables) 참고

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
| 회원 웹 | 모바일 웹(`/m/`, PWA — D40·D41·D45) — 관리자 웹과 같은 React + Vite, 같은 Cloudflare Worker |
| API | NestJS + TypeScript |
| DB / ORM | PostgreSQL(Supabase, 서울) + Prisma |
| 인증 | JWT(Access/Refresh) + RBAC |
| 로컬 인프라 | Docker Compose(PostgreSQL) |
| 배포 | Cloudflare Worker(admin-web 정적 자산 + /api 프록시) · AWS Lambda 서울(api) · Supabase(DB) |

## 폴더 구조

```
apps/
  api/          NestJS + Prisma + PostgreSQL — 백엔드 API
  admin-web/    React + Vite — 본사/지점 관리자 웹
  member-web/   React + Vite — 회원 모바일 웹(/m/, D41)
  member-app/   네이티브 앱은 만들지 않음 — 회원 기능은 member-web(D40). README만 있음
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
  deliverables/   원본 RFP 산출물 제출본(Word·Excel — scripts/deliverables/로 재생성)
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
| [architecture/](docs/architecture/) | [공유 엔티티](docs/architecture/entities.md) · [시스템 개요](docs/architecture/system-overview.md) · [데이터 정합성](docs/architecture/data-integrity.md) · [날짜·시간](docs/architecture/date-time-handling.md) · [설계 상수](docs/architecture/design-constants.md) · [트래픽·인프라 검토](docs/architecture/traffic-infra-review.md) · [공학적 위험 점검표](docs/architecture/engineering-risks.md) · [데이터 보존](docs/architecture/data-retention.md) |
| [decisions/](docs/decisions/README.md) | 횡단 결정 D1~ — 요약표·종합 평가 |
| [process/](docs/process/) | [RFP 분류](docs/process/01_RFP_분류와_되묻기.md) · [도메인 우선순위](docs/process/02_도메인별_우선순위.md) · [도메인 사이클 템플릿](docs/process/03_도메인_사이클_템플릿.md) · [작업 브리프](docs/process/04_작업_브리프.md) |
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
| 4-6 | [6주차 발표 슬라이드 구성](docs/presentation/4-6_6주차발표_슬라이드구성.md) | 9/28~10/11 진행(회원 앱·RFP 요구·핵심 규칙·성능) + 계약 상태별 5곳 고밀도화 계획(23장) — [배포된 발표자료 보기](https://claude.ai/artifact/Tk7TD8yx1bWthxvGsVHxpQ) |
| 4-7 | [중간발표 슬라이드 구성](docs/presentation/4-7_중간발표_슬라이드구성.md) | 파트 A 6주차 이후 개발 완료분 6장 + 파트 B 본론 15장(개요·설계·RFP 추적 현황·검증과 운영) + 마무리, 22장·약 20분·교수·평가자. 구성안만, 덱 미제작 |

### 원본 RFP 산출물 제출본 (deliverables/)

다른 문서를 참조하지 않는 자기완결형 Word·Excel 문서입니다. 근거는 "기반 문서"에 있고, 산출물은 `scripts/deliverables/`의 스크립트가 저장소에서 생성합니다(손으로 고치지 않음). 옛 HTML 산출물 두 개(기업 분석 자료·개발 작업계획서)는 2026-10-05 아래 Word 문서로 대체했습니다(git 이력 `9c154ec`).

| # | 산출물 | 내용 | 기반 문서 |
|---|---|---|---|
| — | [기업 분석 및 프로젝트 제안서](docs/deliverables/기업분석및제안서.docx) (Word) | 제안 개요 · 기업 분석(사업 구조·위탁계약·인력·예약결제·자산·문서) · 제안 내용(범위·대상 지점·회원 모바일 웹·차별화) · 추진 현황 · 미구현 | [기업 구조 분석](docs/reference/기업구조및관리시스템분석.md), [차별화전략](docs/reference/차별화전략.md) — `scripts/deliverables/proposal.js`로 생성 |
| — | [아키텍처 설계서](docs/deliverables/아키텍처설계서.docx) (Word) | 시스템 구성 · 소프트웨어 구조 · 인증·인가 · 데이터 · 핵심 흐름 · 배포·운영 · 성능·용량 · 결정 이력 · 남은 과제 | [시스템 개요](docs/architecture/system-overview.md), [D37](docs/decisions/D37.md) — `scripts/deliverables/architecture.js`로 생성 |
| — | [요구사항 정의서](docs/deliverables/요구사항정의서.xlsx) (Excel) | 요구사항 총괄 · RFP 추적 · 도메인 9개 탭(사용자 스토리·원문 요구·불변규칙·기능 명세·설계 결정) · 미구현 · 범위 제외 | `scripts/deliverables/requirements.py`가 도메인 문서·[요구사항추적표](docs/reference/요구사항추적표.md)·실제 API 라우트에서 생성 |
| — | [데이터 정의서](docs/deliverables/데이터정의서.xlsx) (Excel) | 테이블 목록 · 컬럼 정의 · 관계 · 코드 정의 · 인덱스 · DB 규칙(CHECK·트리거) | `scripts/deliverables/data_definition.py`가 `schema.prisma`·마이그레이션 SQL에서 생성 |

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

현재 구성과 진행 상태는 [docs/STATUS.md](docs/STATUS.md)를 보세요. 결정 경위는 [D23](docs/decisions/D23.md)(Render+Supabase) → [D24](docs/decisions/D24.md)·[D25](docs/decisions/D25.md)(Cloudflare Worker 엣지 + admin-web 정적 자산) → [D37](docs/decisions/D37.md)(api를 AWS Lambda로 이전, 운영 중) → [D49](docs/decisions/D49.md)(DB 접속을 Session pooler로)입니다.

| 구성 요소 | 위치 | 설정 문서 |
|---|---|---|
| api | AWS Lambda(서울, Function URL, 별칭 `live`) — `dev` push 시 [deploy-api-lambda.yml](.github/workflows/deploy-api-lambda.yml)이 배포. Render는 2026-10-06 일시정지했고 롤백은 Lambda 별칭으로 한다 | [aws-lambda/README.md](aws-lambda/README.md) |
| admin-web·member-web + 앞단 프록시 | Cloudflare Worker(정적 자산 + API 프록시 + rate limit, SPA 404는 `not_found_handling`으로 처리). 배포는 수동(`npm run build:web` → `wrangler deploy`) | [cloudflare-worker/README.md](cloudflare-worker/README.md) |
| DB | Supabase Postgres(서울) — 무료 프로젝트는 7일 미사용 시 일시정지되니 시연 전 한 번 깨워 둘 것 | `.env.example`, [진행 기록 044~050](docs/log/README.md)(시드 적용 절차) |

## 로드맵

처음 계획(Phase 0~6, [system-overview](docs/architecture/system-overview.md) §7)은 모두 지나왔다. 지금 무엇이 남았는지는 [docs/STATUS.md](docs/STATUS.md)의 "다음 할 일"이 기준이고, RFP 대비 구현 현황은 [요구사항추적표](docs/reference/요구사항추적표.md) §2가 기준이다.

- [x] 9개 도메인 API + 관리자 웹 화면, 실DB(Prisma·Supabase) 전환(D26~D36)
- [x] 회원 모바일 웹(로그인·예약·모의 결제·공지·혼잡도·내 정보·가입/연동, D41)
- [x] 배포: Cloudflare Worker + AWS Lambda + Supabase, 운영 k6 실측(D42·D50)
- [ ] RFP 미구현 항목(인사 변경 신청 승인·교육자료 첨부·업무지원 요청 등 — 요구사항추적표 §2-3)
- [ ] 시연 데이터 고밀도화(STATUS)

## License

포트폴리오/학습 목적으로 공개된 저장소이며, 실제 서비스 배포를 목적으로 하지 않습니다.
