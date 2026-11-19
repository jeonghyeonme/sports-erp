# AGENTS.md

스포이즘 ERP. Claude가 구현하고 Codex가 PR을 리뷰한다(`@codex review`). 작업 규칙 전체는 [CLAUDE.md](CLAUDE.md)와 앱별 `apps/*/CLAUDE.md`에 있다.
아래 리뷰 기준은 그 문서들의 규칙을 옮겨 적은 것이다. 원본이 바뀌면 이 파일도 함께 고친다.

## Code Review Rules

아래를 어기면 P0·P1로 보고한다. 근거 ID(`D46` = `docs/decisions/D46.md`)는 PR 설명이나 코드 주석에서 따라갈 수 있다.

1. **지점 데이터 격리(D46)**: BRANCH_ADMIN은 자기 지점 데이터만 조회·수정한다. 격리는 전역 `BranchScopeGuard` 한 곳이 본다. 리소스 id를 받는 라우트에 `@ScopedResource(kind)`가 없거나, 지점 단위 라우트를 추가·수정하면서 `apps/api/test/branch-isolation.spec.ts` 공격 케이스 표에 넣지 않았거나, 컨트롤러에 지점 검사를 손으로 다시 썼으면 지적한다.
2. **세부 권한(D60)**: 지점 관리자·직원이 닿는 새 라우트에는 `@Permission(feature, action)`(카탈로그 `apps/api/src/common/permissions/permission-catalog.ts`) 또는 이유를 단 `@PermissionExempt`가 있어야 한다. 개인 허용이 `@Roles` 상한을 넘으면 안 된다.
3. **계약 종료 지점 차단(D70)**: `TERMINATED` 지점의 신규 회원 등록·예약 생성·게시글 작성·직원 채용·파견 발령은 409(`BRANCH_TERMINATED`)여야 한다. `EXPIRED`·`RENEWAL_DUE`는 차단하지 않는다. 판정은 쓰기 트랜잭션 안에서 `lockBranchForShare`(`apps/api/src/prisma/integrity.ts`)로 지점 행을 읽어 한다. 트랜잭션 밖에서 미리 읽어 판정하면 지적한다. 계약 쓰기는 본사 전용이고, 변경 이력을 같은 트랜잭션에 남긴다(D68).
4. **인사 권한 분리**: 채용·재배치는 SUPER_ADMIN만 한다. BRANCH_ADMIN은 파견된 인력의 일상 관리만 한다. "지점이 직원을 고용한다"는 전제의 코드도 지적한다.
5. **적용된 마이그레이션 수정 금지**: 이미 있는 `apps/api/prisma/migrations/*/migration.sql`을 고치면 배포 DB의 `migrate deploy`가 체크섬 불일치로 실패한다. 바꿀 것은 새 마이그레이션으로 만들어야 한다.
6. **날짜는 KST로**: 날짜는 `apps/api/src/common/date/kst-date.ts`(`todayKst()`·`toKstDateString()`·`kstHoursMinutes()`)로 다룬다. `new Date().toISOString().slice(0, 10)`처럼 UTC로 날짜를 자르면 00:00~08:59 KST 이벤트가 전날로 기록된다.
7. **트랜잭션 안에서는 `tx`만(D37)**: 트랜잭션 콜백 안에서 `tx` 대신 전역 Prisma 클라이언트를 쓰면 운영 연결 1개 환경에서 막히고 원자성이 깨진다.
8. **비밀정보**: 키·토큰·비밀번호·`.env` 값이 코드·테스트·로그·커밋·문서에 들어가면 지적한다. 환경변수 이름으로만 참조한다.
9. **테스트 약화 금지**: 격리·계약·인사 권한 테스트(`branch-isolation`·`branch-scope-coverage`·`permission-coverage`·`contract-*`·`hr-authority` 등)의 기대값을 바꾸거나 삭제·skip해서 통과시키면 지적한다. 실패는 코드의 규칙 위반으로 다뤄야 한다.
