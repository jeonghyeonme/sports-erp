# 스포이즘 ERP

> 아파트 커뮤니티 시설 위탁운영 기업을 가정한 **다지점(멀티테넌트) 회원·인사 관리 ERP**입니다.
> 실제 제안요청서(RFP)를 기반으로 설계했으나, **실배포용이 아닌 포트폴리오/졸업작품 프로젝트**입니다.

[![Node](https://img.shields.io/badge/Node-20%2B-339933?logo=node.js&logoColor=white)](.nvmrc)
[![NestJS](https://img.shields.io/badge/API-NestJS-E0234E?logo=nestjs&logoColor=white)](apps/api)
[![React](https://img.shields.io/badge/Web-React%20%2B%20Vite-61DAFB?logo=react&logoColor=white)](apps/admin-web)
[![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL-4169E1?logo=postgresql&logoColor=white)](docker-compose.yml)
[![License](https://img.shields.io/badge/license-Portfolio--only-lightgrey)](#license)

---

## 소개

아파트·오피스텔 커뮤니티 시설(헬스장·수영장·골프연습장·독서실 등)을 여러 지점에서 위탁 운영하는 회사를 가정하고, 본사·지점·회원 3계층 구조로 인사/근태/회원/예약·결제/혼잡도를 통합 관리하는 ERP를 만듭니다.

- 지점(Branch) 단위로 데이터가 격리되는 **멀티테넌시** 구조
- 예약 정원 초과를 막는 **동시성 처리**(트랜잭션 락)
- 실 PG 대신 **모의 결제 모듈**로 재현한 결제 상태 전이(대기→승인→환불)
- 예약/QR체크인 기반 **혼잡도 자동 계산**

## 기술 스택

| 영역 | 스택 |
|---|---|
| 관리자 웹 | React + TypeScript + Vite |
| 회원 앱 | React Native (Expo) — Phase 3 착수 예정 |
| API | NestJS + TypeScript |
| DB / ORM | PostgreSQL + Prisma |
| 인증 | JWT(Access/Refresh) + RBAC |
| 인프라 | Docker Compose(로컬) |

## 폴더 구조

```
apps/
  api/          NestJS + Prisma + PostgreSQL — 백엔드 API
  admin-web/    React + Vite — 본사/지점 관리자 웹
  member-app/   React Native(Expo) — 회원용 모바일 앱 (Phase 3에서 착수)
packages/
  types/        클라이언트-서버가 공유하는 타입
docs/
  spec/         기능 설계서 00~08 (아키텍처부터 혼잡도관리까지)
  decisions/    기술 결정사항·트러블슈팅·요구사항추적표·차별화전략 (09, 10, 12, 13)
  발표자료/     발표 핸드오프 문서(11) — 발표 준비 시에만 갱신
  제안요청서 원본.pdf
```

## 문서

이 프로젝트의 모든 설계 결정은 `docs/`에 문서화되어 있습니다. 코드를 보기 전에 `00_공통설계서`부터 읽는 걸 권장합니다. `docs/spec/`은 기능 설계서, `docs/decisions/`는 의사결정·분석 기록으로 성격을 나눴습니다.

### spec — 기능 설계서

| # | 문서 | 내용 |
|---|---|---|
| 00 | [공통설계서](docs/spec/00_공통설계서.md) | 아키텍처, ERD 개요, 인증/RBAC, API 컨벤션, 개발 로드맵 |
| 01 | [권한관리](docs/spec/01_권한관리.md) | Role 4종, 지점 데이터 격리, 퇴사 처리 |
| 02 | [인사정보관리](docs/spec/02_인사정보관리.md) | 직원 CRUD, 파견(Assignment) 모델, 변경 신청/승인 |
| 03 | [근태관리](docs/spec/03_근태관리.md) | 출퇴근, 휴가, 업무일지 |
| 04 | [게시판(공지사항)](docs/spec/04_게시판_공지사항.md) | 본사→지점→회원 계층형 게시판 |
| 05 | [회원관리](docs/spec/05_회원관리.md) | 회원 CRUD, 수강내역, PT세션 |
| 06 | [예약및결제](docs/spec/06_예약및결제.md) | 예약, 동시성 처리, 모의 결제 |
| 07 | [강사프로그램게시](docs/spec/07_강사프로그램게시.md) | 강사·프로그램, pricingType |
| 08 | [혼잡도관리](docs/spec/08_혼잡도관리.md) | 시설별 혼잡도 자동계산 |

### decisions — 의사결정·분석 기록

| # | 문서 | 내용 |
|---|---|---|
| 09 | [기술결정사항](docs/decisions/09_기술결정사항.md) | 주요 기술 결정의 근거·타당성·장단점 분석(ADR 스타일) |
| 10 | [트러블슈팅](docs/decisions/10_트러블슈팅.md) | 구현 중 실제로 부딪힌 문제와 해결 과정 |
| 12 | [요구사항추적표](docs/decisions/12_요구사항추적표.md) | 원본 제안요청서 항목별 대응표 + 설계문서 vs 실제 코드(mock) 차이 분석 |
| 13 | [차별화전략](docs/decisions/13_차별화전략.md) | RFP 사업 맥락 재해석 기반 차별화 기능 제안(위탁계약 관리, 계약서 OCR·AI 분석 등) |

### 기타

| 문서 | 내용 |
|---|---|
| 11 | [발표자료 핸드오프](docs/발표자료/11_발표자료_핸드오프.md) — 진행상황 발표 준비용 핸드오프 요약. `docs/발표자료/` 디렉터리에 별도 보관, 발표자료 작성 시에만 갱신 |

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

## 로드맵

`docs/spec/00_공통설계서.md` §7의 Phase 구성을 따릅니다. 각 Phase는 세로로(기능 하나씩) 완성하며, 끝날 때마다 실제로 눌러볼 수 있는 데모가 나오는 것을 목표로 합니다.

- [x] **Phase 0 — 프로젝트 셋업**: 모노레포 구조, Git, 환경설정, Prisma 스타터 스키마
- [ ] **Phase 1 — 권한관리 + 회원관리**: 로그인/JWT/RBAC, BranchScopeGuard, 회원 CRUD ([01](docs/spec/01_권한관리.md), [05](docs/spec/05_회원관리.md))
- [ ] **Phase 2 — 인사정보관리 + 근태관리**: 직원 CRUD, 파견 모델, 출퇴근/휴가 ([02](docs/spec/02_인사정보관리.md), [03](docs/spec/03_근태관리.md))
- [ ] **Phase 3 — 강사·프로그램 + 예약/결제**: pricingType, 정원 동시성 처리, 모의 결제, 회원 앱 착수 ([07](docs/spec/07_강사프로그램게시.md), [06](docs/spec/06_예약및결제.md))
- [ ] **Phase 4 — 게시판 + 혼잡도관리**: 계층형 게시판, 혼잡도 자동계산 ([04](docs/spec/04_게시판_공지사항.md), [08](docs/spec/08_혼잡도관리.md))
- [ ] **Phase 5 — 통합·배포·발표 준비**: 통합 테스트, UI 폴리싱, 배포, 시연 시나리오

## License

포트폴리오/학습 목적으로 공개된 저장소이며, 실제 서비스 배포를 목적으로 하지 않습니다.
