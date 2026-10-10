# STATUS — 지금 상태와 다음 할 일

> **세션 시작점.** 이 파일은 "지금"만 담고 세션을 마칠 때마다 **덮어쓴다**(80줄 상한, `scripts/doc-check.mjs`). 끝난 일은 지우고 경위는 [log/](log/README.md)로 보낸다.
> 마지막 갱신: 2026-10-10 · [log/102](log/102.md)(처리 한계 원인 측정과 1단계 대응), [log/101](log/101.md)(열람 기록 정리 절차)

## 현재 상태

| 영역 | 상태 | 근거 |
|---|---|---|
| 도메인 9개 | 문서화·핵심 ADR 구현 완료. 도메인별 검증 범위는 각 도메인 문서 §11 | `domains/` |
| 데이터 | 전 도메인 Prisma(Supabase Postgres) — `MockDataService` 삭제 | [D36](decisions/D36.md) |
| api 호스팅 | **AWS Lambda(서울) 운영 중** — Worker origin을 Function URL(별칭 `live`)로 전환했다. 배포는 `dev` push 또는 Actions 수동 실행(OIDC). k6 실측(2026-10-04): 로그인 p95 237ms, 실질 처리 한계 약 50 rps → 동시 실행 상한 10·1,024MB 유지로 확정(D42). Render `sports-erp-api`는 2026-10-06 일시정지(롤백은 Lambda 별칭으로) | [D37](decisions/D37.md), [D42](decisions/D42.md), [log/075](log/075.md) |
| admin-web·엣지 | Cloudflare Worker(정적 자산 + 프록시 + rate limit). `API_ORIGIN`·`ORIGIN_SECRET`은 Worker secret | [D25](decisions/D25.md), [D37](decisions/D37.md) |
| 저장소 | 주 개발·배포 브랜치 = `dev`(기본 브랜치), `main` = 완성본(완료 시 병합). 작업은 임시 브랜치 → `dev` PR → 병합 후 삭제. 2026-10-06 전환 완료(`dev`에서 배포 성공), 원격에는 `dev`·`main`만 남김 | [D39](decisions/D39.md), [log/067](log/067.md) |
| 산출물 | 요구사항 정의서·데이터 정의서(Excel), 기업 분석·제안서·아키텍처 설계서(Word) — `scripts/deliverables/`로 재생성 | [log/061](log/061.md), [log/062](log/062.md) |
| 범위 | **지점 수도권 83곳 + 회원 모바일 웹으로 재설정(2026-10-06)**. 덱·문서·산출물·시드·테스트·관리자 웹·배포 DB 모두 83곳(2026-10-06) | [D40](decisions/D40.md), [log/074](log/074.md) |
| 회원 웹 | `apps/member-web`(`/m/`, 같은 Worker) — 로그인·세션 복원, 하단 탭 4개(홈·예약하기·내 예약·내 정보). 홈 혼잡도·최근 공지(60초 캐시), 예약·모의 결제·취소, 공지, 내 정보 조회·수정·비밀번호 변경, 가입·지점 회원 연동(`/join`). **PWA**(홈 화면 설치·오프라인 셸·앱 셸, D45). CI·커밋 hook이 lint·빌드를 본다(자동 테스트 없음). 로컬 Worker 경유 확인·실측(방문당 api 3~11회). **Worker 배포 완료(2026-10-09, 사용자)** — log/092 이후 변경은 다시 배포해야 반영된다. 배포 DB에 시연 회차(서초 아침 요가 평일, 12/31까지) | [D41](decisions/D41.md), [log/083](log/083.md)~[085](log/085.md) |
| admin-web 도움말 | 상단 "도움말" 버튼 → 오른쪽 패널(화면 16개, 역할별 순서·자주 나는 오류). 오류 문구 아래 "해결" 한 줄(코드 → 문구 표 `lib/error-hints.ts`) | [log/089](log/089.md), 디자인시스템 §5 |
| 지점 격리 | 전역 `BranchScopeGuard` 한 곳(branchId 파라미터·쿼리 + `@ScopedResource` 리소스 소유). 선언 누락은 `branch-scope-coverage` spec이 잡는다. BRANCH_ADMIN이 남의 branchId를 주면 모든 목록에서 403 | [D46](decisions/D46.md), [log/095](log/095.md) |
| 개인정보 열람 | 목록은 전화번호 마스킹(ADR-MEM-04), 관리자가 회원·직원 상세를 열면 AuditLog `PHONE_VIEWED`(본인 조회 제외). 본사만 "변경 이력"에서 본다. 보존 1년 규칙, 자동 삭제 없음 | [D47](decisions/D47.md), [log/100](log/100.md) |
| 계약 상태 변경 | 본사 `PATCH /branches/:branchId/contract-status`(API만, 화면 없음). TERMINATED 전이 시 그 지점의 진행 중 파견을 같은 트랜잭션에서 종료하고 재배치 대상을 응답으로 돌려준다. 채용·발령과는 지점 행 락으로 직렬화 | 인사정보관리 ADR-STF-07, [log/099](log/099.md) |
| 문서 구조 | 2026-10-01 재편 완료 — 로딩 계층·doc-check 도입 | [D38](decisions/D38.md) |

## 다음 할 일 (우선순위순)

> 각 항목을 새 세션에서 시작하는 방법(근거·범위·완료 기준·주의점)은 [작업 브리프](process/04_작업_브리프.md)의 B 번호를 본다.

0. **화면 재배포(사용자)** — PWA·앱 셸(log/094, Worker 설정 포함), 가입·연동 화면(log/092), 결근 확정·자산 수정 화면(log/096), 회원 웹 데모 로그인 버튼(log/097), 회원 웹 오류 해결 줄(log/098), 변경 이력의 "파견 종료" 문구(log/099)·"전화번호 열람" 이벤트(log/100)는 병합 뒤 `npm run build:web` → `cd cloudflare-worker && npx wrangler deploy`로 Worker에 다시 올려야 보인다(api는 병합 시 Lambda 자동 배포). 그다음 Cloudflare 일일 요청 관찰(D40 재고 트리거 9만).
1. 배포 확인(사용자): 2026-10-09 Worker 배포까지 반영된 것 — 회원 웹, 목록 페이지네이션(B8), 화면별 도움말, 인사 화면, 비밀번호 변경. 운영 화면에서 한 번씩 눌러 보기.
2. ~~RFP 잔여(작음)~~ — 상세 전화번호 열람 기록(D47, log/100)으로 끝. 남은 RFP 항목은 요구사항추적표 §2-3(변경 신청 승인·첨부·캘린더형 예약·개인정보처리방침)
3. ~~API만 있고 화면이 없는 것~~ — 결근 확정·자산 정보 수정(log/096)으로 끝. 화면은 Worker 재배포 후 보인다
4. 계약 상태 변경 화면(admin-web, 지점 상세) — API만 있다(ADR-STF-07 숙제). 재배치 대기 직원 모아 보기·지점 소속 계정 일괄 처리(entities.md §2-1)도 미정
5. 사용자(선택): 폐기된 Render `sports-erp-web` 삭제. (Supabase 커넥터는 2026-10-08 정상 동작 확인 — log/084)

## 사용자 승인 대기 (승인 전 착수 금지)

- **`pgbouncer=true` 제거(D48 A안)** — 처리 한계를 가장 크게 늘리는 안(S2 왕복 약 1/3.5)이지만 D37 접속 설정을 바꾼다. Supavisor의 prepared statement 동작 확인과 운영 k6 재측정이 따른다. 비밀값 교체는 열린 위험에 남아 있다.

## 열린 위험

- **방문당 호출이 가정(⑩ 10회)을 넘을 수 있다**: 로컬 Worker 경유 실측 3~11회(기능을 다 쓰면 11). ⑩은 10을 유지했다 — 11이면 ⑬ ≈10.1만으로 Workers 무료 한도를 넘는다. 배포 후 Cloudflare 일일 요청이 9만을 넘으면 Workers 유료 검토(D40 재고 트리거, [log/085](log/085.md)).
- **처리 한계가 설계 가정보다 작다**: 요청당 Lambda 처리 p50 약 110ms(가정 50ms) → 상한 10에서 실질 약 50~55 rps([D42](decisions/D42.md)). 원인은 풀러 모드(`pgbouncer=true`)에서 Prisma 작업마다 붙는 왕복 3번이다(로컬 실측, [D48](decisions/D48.md)). 1단계(인증·목록 조회 합치기)로 S2 왕복 20.8 → 16.8, 운영 기대 약 60 rps(추정·미측정) — 병합 뒤 k6 S2로 다시 잰다. 몰림이 약 25 rps를 넘으면 A안부터.
- **Worker 로그인 rate limit은 연결을 재사용할 때만 걸린다**: 같은 연결로는 12번째부터 429, 요청마다 새 연결이면 60초에 30회도 통과했다(2026-10-07, [log/079](log/079.md)). 그때는 Lambda 상한 10 + 503 `SERVER_BUSY`가 2차 방어. 코드는 유지하기로 했다(대안: Durable Object 카운터 / API 계정별 제한).
- `ORIGIN_SECRET`·DB 비밀번호가 대화에 노출됐다(사용자가 교체 보류). Render가 정지돼 이제 DB 비밀번호를 쓰는 곳은 Lambda뿐이다 — 바꾸면 `.env` → `set-lambda-env.sh` → Actions 재배포.
- DB 무료 용량(500MB): 예약·결제 이력만으로 1~1.5년 안에 닿는다(design-constants ⑮, 가정). 지점이 90곳을 넘으면 Workers 무료 한도 초과(⑬).
- 열람 기록이 연 약 100MB 쌓일 수 있다(지점당 하루 상세 10회 가정, 근거 없음). 자동 삭제가 없어 **2027-10-10부터 연 1회** [data-retention](architecture/data-retention.md) 절차로 수동 삭제한다(배포 DB 쓰기, 승인). AuditLog 50MB 초과 시 D47 재고.
- AWS 클래식 계정은 유료 플랜이라 지출 한도가 없다. 예산 경보($1/$5/$20)·Lambda 경보(SNS 이메일, 2026-10-04 재구독)는 있고 대응은 수동이다. 경보 메일의 unsubscribe 링크를 누르면 구독이 지워진다.
- 회원 웹 refresh token이 localStorage에 있다(D41) — XSS가 생기면 탈취될 수 있다. 빌드 순서(admin → member)를 어기면 `dist/m`이 지워진 채 배포된다(`npm run build:web` 사용).
- admin-web은 테스트가 없어 lint·빌드만 검증된다. 전환 후 화면은 로그인·데이터 조회만 확인했다.
