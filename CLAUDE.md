# CLAUDE.md

스포이즘 ERP — npm workspaces 모노레포. 포트폴리오/졸업작품 프로젝트, 원본 제안요청서(RFP) 기반.

## 사업 구조 (코드/문서 작업 전에 먼저 이해할 것)

```
[본사]  ──(위탁운영 계약)──  [위탁센터=지점]  ──(파견)──  [직원]  ──(서비스 제공)──  [이용자]
  ↑                                                                                  │
  └────────── 운영 데이터(회원수·매출·프로그램 실적)가 다시 올라와 계약 판단 근거가 됨 ──────┘
```

두 개의 서로 다른 관계가 이 시스템을 이룬다:

1. **본사 ↔ 위탁센터 = 계약 관계.** 스포이즘은 헬스장 체인 본사가 아니라 아파트·오피스텔 단지의 커뮤니티 시설(헬스장·수영장 등)을 위탁운영해주는 회사다. `Branch`(지점)는 스포이즘이 소유한 매장이 아니라 **"OO아파트와 맺은 위탁운영 계약 현장"**이고, 계약상대방·계약기간·계약상태(정상/갱신임박/만료/종료) 데이터를 갖는다(`docs/spec/00_공통설계서.md` §2-1). "시스템 불안정 → 민원 → 계약 해지"가 원본 RFP가 명시한 리스크 구조라, 이 시스템에서 안정성은 품질이 아니라 **본사 매출(계약 개수)이 걸린 문제**다. 이 시스템 자체가 신규 위탁계약 수주 입찰(PT) 발표용 영업 도구이기도 함(`docs/decisions/13_차별화전략.md`).
2. **위탁센터 ↔ 직원 ↔ 이용자 = 운영 관계.** 직원(Staff)은 지점이 채용하는 게 아니라 **본사가 채용해서 각 현장에 파견**한다(`StaffAssignment`, §2-2) — 채용·재배치는 본사(SUPER_ADMIN)만 결정하고, 지점 관리자(BRANCH_ADMIN)는 "현재 파견되어 있는 인력"의 일상 관리만 한다. 이용자(Member)는 자신이 등록된 지점의 프로그램만 예약·이용하고, 지점 관리자는 **자기 지점 데이터만** 볼 수 있다(타 지점 조회 불가가 원본 요구사항 핵심).

1번(계약)이 2번(운영)의 전제조건이고(계약 종료 지점은 신규 활동 차단), 2번에서 쌓인 운영 데이터가 다시 1번의 계약 갱신·영업 근거로 순환한다.

## 구조

```
apps/api/         NestJS + TypeScript (Prisma 스키마는 있지만 현재 코드는 MockDataService로 동작 — 아래 "현재 상태" 참고)
apps/admin-web/    React + Vite — 본사/지점 관리자 웹
apps/member-app/   React Native(Expo) — Phase 3 착수 예정, 아직 미착수
packages/types/     클라이언트-서버 공유 타입
docs/spec/00~08     기능 설계서 — 코드 작업 전 관련 설계서를 먼저 읽을 것
docs/decisions/      09(ADR: 왜 이 기술을 선택했는지) · 10(트러블슈팅) · 12(원본 RFP↔설계↔코드 추적표) · 13(차별화 전략)
docs/발표자료/       11(발표 핸드오프) — 발표자료 준비 요청이 아닌 한 절대 건드리지 말 것
```

## 명령어

```bash
npm install                    # 루트에서 전체 워크스페이스 설치
npm run dev:api                # apps/api 개발 서버 (localhost:3000/api/v1)
npm run dev:web                # apps/admin-web 개발 서버 (localhost:5173)
npm run db:up / db:down        # PostgreSQL (Docker)
npm run prisma:generate / prisma:migrate

# apps/api 안에서
npm run lint    # eslint --fix
npm run test    # jest
npm run build   # nest build

# apps/admin-web 안에서
npm run lint
npm run build   # tsc -b && vite build
```

## 현재 구현 상태 (착각하기 쉬운 부분)

- **API는 Prisma가 아니라 `MockDataService`(인메모리)로 동작 중이다.** `apps/api/prisma/schema.prisma`는 설계돼 있지만 실제 컨트롤러는 대부분 mock 데이터를 반환한다. "Prisma 스키마에 있으니 동작한다"고 가정하지 말 것 — 실제 동작 여부는 `docs/decisions/12_요구사항추적표.md` §2를 확인.
- 대부분의 API가 **조회(GET) 전용**이다. Write API(등록/수정/삭제)는 `permissions/staff/:staffId/role` 정도를 제외하면 거의 없다.
- 03(근태관리)·06(예약및결제) 도메인은 **설계 문서만 있고 코드가 전혀 없다.**
- `wip/real-db-auth-phase1` 브랜치는 삭제됐지만, 그 브랜치의 커밋(`eb79377`, 실DB 기반 인증/회원 모듈)은 `main`의 병합 조상 커밋이라 여전히 히스토리에서 도달 가능하다 — 실DB 전환 시 `git show eb79377:apps/api/src/modules/<path>`로 꺼내올 것.
- `Branch`는 단순 매장이 아니라 **위탁계약 현장**이고(`docs/spec/00_공통설계서.md` §2-1), `Staff`는 지점 소속이 아니라 **본사 소속으로 현장에 파견**되는 구조다(§2-2, `StaffAssignment`). 이 재해석을 모르고 "지점이 직원을 고용한다"는 가정으로 코드를 작성하지 말 것.

## 문서 작업 규칙

- `docs/spec/`(00~08)은 기능 설계, `docs/decisions/`(09,10,12,13)는 의사결정·분석 기록 — 성격에 맞는 폴더에 쓸 것.
- `Branch`, `StaffAssignment` 같은 공유 엔티티의 스키마는 `docs/spec/00_공통설계서.md`가 단일 진실 공급원이다. 다른 문서에서 필드를 새로 정의하지 말고 00문서를 참조할 것.
- 문서 간 상대링크를 쓸 때 실제 파일 위치 기준으로 경로를 맞출 것(`spec/`↔`decisions/`는 서로 `../` 필요).
- `docs/발표자료/11_발표자료_핸드오프.md`는 발표자료 작업을 명시적으로 요청받았을 때만 수정한다.

## 작업 환경 유의사항

- 이 저장소는 GitHub Desktop과 동시에 열려있을 수 있다 — 브랜치 전환 등으로 **커밋 안 된 변경사항이 자동으로 stash될 수 있다.** 큰 작업 전후로 `git status`/`git stash list`를 확인하고, 사용자가 커밋을 원하면 미루지 말고 바로 진행할 것.
