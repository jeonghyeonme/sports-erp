# STATUS — 지금 상태와 다음 할 일

> **세션 시작점.** 이 파일은 "지금"만 담고 세션을 마칠 때마다 **덮어쓴다**(80줄 상한, `scripts/doc-check.mjs`). 끝난 일은 지우고 경위는 [log/](log/README.md)로 보낸다.
> 마지막 갱신: 2026-10-05 · [log/056](log/056.md)(Lambda 첫 배포 성공 확인)

## 현재 상태

| 영역 | 상태 | 근거 |
|---|---|---|
| 도메인 9개 | 문서화·핵심 ADR 구현 완료. 도메인별 검증 범위는 각 도메인 문서 §11 | `domains/` |
| 데이터 | 전 도메인 Prisma(Supabase Postgres) — `MockDataService` 삭제 | [D36](decisions/D36.md) |
| api 호스팅 | **Render → AWS Lambda(서울) 전환 중.** 2026-10-04 Actions로 첫 배포 성공(헬스체크 200). DB 연결 확인·Worker 전환이 남았다. 운영은 여전히 Render | [D37](decisions/D37.md), [log/056](log/056.md) |
| admin-web·엣지 | Cloudflare Worker(정적 자산 + 프록시 + rate limit) | [D25](decisions/D25.md) |
| 회원 앱 | 개발 범위 제외(2026-09-30) | [D37](decisions/D37.md) |
| 문서 구조 | 2026-10-01 재편 완료 — 옛 번호 체계 설계서·결정 폴더 삭제, 로딩 계층·doc-check 도입 | [D38](decisions/D38.md) |

## 다음 할 일 (우선순위순)

1. **Lambda 전환(D37) 마무리** — 로컬 PC 세션에서 [CLI-RUNBOOK](../aws-lambda/CLI-RUNBOOK.md) 순서로. 리소스 생성·PR #14 병합·Actions 설정·첫 배포(run 5·6 성공)까지 끝났다([log/056](log/056.md)). 남은 순서:
   1. **DB를 거치는 요청으로 확인** — 헬스체크는 DB를 조회하지 않는다. `X-Origin-Secret`을 붙여 로그인 등 DB 경로를 호출해 Lambda → Supabase 풀러 연결과 함수 env(DB·JWT)를 확인한다. 헤더 없는 직접 호출이 403인지도 함께 본다.
   2. 5번 Worker 전환(`--secrets-file`로 origin을 함께 넣는다 — [cloudflare-worker/README.md](../cloudflare-worker/README.md)) → 7번 k6 → D37 §4 기록 → Render 일시정지.
   - **Function URL은 저장소·문서·대화에 남기지 않는다.** 비용 차단은 "알림만"(예산 경보 + SNS)이고 자동 차단 장치는 없다.
   - 사용자가 이미 진행한 단계가 있으면 이 목록을 갱신한다(저장소·Actions에서 보이는 것까지만 반영했다).
2. **Worker rate limit 429 실동작 확인** — [cloudflare-worker/README.md](../cloudflare-worker/README.md)의 curl 테스트([log/033](log/033.md)부터 미확인).
3. **트래픽·인프라 후보 이슈를 ADR로 승격** — [traffic-infra-review.md](architecture/traffic-infra-review.md)를 체크리스트로, 대안 비교 후 각 도메인 문서에 정식 ADR로([log/039](log/039.md)). 권한관리·인사정보관리·예약및결제도 같은 관점으로 스캔.
4. 폐기 자산 누적 대응(페이지네이션·아카이빙) — 화면 설계와 함께(traffic-infra-review 자원문서관리).
5. `src/mock-data/` 폴더 이름 정리(응답 타입·시드 원천만 남음).

## 사용자 승인 대기 (승인 전 착수 금지)

- DB 제약 보강(스키마 변경): `Document.relatedStaffId`·`uploadedBy` 외래키([D34](decisions/D34.md) — 지금은 앱 검증), `Post.authorId`, `WorkLog(staffId, date)` unique([D33](decisions/D33.md) — 지금은 advisory lock).
- 지점 격리 검사의 공통 가드 중앙화 — 전제조건(실DB 전환) 충족([요구사항추적표](reference/요구사항추적표.md) §3 6번).
- Lambda용 DB 역할 `statement_timeout` 설정(DB 변경, D37).
- 회원 앱을 다시 넣을 경우: D37 결정 2(Workers 유료)·§5(DB 이전 조건)부터 재검토.

## 열린 위험

- 실제 AWS 위의 Lambda는 헬스체크(DB 미경유)만 확인했다. 풀러 연결·동시성 상한·스로틀 응답 형식은 **검증되지 않음**([log/052](log/052.md), [log/056](log/056.md)).
- admin-web은 테스트가 없어 lint·빌드만 검증된다.
- AWS 클래식 계정은 유료 플랜이라 지출 한도가 없다 — 공개 Function URL로 들어오는 대량 요청이 비용 위험이다. 예산 경보($1/$5/$20)·Lambda 경보는 걸었고 대응은 수동이다([log/055](log/055.md)).