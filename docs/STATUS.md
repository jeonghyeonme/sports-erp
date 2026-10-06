# STATUS — 지금 상태와 다음 할 일

> **세션 시작점.** 이 파일은 "지금"만 담고 세션을 마칠 때마다 **덮어쓴다**(80줄 상한, `scripts/doc-check.mjs`). 끝난 일은 지우고 경위는 [log/](log/README.md)로 보낸다.
> 마지막 갱신: 2026-10-06 · [log/068](log/068.md)(범위 재설정 — 수도권 83곳 + 회원 모바일 웹, 덱 반영)

## 현재 상태

| 영역 | 상태 | 근거 |
|---|---|---|
| 도메인 9개 | 문서화·핵심 ADR 구현 완료. 도메인별 검증 범위는 각 도메인 문서 §11 | `domains/` |
| 데이터 | 전 도메인 Prisma(Supabase Postgres) — `MockDataService` 삭제 | [D36](decisions/D36.md) |
| api 호스팅 | **AWS Lambda(서울) 운영 중** — Worker origin을 Function URL(별칭 `live`)로 전환했다. 배포는 `dev` push 또는 Actions 수동 실행(OIDC). k6 실측 완료(2026-10-04): 로그인 p95 237ms, 실질 처리 한계 약 50 rps. Render는 아직 켜져 있다(롤백용, 트래픽 없음) | [D37](decisions/D37.md), [log/056](log/056.md) |
| admin-web·엣지 | Cloudflare Worker(정적 자산 + 프록시 + rate limit). `API_ORIGIN`·`ORIGIN_SECRET`은 Worker secret | [D25](decisions/D25.md), [D37](decisions/D37.md) |
| 저장소 | 주 개발·배포 브랜치 = `dev`(기본 브랜치), `main` = 완성본(완료 시 병합). 작업은 임시 브랜치 → `dev` PR → 병합 후 삭제. 2026-10-06 전환 완료(`dev`에서 배포 성공), 원격에는 `dev`·`main`만 남김 | [D39](decisions/D39.md), [log/067](log/067.md) |
| 산출물 | 요구사항 정의서·데이터 정의서(Excel), 기업 분석·제안서·아키텍처 설계서(Word) — `scripts/deliverables/`로 재생성 | [log/061](log/061.md), [log/062](log/062.md) |
| 범위 | **지점 수도권 83곳 + 회원 모바일 웹으로 재설정(2026-10-06)**. 덱만 반영됐고 **데이터(시드·배포 DB)는 아직 98곳**, 회원 웹은 미착수 | [D40](decisions/D40.md), [log/068](log/068.md) |
| 문서 구조 | 2026-10-01 재편 완료 — 로딩 계층·doc-check 도입 | [D38](decisions/D38.md) |

## 다음 할 일 (우선순위순)

0. **범위 재설정(D40) 반영 — 발표 시연 전에 덱(83곳)과 데이터를 맞춘다**
   1. 지점 축소: 시드 생성기에서 지방 15곳 제외, `branch-parity` 98 → 83, 관리자 웹 "98개" 문구. 배포 DB 삭제는 사용자 승인 후.
   2. 회원 모바일 웹(`apps/member-web` 예정): 로그인·프로그램/회차 조회·예약·취소·모의 결제·공지·혼잡도 조회.
   3. 요구사항추적표·산출물의 98곳·회원 앱 서술 정정.
1. **Lambda 전환(D37) 마무리**
   1. 사용자: Render `sports-erp-api` 일시정지(롤백이 더 필요 없다고 판단되면). 롤백 방법은 Worker `API_ORIGIN`만 Render 주소로 `--secrets-file` 재배포([CLI-RUNBOOK](../aws-lambda/CLI-RUNBOOK.md) 5번).
   2. k6 실측([log/056](log/056.md) 근거 표)을 D37에 어떻게 남길지 정한다 — D37 §4를 채울지, 새 결정 파일로 둘지(D38: 결정 파일은 고치지 않고 새 번호로).
   3. 사용자: AWS 배포 역할 신뢰 정책 `sub`에서 옛 값(`main-5x9td9`)을 빼 `dev`만 남긴다(D39). Render를 계속 둘 거면 연결 브랜치를 `dev`로 바꾼다(1번 일시정지면 불필요).
2. **Worker rate limit 429 실동작 확인** — [cloudflare-worker/README.md](../cloudflare-worker/README.md)의 curl 테스트([log/033](log/033.md)부터 미확인).
3. **트래픽·인프라 후보 이슈를 ADR로 승격** — [traffic-infra-review.md](architecture/traffic-infra-review.md)를 체크리스트로([log/039](log/039.md)).
4. **RFP 미구현 중 비용이 작은 것** — AuditLog 기록, 응답 마스킹, 공통 Toast([요구사항추적표](reference/요구사항추적표.md) §2-3·§3).
5. 폐기 자산 누적 대응(페이지네이션·아카이빙) — 화면 설계와 함께(traffic-infra-review 자원문서관리).
6. `src/mock-data/` 폴더 이름 정리(응답 타입·시드 원천만 남음).

## 사용자 승인 대기 (승인 전 착수 금지)

- **보조 스크립트 처리 — 미정.** 선택지 A(`set-lambda-env.sh` 경고를 중단으로) / B(Worker 전환·k6 실행·진단 스크립트를 `aws-lambda/`로) / C(두지 않음). 내용·비용은 [log/056](log/056.md) "미정" 표.
- 처리 여유 확대 여부: AWS 계정 동시 실행 한도 상향 요청(무료, 상한↑ = DB 커넥션↑·비용 차단 약화) / 요청당 쿼리 수 줄이기(코드) / 50 rps로 충분하다고 보고 기록만.
- DB 제약 보강(스키마 변경): `Document.relatedStaffId`·`uploadedBy` 외래키([D34](decisions/D34.md)), `Post.authorId`, `WorkLog(staffId, date)` unique([D33](decisions/D33.md)).
- 지점 격리 검사의 공통 가드 중앙화 — 전제조건(실DB 전환) 충족([요구사항추적표](reference/요구사항추적표.md) §3).
- Lambda용 DB 역할 `statement_timeout` 설정(DB 변경, D37).
- 회원 앱을 다시 넣을 경우: D37 결정 2(Workers 유료)·§5(DB 이전 조건)부터 재검토.

## 열린 위험

- **처리 한계가 설계 가정보다 작다**: 요청당 Lambda 처리 p50 약 110ms(가정 50ms) → 상한 10에서 실질 약 50~55 rps. S2(50 rps)가 경계에서 통과했고 S1 정점에서 거절 1건([log/056](log/056.md)). 원인은 추정만 했다.
- `ORIGIN_SECRET`·DB 비밀번호가 대화에 노출됐다(사용자가 교체 보류). Render 정지 후 DB 비밀번호를 바꾸면 영향 없이 교체된다 — 바꾸면 `.env` → `set-lambda-env.sh` → Actions 재배포.
- 배포 DB에 데모 계정 refreshToken 약 1.2만 행이 k6로 쌓였다(정리하지 않기로 함).
- AWS 클래식 계정은 유료 플랜이라 지출 한도가 없다. 예산 경보($1/$5/$20)·Lambda 경보(SNS 이메일, 2026-10-04 재구독)는 있고 대응은 수동이다. 경보 메일의 unsubscribe 링크를 누르면 구독이 지워진다.
- admin-web은 테스트가 없어 lint·빌드만 검증된다. 전환 후 화면은 로그인·데이터 조회만 확인했다.
