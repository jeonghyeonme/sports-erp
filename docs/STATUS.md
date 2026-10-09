# STATUS — 지금 상태와 다음 할 일

> **세션 시작점.** 이 파일은 "지금"만 담고 세션을 마칠 때마다 **덮어쓴다**(80줄 상한, `scripts/doc-check.mjs`). 끝난 일은 지우고 경위는 [log/](log/README.md)로 보낸다.
> 마지막 갱신: 2026-10-09 · [log/090](log/090.md)(인사 채용·파견·퇴사 화면, ADR-STF-05)

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
| 회원 웹 | `apps/member-web`(`/m/`, 같은 Worker) — 로그인·세션 복원, 하단 탭 4개(홈·예약하기·내 예약·내 정보). 홈 혼잡도·최근 공지(60초 캐시), 예약·모의 결제·취소, 공지, 내 정보 조회·수정. CI·커밋 hook이 lint·빌드를 본다(자동 테스트 없음). 로컬 Worker 경유 확인·실측(방문당 api 3~11회). **Worker 배포 전**(사용자, 세션은 egress 차단). 가입·연동 화면 없음. 배포 DB에 시연 회차(서초 아침 요가 평일, 12/31까지) | [D41](decisions/D41.md), [log/083](log/083.md)~[085](log/085.md) |
| admin-web 도움말 | 상단 "도움말" 버튼 → 오른쪽 패널(화면 16개, 역할별 순서·자주 나는 오류). 오류 문구 아래 "해결" 한 줄(코드 → 문구 표 `lib/error-hints.ts`) | [log/089](log/089.md), 디자인시스템 §5 |
| 문서 구조 | 2026-10-01 재편 완료 — 로딩 계층·doc-check 도입 | [D38](decisions/D38.md) |

## 다음 할 일 (우선순위순)

> 각 항목을 새 세션에서 시작하는 방법(근거·범위·완료 기준·주의점)은 [작업 브리프](process/04_작업_브리프.md)의 B 번호를 본다.

0. **B1 회원 모바일 웹(D40·D41)** — 구현 끝(B1-1~4). 남은 것은 **사용자 Worker 배포**(`npm run build:web` → `cd cloudflare-worker && npx wrangler deploy`)와 배포 후 운영 확인·일일 요청 관찰, (선택) 가입·연동 화면 — [브리프 B1](process/04_작업_브리프.md).
1. **배포 확인(사용자)** — B8은 응답 형식을 바꿨다. api(Lambda)는 병합 시 배포되고, 화면(Worker)은 `npm run build:web` → `wrangler deploy`로 따로 배포한다. 그 사이 기존 화면은 첫 20건만 보인다(log/088). B5·B8 끝.
2. RFP 잔여(작음): 상세 전화번호 열람 기록(D44 범위 밖) — 요구사항추적표 §2-3. 화면별 도움말은 admin-web 완료(log/089), member-web 오류 해결 줄은 남음
3. API만 있고 화면이 없는 것: 결근 확정(근태), 자산 정보 수정, 비밀번호 변경, 회원 가입·연동 — 요구사항추적표 §3. 인사 채용·파견·퇴사는 끝(log/090)
4. 사용자(선택): 폐기된 Render `sports-erp-web` 삭제. (Supabase 커넥터는 2026-10-08 정상 동작 확인 — log/084)

## 사용자 승인 대기 (승인 전 착수 금지)

- **보조 스크립트 처리 — 미정.** 선택지 A(`set-lambda-env.sh` 경고를 중단으로) / B(Worker 전환·k6 실행·진단 스크립트를 `aws-lambda/`로) / C(두지 않음). 내용·비용은 [log/056](log/056.md) "미정" 표.
- DB 제약 보강(스키마 변경): `Document.relatedStaffId`·`uploadedBy` 외래키([D34](decisions/D34.md)), `Post.authorId`, `WorkLog(staffId, date)` unique([D33](decisions/D33.md)).
- 지점 격리 검사의 공통 가드 중앙화 — 전제조건(실DB 전환) 충족([요구사항추적표](reference/요구사항추적표.md) §3).
- Lambda용 DB 역할 `statement_timeout` 설정(DB 변경, D37).
- 퇴사 시 담당 회원 해제 여부 — 지금은 퇴사한 직원이 회원 담당으로 남는다(파견은 해제, ADR-STF-04). [log/090](log/090.md)

## 열린 위험

- **방문당 호출이 가정(⑩ 10회)을 넘을 수 있다**: 로컬 Worker 경유 실측 3~11회(기능을 다 쓰면 11). ⑩은 10을 유지했다 — 11이면 ⑬ ≈10.1만으로 Workers 무료 한도를 넘는다. 배포 후 Cloudflare 일일 요청이 9만을 넘으면 Workers 유료 검토(D40 재고 트리거, [log/085](log/085.md)).
- **처리 한계가 설계 가정보다 작다**: 요청당 Lambda 처리 p50 약 110ms(가정 50ms) → 상한 10에서 실질 약 50~55 rps. 최악 가정 몰림(약 24 rps)의 약 2배라 설정은 유지했다([D42](decisions/D42.md)). S1은 거절 1건으로 에러 기준 미달로 남겼다. 원인(풀러 왕복 × 쿼리 수)은 추정만 했다. 회원 웹 배포 후 실측 몰림이 약 25 rps를 넘으면 D42 재고.
- **Worker 로그인 rate limit은 연결을 재사용할 때만 걸린다**: 같은 연결로는 12번째부터 429, 요청마다 새 연결이면 60초에 30회도 통과했다(2026-10-07, [log/079](log/079.md)). 그때는 Lambda 상한 10 + 503 `SERVER_BUSY`가 2차 방어. 코드는 유지하기로 했다(대안: Durable Object 카운터 / API 계정별 제한).
- `ORIGIN_SECRET`·DB 비밀번호가 대화에 노출됐다(사용자가 교체 보류). Render가 정지돼 이제 DB 비밀번호를 쓰는 곳은 Lambda뿐이다 — 바꾸면 `.env` → `set-lambda-env.sh` → Actions 재배포.
- DB 무료 용량(500MB): 예약·결제 이력만으로 1~1.5년 안에 닿는다(design-constants ⑮, 가정). 지점이 90곳을 넘으면 Workers 무료 한도 초과(⑬).
- AWS 클래식 계정은 유료 플랜이라 지출 한도가 없다. 예산 경보($1/$5/$20)·Lambda 경보(SNS 이메일, 2026-10-04 재구독)는 있고 대응은 수동이다. 경보 메일의 unsubscribe 링크를 누르면 구독이 지워진다.
- 회원 웹 refresh token이 localStorage에 있다(D41) — XSS가 생기면 탈취될 수 있다. 빌드 순서(admin → member)를 어기면 `dist/m`이 지워진 채 배포된다(`npm run build:web` 사용).
- admin-web은 테스트가 없어 lint·빌드만 검증된다. 전환 후 화면은 로그인·데이터 조회만 확인했다.
