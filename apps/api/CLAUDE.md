# apps/api — 작업 규칙

> `apps/api/` 파일을 다룰 때만 로드된다. 루트 CLAUDE.md의 도메인 불변식이 우선한다.

## 명령어 (apps/api 안에서)

```bash
npm run lint    # eslint --fix — 파일을 직접 고친다. 검사만 하려면 `npm exec -- eslint .`
npm run build   # nest build (새 clone이면 루트에서 `npm run prisma:generate` 먼저)
npm run test    # jest — HTTP 통합 테스트(test/), 실제 AppModule + supertest
```

**테스트 DB 준비**(CI도 같은 순서 — `.github/workflows/ci.yml`): `npm run db:up` → `npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma` → `npm run prisma:seed --workspace=apps/api`. `DATABASE_URL`과 `DIRECT_URL`이 필요하다(로컬은 같은 값, `.env.example`). jest는 워커마다 기준 DB를 템플릿으로 복제해 쓰므로 기준 DB 계정에 CREATEDB 권한이 필요하고, 테스트가 기준 DB를 오염시키지 않는다(D29).

## 현재 구조 (착각하기 쉬운 부분)

- 전 도메인이 `PrismaService`로 동작한다(D26~D36). `MockDataService`와 인메모리 미러는 삭제됐다 — **인메모리 저장소를 새로 만들지 말 것.** "스키마에 있으니 동작한다"고 가정하지 말고 도메인 문서 §11·부록 A-8을 확인한다.
- 계약 종료 판정은 `BranchService.loadGate()`의 gate(`src/modules/branches/branch-gate.ts`), 예약 생성은 회차 행 락(`lockScheduleSlot`) 위에서 정원을 센다(ADR-RSV-01).
- 부분 unique 인덱스·CHECK 제약·지점 일치 트리거(D27·D28)는 `schema.prisma`가 아니라 **마이그레이션 SQL에만** 있다(schema.prisma 상단 주석). 도메인을 옮기거나 규칙을 추가할 때는 [data-integrity.md](../../docs/architecture/data-integrity.md) §6 체크리스트(채번·회차 락 헬퍼 포함)를 따른다.
- **이미 적용된 `prisma/migrations/*/migration.sql`은 고치지 않는다** — 체크섬이 바뀌어 배포 DB의 `migrate deploy`가 실패한다. 바꿀 게 있으면 새 마이그레이션을 만든다.
- `src/mock-data/`는 역사적 이름이다 — 응답 형식 타입(`mock-data.types.ts`)·시드 원천(`*-fixtures.ts`)·데모 비밀번호(`demo-password.ts`)만 있다. `prisma/seed.ts`가 픽스처를 upsert한다. 데모 계정·히어로 데이터 id(`account-haneul`, `staff-seoyeon`, `post-hq-manual` 등)는 테스트·admin-web이 기대므로 바꾸지 말 것.
- Supabase(배포 DB) 시드는 같은 픽스처로 upsert SQL을 만들어 빈 로컬 복제 DB에서 2회 실행·지문 비교 후 **사용자 승인을 받아** 적용한다(절차: `docs/log/044`~`050`).

## 날짜 계산

반드시 `src/common/date/kst-date.ts`를 쓴다. `new Date().toISOString().slice(0, 10)`은 항상 UTC라 00:00~08:59 KST 이벤트가 전날로 기록된다(실제로 5개 도메인 10곳에 있던 버그 — [date-time-handling.md](../../docs/architecture/date-time-handling.md)). "오늘"은 `todayKst()`, 임의 시각은 `toKstDateString(date)`, 시:분 비교는 `kstHoursMinutes(date)`.

## 테스트 작성 규칙

- `test/helpers/app.ts`의 `createApp()`으로 서버와 같은 전역 설정의 앱을 띄운다. `main.ts`·`lambda.ts`·테스트 헬퍼가 모두 `src/app.setup.ts`의 `configureApp()`을 부르므로 **전역 설정은 그 함수에서만** 바꾼다(D37).
- 워커 DB는 파일마다 기준 템플릿에서 다시 만든다(`resetWorkerDb`, after-env beforeAll). 같은 파일 안에서 DB 쓰기(채용·퇴사·파견 등)가 다음 테스트로 새면 `beforeEach`에서 `createApp()` **전에** `resetWorkerDb()`를 부른다(D36 `posts-member-visibility`가 이 이유로 깨졌었다).
- 가드 → 파이프 → 핸들러 순서라 **거부 케이스도 유효한 요청 본문**을 보내야 400이 아니라 403이 나온다. 403 테스트에는 자기 지점 접근이 성공하는 **대조군**을 반드시 함께 둔다.
- DB 상태는 `db(app)`(PrismaService)로 읽고 쓴다. 지점 계약 상태는 `test/helpers/branch-status.ts`의 `setBranchStatus`로 바꾼다.
- `tsconfig.build.json`이 `test/`를 빌드에서 제외한다(없으면 `dist/main.js`가 `dist/src/main.js`로 바뀐다).

## 배포 (D37 — 진행 상태는 docs/STATUS.md)

진입점 `src/lambda.ts`, 묶음 `bash scripts/package-lambda.sh`, 자동 배포 `.github/workflows/deploy-api-lambda.yml`(`dev` push, D39). 배포 환경에서 `JWT_ACCESS_SECRET`·`JWT_REFRESH_SECRET`·`ORIGIN_SECRET`이 없으면 부팅이 실패한다(`src/common/config/secrets.ts`). 동시 실행 상한 10과 풀러 `connection_limit=1`은 D37 결정 1의 요청량 설계이므로 바꾸려면 D37을 먼저 본다. 콘솔 절차는 `aws-lambda/README.md`.
