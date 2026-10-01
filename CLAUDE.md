# CLAUDE.md

스포이즘 ERP — npm workspaces 모노레포. 포트폴리오/졸업작품 프로젝트, 원본 제안요청서(RFP) 기반.

> 공통 작업 원칙(승인 프로토콜·검증·안전·Git 규칙)은 사용자 전역 `~/.claude/CLAUDE.md`에 있다. 이 파일은 그것을 **보완**할 뿐 완화하지 않는다.
> 이 파일은 매 턴 컨텍스트에 들어간다 — **변하지 않는 규칙과 "어디를 읽나"만** 둔다. 이력·현황은 [docs/STATUS.md](docs/STATUS.md)·`docs/log/`·`docs/decisions/`에 둔다(D38, 130줄 상한을 `scripts/doc-check.mjs`가 강제).

## 사업 구조 (코드/문서 작업 전에 먼저 이해할 것)

```
[본사]  ──(위탁운영 계약)──  [위탁센터=지점]  ──(파견)──  [직원]  ──(서비스 제공)──  [이용자]
  ↑                                                                                  │
  └────────── 운영 데이터(회원수·매출·프로그램 실적)가 다시 올라와 계약 판단 근거가 됨 ──────┘
```

1. **본사 ↔ 위탁센터 = 계약 관계.** 스포이즘은 헬스장 체인이 아니라 아파트·오피스텔 커뮤니티 시설 위탁운영사다. `Branch`는 소유 매장이 아니라 **"OO아파트와 맺은 위탁운영 계약 현장"**이고 계약상대방·기간·상태(정상/갱신임박/만료/종료)를 갖는다([entities.md](docs/architecture/entities.md) §2-1). "시스템 불안정 → 민원 → 계약 해지"가 RFP가 명시한 리스크라, 안정성은 품질이 아니라 **본사 매출(계약 개수)** 문제다. 이 시스템은 신규 수주 입찰(PT) 영업 도구이기도 하다([차별화전략](docs/reference/차별화전략.md)).
2. **위탁센터 ↔ 직원 ↔ 이용자 = 운영 관계.** 직원은 지점이 아니라 **본사가 채용해 현장에 파견**한다(`StaffAssignment`, §2-2). 채용·재배치는 SUPER_ADMIN만, BRANCH_ADMIN은 파견된 인력의 일상 관리만 한다. 이용자는 등록 지점의 프로그램만 이용하고, 지점 관리자는 **자기 지점 데이터만** 본다(RFP 핵심 요구).

1번(계약)이 2번(운영)의 전제조건이고(계약 종료 지점은 신규 활동 차단), 2번의 운영 데이터가 1번의 갱신·영업 근거로 순환한다.

## 구조

```
apps/api/          NestJS + Prisma(Supabase Postgres) — 전 도메인 실DB(D36). 작업 규칙은 apps/api/CLAUDE.md
apps/admin-web/    React + Vite — 본사/지점 관리자 웹. 작업 규칙은 apps/admin-web/CLAUDE.md
apps/member-app/   개발 범위 제외(2026-09-30, D37) — README만 있음
packages/types/    클라이언트-서버 공유 타입
scripts/           doc-check.mjs(문서 검사기)
docs/              지도는 docs/README.md — STATUS · domains · architecture · decisions · process · log · reference · design · presentation · deliverables
```

## 무엇을 할 때 어디를 읽나

| 상황 | 읽을 것 (이 순서로, 필요한 만큼만) |
|---|---|
| 세션 시작·이어하기 | [docs/STATUS.md](docs/STATUS.md) |
| 도메인 기능 구현·수정 | `docs/domains/<도메인>.md` 맨 위 **요약 카드** → 필요하면 해당 ADR 절 → 부록 A-n |
| 코드 주석의 근거 따라가기 | `예약및결제 A-6` = 그 도메인 문서 부록 A-6 · `ADR-RSV-01` = 도메인 문서 ADR 절 · `D37` = `docs/decisions/D37.md` · `docs/log/051` = 진행 기록 |
| 공유 엔티티·스키마 | [entities.md](docs/architecture/entities.md)(단일 진실 공급원) → `apps/api/prisma/schema.prisma` |
| 횡단 규칙(정합성·날짜·상수) | `docs/architecture/` 해당 파일 |
| 도메인에 안 걸리는 결정의 경위 | [docs/decisions/README.md](docs/decisions/README.md) 요약표 → 해당 `D<번호>.md` |
| 새 도메인 사이클 | [docs/process/03_도메인_사이클_템플릿.md](docs/process/03_도메인_사이클_템플릿.md) (스킬: `architecture-driver`) |
| admin-web 화면 | [docs/design/디자인시스템.md](docs/design/디자인시스템.md) 먼저 |
| 발표자료 | [docs/presentation/4-0_발표자료_공통지침.md](docs/presentation/4-0_발표자료_공통지침.md) 먼저 |
| 세션 마무리(기록) | `.claude/skills/wrap-up/SKILL.md` |

`docs/log/`는 "왜 그렇게 됐나"를 따라갈 때만 연다. 세션 시작 때 읽지 않는다.

## 명령어

```bash
npm install                    # 루트에서 전체 워크스페이스 설치
npm run dev:api / dev:web      # api(localhost:3000/api/v1) / admin-web(localhost:5173)
npm run db:up / db:down        # PostgreSQL (Docker)
npm run prisma:generate / prisma:migrate   # 새로 clone한 환경은 api 빌드 전에 generate 필수
node scripts/doc-check.mjs     # 문서 검사(링크·옛 이름·ADR ID·크기 상한·인덱스)
```

앱별 lint·build·test와 테스트 DB 준비는 각 앱의 CLAUDE.md에 있다.

**검증 수단:** CI(`.github/workflows/ci.yml` — PR과 `main` push에서 api lint·빌드·jest, admin-web lint·빌드, doc-check)와 커밋 전 hook(`.claude/hooks/pre-commit-check.js` — `apps/`·`packages/` 변경 시 양쪽 lint·빌드·jest, 문서 변경 시 doc-check). jest는 도메인 핵심 규칙(지점 격리·계약 종료 차단·인사 권한 분리)과 실DB 동시성·도메인 규칙을 본다 — 도메인별 범위는 각 도메인 문서 §11. admin-web은 테스트가 없어 lint+빌드(타입체크)뿐이다.

## 프로젝트 가드레일

**도메인 불변식 — 코드를 바꿀 때 깨뜨리면 안 되는 것**
- **지점 데이터 격리**: BRANCH_ADMIN은 자기 지점 데이터만 조회·수정한다. 지점 단위 라우트를 추가·수정하면 **`apps/api/test/branch-isolation.spec.ts` 공격 케이스 표에 함께 추가**하고 다른 지점 ID로 403/404를 확인한다. 격리는 `BranchScopeGuard`(`branchId` 파라미터·쿼리만 검사)와 컨트롤러별 `assert*`의 조합이라 `:id` 라우트는 컨트롤러가 직접 검사해야 한다. 공통 가드 중앙화는 전제조건(실DB 전환)이 충족됐지만 착수는 사용자 승인 대상이다.
- **계약 종료 지점 차단**: `TERMINATED` 지점은 신규 회원 등록·예약 생성·게시글 작성이 409(`BRANCH_TERMINATED`), 과거 조회는 유지. `EXPIRED`·`RENEWAL_DUE`는 차단하지 않는다. 판정은 `BranchService.loadGate()`의 gate로 한다. TERMINATED 시 파견 종료·재배치 등록은 설계만 있고 미구현.
- **인사 권한 분리**: 채용·재배치는 SUPER_ADMIN만. BRANCH_ADMIN은 파견된 인력의 일상 관리만.
- "지점이 직원을 고용한다"는 전제로 코드·문서를 쓰지 않는다.

**사용자 승인이 필요한 결정** (전역 가드레일 §2에 추가)
- Prisma 스키마 필드·엔티티 변경(공유 엔티티는 entities.md가 기준), 인증 방식 변경, DB 역할·설정 변경
- 의도적 범위 제외 항목(강사 정산, 혼잡도 QR·자동계산, 노쇼 자동 배치, 감가상각 등 — 각 도메인 문서 부록 A-8 "범위 제외")의 구현 — 설계 문서에 있다고 만들지 않는다
- 배포 DB(Supabase)에 대한 쓰기

**구현 작업 원칙 (2026-09-22 확립, `architecture-driver` 스킬의 원본)** — 대화로 구현을 맡기는 방식에서 사용자가 diff를 매번 보지 않고도 방향을 잡을 수 있게:
1. **구현 전에 근거를 밝힌다** — 어느 도메인 문서의 어느 Driver/ADR, 또는 `D<번호>`에 근거하는지 인용한다. 해당 결정이 없으면 대안·트레이드오프·결정 이유를 최소한 문장으로 먼저 남긴다.
2. **구현 후 기록한다** — 마무리는 `wrap-up` 스킬 절차(STATUS 갱신 + `docs/log/NNN.md` 한 건 + 도메인 ADR·검증현황·요약 카드).
3. **커밋 메시지에 근거 ID를 담는다**(한국어, ADR·D 번호 인용).
4. 스킬 쪽 개선을 역으로 반영하려면 스킬 저장소 CHANGELOG.md를 먼저 확인한다.

**보고할 때 지킬 것**
- 테스트를 돌리지 않았거나 테스트가 없는 영역은 "검증되지 않음"으로 보고한다.
- 격리·계약·인사 권한 테스트가 실패하면 기대값을 바꾸지 말고 코드의 규칙 위반으로 보고한다.
- 문서와 코드가 어긋나면 알린다.

**보호 영역**: `docs/presentation/`은 발표자료 작업을 요청받았을 때만 수정한다(수정 시 확인 프롬프트). `docs/deliverables/`는 자기완결형 제출본이라 다른 문서를 링크로 얽지 않는다.

## 문서 작업 규칙 (D38)

- **한 사실은 한 곳에만.** 현재 상태 → STATUS.md(덮어쓰기, 80줄 상한), 도메인 결정·검증 → 도메인 문서, 횡단 결정 → `decisions/D<번호>.md`(결정 하나에 파일 하나, 고치지 않고 새 번호로 대체), 경위 → `log/NNN.md`(한 건에 파일 하나, append-only).
- **위치가 아니라 ID로 인용한다.** 코드 주석은 `예약및결제 A-6`, `ADR-RSV-01`, `D37`처럼 쓴다 — 경로·절 번호가 바뀌어도 깨지지 않는다. 재편 전의 문서 번호 인용 형식(두 자리 번호·`1-n` 번호 + "문서")은 쓰지 않는다(doc-check가 막는다).
- 새 로그·결정 파일은 기존 파일을 읽지 않고 새로 만든 뒤 해당 README 인덱스에 한 줄만 추가한다.
- 상대링크는 실제 파일 위치 기준으로 맞추고, 커밋 전 `node scripts/doc-check.mjs`를 통과시킨다.

## 작업 환경 유의사항

- **브랜치**: 배포·기준 브랜치는 `main-5x9td9`(Render·Lambda 배포 대상). 코드 변경은 작업 브랜치 → `main-5x9td9` 대상 PR → CI 확인 → rebase 병합.
- GitHub Desktop과 동시에 열려 있을 수 있어 **커밋 안 된 변경이 자동 stash될 수 있다.** 큰 작업 전후로 `git status`/`git stash list`를 확인한다.
