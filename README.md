# 스포이즘 ERP

> 아파트 커뮤니티 시설 위탁운영 기업을 가정한 **다지점(멀티테넌트) 회원·인사 관리 ERP**입니다.
> 실제 제안요청서(RFP)를 기반으로 설계했으나, **실배포용이 아닌 포트폴리오/졸업작품 프로젝트**입니다.

[![Node](https://img.shields.io/badge/Node-20%2B-339933?logo=node.js&logoColor=white)](.nvmrc)
[![NestJS](https://img.shields.io/badge/API-NestJS-E0234E?logo=nestjs&logoColor=white)](apps/api)
[![React](https://img.shields.io/badge/Web-React%20%2B%20Vite-61DAFB?logo=react&logoColor=white)](apps/admin-web)
[![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL-4169E1?logo=postgresql&logoColor=white)](docker-compose.yml)
[![License](https://img.shields.io/badge/license-Portfolio--only-lightgrey)](#license)

**📊 [2주차 진행상황 발표 자료 보기](https://claude.ai/code/artifact/cea04fa5-eabc-4b78-a55b-838a5da1a402)** — 화살표키/버튼으로 슬라이드를 넘기며 볼 수 있는 웹 발표자료입니다.

**📄 산출물(원본 RFP 대응)** — [기업 분석 자료](docs/5.deliverables/5-1_기업분석자료.html)(산출물2) · [개발 작업계획서](docs/5.deliverables/5-2_개발작업계획서.html)(산출물3) — 저장소 보관본, 보기 좋은 버전은 [문서 목차 §5.deliverables](#5deliverables--원본-rfp-산출물-제출본) 참고

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
  member-app/   React Native(Expo) — 회원용 모바일 앱 (Phase 3에서 착수)
packages/
  types/        클라이언트-서버가 공유하는 타입
docs/
  1.spec/         기능 설계서 1-1~1-10 (아키텍처부터 혼잡도관리, 자원관리까지)
  2.decisions/    기술 결정사항·트러블슈팅·요구사항추적표·차별화전략 (2-1~2-4)
  3.design/       admin-web 디자인 시스템(토큰·레이아웃 원칙) — 화면이 늘어날수록 계속 갱신
  4.presentation/ 발표 핸드오프 문서(4-1) — 발표 준비 시에만 갱신
  제안요청서 원본.pdf
```

## 문서

이 프로젝트의 모든 설계 결정은 `docs/`에 문서화되어 있습니다. 코드를 보기 전에 `1-1_공통설계서`부터 읽는 걸 권장합니다. 구조는 3단계입니다 — **1차** 최상위 폴더(`1.spec`/`2.decisions`/`3.design`/`4.presentation`), **2차** 그 안의 기능군별 하위 폴더, **3차** 개별 문서(`1-1`, `2-3` 등, 파일명은 하위 폴더가 바뀌어도 그대로).

### 1.spec — 기능 설계서

**00_공통**

| # | 문서 | 내용 |
|---|---|---|
| 1-1 | [공통설계서](docs/1.spec/00_공통/1-1_공통설계서.md) | 아키텍처, ERD 개요, 인증/RBAC, API 컨벤션, 개발 로드맵 |

**10_인사조직**

| # | 문서 | 내용 |
|---|---|---|
| 1-2 | [권한관리](docs/1.spec/10_인사조직/1-2_권한관리.md) | Role 4종, 지점 데이터 격리, 퇴사 처리 |
| 1-3 | [인사정보관리](docs/1.spec/10_인사조직/1-3_인사정보관리.md) | 직원 CRUD, 파견(Assignment) 모델, 변경 신청/승인 |
| 1-4 | [근태관리](docs/1.spec/10_인사조직/1-4_근태관리.md) | 출퇴근, 휴가, 업무일지 |

**20_이용자서비스**

| # | 문서 | 내용 |
|---|---|---|
| 1-6 | [회원관리](docs/1.spec/20_이용자서비스/1-6_회원관리.md) | 회원 CRUD, 수강내역, PT세션 |
| 1-7 | [예약및결제](docs/1.spec/20_이용자서비스/1-7_예약및결제.md) | 예약, 동시성 처리, 모의 결제 |
| 1-8 | [강사프로그램게시](docs/1.spec/20_이용자서비스/1-8_강사프로그램게시.md) | 강사·프로그램, pricingType |

**30_운영지원**

| # | 문서 | 내용 |
|---|---|---|
| 1-5 | [게시판(공지사항)](docs/1.spec/30_운영지원/1-5_게시판_공지사항.md) | 본사→지점→회원 계층형 게시판 |
| 1-9 | [혼잡도관리](docs/1.spec/30_운영지원/1-9_혼잡도관리.md) | 시설별 혼잡도 자동계산 |

**40_자원문서관리**

| # | 문서 | 내용 |
|---|---|---|
| 1-10 | [기업구조및자원관리분석](docs/1.spec/40_자원문서관리/1-10_기업구조및자원관리분석.md) | 원본 RFP "기업 분석 자료" 산출물 대응 — 조직구조 분석 + 자산·비품관리/문서관리 신규 설계 |

### 2.decisions — 의사결정·분석 기록

**50_결정및이슈기록**

| # | 문서 | 내용 |
|---|---|---|
| 2-1 | [기술결정사항](docs/2.decisions/50_결정및이슈기록/2-1_기술결정사항.md) | 주요 기술 결정의 근거·타당성·장단점 분석(ADR 스타일) |
| 2-2 | [트러블슈팅](docs/2.decisions/50_결정및이슈기록/2-2_트러블슈팅.md) | 구현 중 실제로 부딪힌 문제와 해결 과정 |

**60_분석및제안**

| # | 문서 | 내용 |
|---|---|---|
| 2-3 | [요구사항추적표](docs/2.decisions/60_분석및제안/2-3_요구사항추적표.md) | 원본 제안요청서 항목별 대응표 + 설계문서 vs 실제 코드(mock) 차이 분석 |
| 2-4 | [차별화전략](docs/2.decisions/60_분석및제안/2-4_차별화전략.md) | RFP 사업 맥락 재해석 기반 차별화 기능 제안(위탁계약 관리, 계약서 OCR·AI 분석 등) |

### 3.design — 디자인 시스템

| # | 문서 | 내용 |
|---|---|---|
| 3-1 | [디자인시스템](docs/3.design/3-1_디자인시스템.md) | admin-web 디자인 토큰·레이아웃 원칙(고밀도 엔터프라이즈 라이트). 새 화면 작업 전 필독 |

### 4.presentation — 발표 자료

| # | 문서 | 내용 |
|---|---|---|
| 4-1 | [발표자료 핸드오프](docs/4.presentation/4-1_발표자료_핸드오프.md) | 진행상황 발표 준비용 핸드오프 요약 — `docs/4.presentation/` 디렉터리에 별도 보관, 발표자료 작성 시에만 갱신 |
| 4-2 | [2주차 발표 슬라이드 구성](docs/4.presentation/4-2_2주차발표_슬라이드구성.md) | 2주차 발표 슬라이드 구성안 — [배포된 발표자료 보기](https://claude.ai/code/artifact/cea04fa5-eabc-4b78-a55b-838a5da1a402) |
| 4-3 | [3주차 발표 슬라이드 구성](docs/4.presentation/4-3_3주차발표_슬라이드구성.md) | 3주차 발표 슬라이드 구성안(초안) — 실무 분석서·도메인 확장·확장 판단·도메인별 시연·구조 시각화 중심 |

### 5.deliverables — 원본 RFP 산출물 제출본

다른 문서를 참조하지 않는 자기완결형 HTML입니다 — 내용의 근거는 아래 표의 "기반 문서"에 있지만, 산출물 자체는 그 문서들과 별개로 완결되어 있습니다.

| # | 산출물 | 내용 | 기반 문서 |
|---|---|---|---|
| 5-1 | [기업 분석 자료](docs/5.deliverables/5-1_기업분석자료.html) ([보기 좋은 버전](https://claude.ai/code/artifact/460e474f-2ded-4031-ae5b-07cf1efa3731)) | 산출물2(기업 경영/관리 현황 분석) — 사업구조 재해석, 지점·계약 현황, 인적/물적자원 관리 현황 | [1-10](docs/1.spec/40_자원문서관리/1-10_기업구조및자원관리분석.md) |
| 5-2 | [개발 작업계획서](docs/5.deliverables/5-2_개발작업계획서.html) ([보기 좋은 버전](https://claude.ai/code/artifact/05918b0b-f045-42c8-928e-bdf0f44133b7)) | 산출물3 — 개발 단계(Phase 0~6) 흐름과 각 단계별 범위·데모 산출물 | [1-1 §7](docs/1.spec/00_공통/1-1_공통설계서.md) |

원본 제안요청서(RFP) PDF는 `docs/제안요청서 원본.pdf`에 있습니다.

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

결정 근거는 [2-1문서 D23](docs/2.decisions/50_결정및이슈기록/2-1_기술결정사항.md)을 참고하세요. GitHub 저장소 연결 후 아래 값을 각 서비스 대시보드에 입력하면 push 시 자동 재배포됩니다.

**api → [Render](https://render.com)** — 저장소 루트의 [render.yaml](render.yaml)을 Blueprint로 인식시키면 아래 값이 자동 채워집니다(수동 설정 시 동일하게 입력).

| 항목 | 값 |
|---|---|
| Build Command | `npm install && npm run build --workspace=apps/api` |
| Start Command | `npm run start:prod --workspace=apps/api` |
| Health Check Path | `/api/v1/health` |
| 환경변수 | `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` (`apps/api/.env.example` 참고). `DATABASE_URL`은 Supabase 연동 전까지는 비워둡니다. |

**admin-web → [Cloudflare Pages](https://pages.cloudflare.com)**

| 항목 | 값 |
|---|---|
| Build Command | `npm install && npm run build --workspace=apps/admin-web` |
| Build Output Directory | `apps/admin-web/dist` |
| 환경변수 | `VITE_API_BASE_URL=<Render에서 발급된 api 주소>/api/v1` |

SPA 새로고침 404 방지용 [`apps/admin-web/public/_redirects`](apps/admin-web/public/_redirects)가 빌드 결과물에 포함되어 있어야 합니다(Vite가 `public/`을 그대로 복사하므로 별도 설정 불필요).

**DB(실 DB 전환 시) → [Supabase](https://supabase.com)** — 무료 프로젝트 생성 후 연결 문자열을 Render의 `DATABASE_URL`에 넣고 `AppModule`에서 `MockDataModule`을 `PrismaModule`로 교체합니다. 무료 프로젝트는 7일간 미사용 시 자동 일시정지되니, 시연 전엔 미리 한 번 깨워두세요.

## 로드맵

`docs/1.spec/00_공통/1-1_공통설계서.md` §7의 Phase 구성을 따릅니다. 각 Phase는 세로로(기능 하나씩) 완성하며, 끝날 때마다 실제로 눌러볼 수 있는 데모가 나오는 것을 목표로 합니다.

- [x] **Phase 0 — 프로젝트 셋업**: 모노레포 구조, Git, 환경설정, Prisma 스타터 스키마
- [ ] **Phase 1 — 권한관리 + 회원관리**: 로그인/JWT/RBAC, BranchScopeGuard, 회원 CRUD ([1-2](docs/1.spec/10_인사조직/1-2_권한관리.md), [1-6](docs/1.spec/20_이용자서비스/1-6_회원관리.md)) — 로그인·토큰갱신·Role전환과 회원 등록/수정/상태전환 API+화면 모두 완료. **수강내역·PT잔여세션·예약결제 탭만 백엔드 미구현이라 안내 문구만 노출(데모 기준 미완료)**
- [ ] **Phase 2 — 인사정보관리 + 근태관리**: 직원 CRUD, 파견 모델, 출퇴근/휴가 ([1-3](docs/1.spec/10_인사조직/1-3_인사정보관리.md), [1-4](docs/1.spec/10_인사조직/1-4_근태관리.md)) — 근태관리는 API+화면 모두 완료. 인사정보관리는 API는 완료(채용/파견/퇴사)했지만 **화면이 아직 없어 데모 기준 미완료**
- [ ] **Phase 3 — 강사·프로그램 + 예약/결제**: pricingType, 정원 동시성 처리, 모의 결제, 회원 앱 착수 ([1-8](docs/1.spec/20_이용자서비스/1-8_강사프로그램게시.md), [1-7](docs/1.spec/20_이용자서비스/1-7_예약및결제.md)) — 강사·프로그램게시(회차 등록 포함)와 예약/결제(모의결제·부가세분리 포함) 모두 Phase 1+2 핵심 API+화면 완료(2026-09-18). 강사 정산·노쇼 자동처리는 범위 제외(2026-09-20, 향후 확장 가능). **PT 패키지(회원 PT 잔여세션 포함)와 회원 앱(React Native)은 아직 미착수**
- [ ] **Phase 4 — 게시판 + 혼잡도관리**: 계층형 게시판, 혼잡도 자동계산 ([1-5](docs/1.spec/30_운영지원/1-5_게시판_공지사항.md), [1-9](docs/1.spec/30_운영지원/1-9_혼잡도관리.md)) — 게시판은 API+화면 모두 완료(2026-09-18, 첨부파일·상단고정·교육 실시 기록만 미구현). 혼잡도관리도 Phase 1(시설 등록/수정, 수동 보정) API+화면 완료(2026-09-18). QR 체크인·5분 주기 자동계산은 범위 제외(향후 확장 가능). **남은 건 게시판 교육자료 첨부(URL 방식)뿐**
- [ ] **Phase 5 — 통합·배포·발표 준비**: 통합 테스트, UI 폴리싱, 배포, 시연 시나리오
- [ ] **Phase 6(확장) — 자산·비품관리 + 문서관리 + 매출/정산**: 원본 산출물2(기업 분석 자료) 대응 ([1-10](docs/1.spec/40_자원문서관리/1-10_기업구조및자원관리분석.md)) + 부가세 분리·매출 집계·강사 정산 ([1-7](docs/1.spec/20_이용자서비스/1-7_예약및결제.md)) — 자산·비품(CRUD·자동판정·상태전이)과 문서함(CRUD·보존기한 자동계산·임박 목록) Phase 1 API+화면 완료(2026-09-19), 부가세 분리도 완료. 감가상각·강사 정산은 범위 제외(향후 확장 가능), 재물조사는 보류(선택)

## License

포트폴리오/학습 목적으로 공개된 저장소이며, 실제 서비스 배포를 목적으로 하지 않습니다.
