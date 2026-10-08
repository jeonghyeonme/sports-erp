# STATUS — 지금 상태와 다음 할 일

> **세션 시작점.** 이 파일은 "지금"만 담고 세션을 마칠 때마다 **덮어쓴다**(80줄 상한, `scripts/doc-check.mjs`). 끝난 일은 지우고 경위는 [log/](log/README.md)로 보낸다.
> 마지막 갱신: 2026-10-08 · [log/084](log/084.md)(회원 웹 공지·혼잡도·내 정보 B1-3, 지난 회차 예약 차단)

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
| 회원 웹 | `apps/member-web`(`/m/`, 같은 Worker) — 로그인·세션 복원, 하단 탭 4개(홈·예약하기·내 예약·내 정보). 홈에 혼잡도(수동 새로고침 30초)·최근 공지, 예약·모의 결제·취소, 공지 목록·상세, 내 정보 조회·수정. 로컬 api+DB로 확인(한 방문 9~13회 호출), 자동 테스트 없음. 배포·Worker 경유 확인 전이고 CI에 lint·빌드가 없다(B1-4). 배포 DB에 시연 회차(서초 아침 요가 평일, 12/31까지) 있음 | [D41](decisions/D41.md), [log/083](log/083.md), [log/084](log/084.md) |
| 문서 구조 | 2026-10-01 재편 완료 — 로딩 계층·doc-check 도입 | [D38](decisions/D38.md) |

## 다음 할 일 (우선순위순)

> 각 항목을 새 세션에서 시작하는 방법(근거·범위·완료 기준·주의점)은 [작업 브리프](process/04_작업_브리프.md)의 B 번호를 본다.

0. **B1 회원 모바일 웹(D40·D41)** — 발표 시연 전 목표. B1-1~B1-3 끝. 다음은 **B1-4 배포·기록**: CI에 member-web lint·빌드, Worker 배포·`/m/` 깊은 경로 확인, 방문당 호출 실측으로 design-constants ⑩ 교체(로컬 실측 9~13회 — 홈 카드 재진입 캐시 여부도 이때 판단, log/084), 회원관리·예약및결제 요약 카드·요구사항추적표 §3 정리.
1. **B5 RFP 미구현 중 비용이 작은 것** — AuditLog 기록(상세 전화번호 열람 포함) / 공통 Toast(각각 세션 1개). 응답 마스킹은 끝났다(ADR-MEM-04, log/078).
2. **B8 쌓이는 목록 페이지네이션** — 회원·예약·결제·자산 offset 페이지네이션 + 결제 날짜 필터를 DB 조건으로([D43](decisions/D43.md), ADR-RSV-04). 응답 형식이 바뀌어 admin-web 4개 화면도 함께 고친다.
3. 사용자(선택): 폐기된 Render `sports-erp-web` 삭제. (Supabase 커넥터는 2026-10-08 정상 동작 확인 — log/084)

## 사용자 승인 대기 (승인 전 착수 금지)

- **보조 스크립트 처리 — 미정.** 선택지 A(`set-lambda-env.sh` 경고를 중단으로) / B(Worker 전환·k6 실행·진단 스크립트를 `aws-lambda/`로) / C(두지 않음). 내용·비용은 [log/056](log/056.md) "미정" 표.
- DB 제약 보강(스키마 변경): `Document.relatedStaffId`·`uploadedBy` 외래키([D34](decisions/D34.md)), `Post.authorId`, `WorkLog(staffId, date)` unique([D33](decisions/D33.md)).
- 지점 격리 검사의 공통 가드 중앙화 — 전제조건(실DB 전환) 충족([요구사항추적표](reference/요구사항추적표.md) §3).
- Lambda용 DB 역할 `statement_timeout` 설정(DB 변경, D37).

## 열린 위험

- **방문당 호출이 가정(⑩ 10회)을 넘을 수 있다**: 로컬 실측 9~13회(공지 읽기·홈 재진입 포함 시 13). 배포 후 B1-4에서 실측해 ⑩·⑬을 고친다([log/084](log/084.md)).
- **처리 한계가 설계 가정보다 작다**: 요청당 Lambda 처리 p50 약 110ms(가정 50ms) → 상한 10에서 실질 약 50~55 rps. 최악 가정 몰림(약 24 rps)의 약 2배라 설정은 유지했다([D42](decisions/D42.md)). S1은 거절 1건으로 에러 기준 미달로 남겼다. 원인(풀러 왕복 × 쿼리 수)은 추정만 했다. 회원 웹 배포 후 실측 몰림이 약 25 rps를 넘으면 D42 재고.
- **Worker 로그인 rate limit은 연결을 재사용할 때만 걸린다**: 같은 연결로는 12번째부터 429, 요청마다 새 연결이면 60초에 30회도 통과했다(2026-10-07, [log/079](log/079.md)). 그때는 Lambda 상한 10 + 503 `SERVER_BUSY`가 2차 방어. 코드는 유지하기로 했다(대안: Durable Object 카운터 / API 계정별 제한).
- `ORIGIN_SECRET`·DB 비밀번호가 대화에 노출됐다(사용자가 교체 보류). Render가 정지돼 이제 DB 비밀번호를 쓰는 곳은 Lambda뿐이다 — 바꾸면 `.env` → `set-lambda-env.sh` → Actions 재배포.
- DB 무료 용량(500MB): 예약·결제 이력만으로 1~1.5년 안에 닿는다(design-constants ⑮, 가정). 지점이 90곳을 넘으면 Workers 무료 한도 초과(⑬).
- AWS 클래식 계정은 유료 플랜이라 지출 한도가 없다. 예산 경보($1/$5/$20)·Lambda 경보(SNS 이메일, 2026-10-04 재구독)는 있고 대응은 수동이다. 경보 메일의 unsubscribe 링크를 누르면 구독이 지워진다.
- 회원 웹 refresh token이 localStorage에 있다(D41) — XSS가 생기면 탈취될 수 있다. 빌드 순서(admin → member)를 어기면 `dist/m`이 지워진 채 배포된다(`npm run build:web` 사용).
- admin-web은 테스트가 없어 lint·빌드만 검증된다. 전환 후 화면은 로그인·데이터 조회만 확인했다.
