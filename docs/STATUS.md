# STATUS — 지금 상태와 다음 할 일

> **세션 시작점.** 이 파일은 "지금"만 담고 세션을 마칠 때마다 **덮어쓴다**(80줄 상한, `scripts/doc-check.mjs`). 끝난 일은 지우고 경위는 [log/](log/README.md)로 보낸다.
> 마지막 갱신: 2026-11-08 · [log/200](log/200.md)(회원 빠른 찾기·상세 PT 탭 먼저 D72 — PT 세션 차감 6→3), [log/199](log/199.md)(기본값 채우기 — PT 구매일·누락일 출근, 회원 찾기 대안), [log/198](log/198.md)(작업 단계 측정 기준선 20건·측정 도구), [log/197](log/197.md)(사용감 전수조사 목록·추적표 D68~D71 재대조), [log/196](log/196.md)(D70·D71 운영 반영 — 배포 DB D71·Worker 재배포), [log/195](log/195.md)(계약 파일 보존·실물 이관·정리 D71), [log/194](log/194.md)(동시성 빈틈 세 곳 수정 D70), [log/193](log/193.md)(D69 운영 확인 — 계약서 업로드·열람 기록, Throttles 알람), [log/192](log/192.md)(D69 1차 운영 반영 — 배포 DB·병합·Worker), [log/191](log/191.md)(계약 회차·계약서 D69 1차 — OCR·AI 기각), [log/190](log/190.md)(Worker 재배포 — D68 화면 운영 반영), [log/189](log/189.md)(신규 테이블 3개 RLS 켜기 — Supabase 경고), [log/188](log/188.md)(매뉴얼 재생성·CI e2e 러너 고정), [log/187](log/187.md)(신규 지점 등록, D68 2차), [log/186](log/186.md)(계약 갱신·정정·이력·임박 표시 구현, D68 1차), [log/185](log/185.md)(계약 갱신 기능 계획 D68), [log/184](log/184.md)(pack-midterm Windows 경로 수정), [log/183](log/183.md)(산출물 폴더를 RFP 산출물 표 기준으로), [log/182](log/182.md)(충족률 분모 = 조항 수 전부, 81%), [log/181](log/181.md)(증빙 결정 기록 제목 쉬운 말), [log/180](log/180.md)(STATUS 정리 — 실운영 안 함 반영), [log/179](log/179.md)(중간 제출 폴더 조립), [log/178](log/178.md)(중간보고서 덱 55장), [log/177](log/177.md)(RFP 이행 증빙). 그 이전 경위는 [log/README](log/README.md) 인덱스에서 찾는다.

## 현재 상태

| 영역 | 상태 | 근거 |
|---|---|---|
| 방향 | **실운영은 하지 않는다**(2026-10-22, 사용자). 실운영이 있어야 끝나는 RFP 부분 3조항(PG 실제 호출 N7-3 · 업무위탁 계약서 N8-2 · 검수·도입 T3-2)과 순간 몰림 거절 원인 확인은 범위 밖. 키오스크 제외 | [D67](decisions/D67.md) |
| RFP | 72조항 중 완료+조정 58/72(81%) — 분모는 조항 수 전부(해당 없음·제외도 남김, log/182). D68~D71 재대조 결과 판정 변동 없음(2026-11-08, log/197). 영역별 기능·성능 97% · 시스템~제약 68% · 과업·산출물 72%. 판정 원천은 [요구사항추적표](reference/요구사항추적표.md) §3 한 곳 — 요구사항 정의서·RFP 이행 증빙·중간보고서 덱이 여기서 생성된다 | [log/160](log/160.md), [log/182](log/182.md) |
| 도메인 9개 | 문서화·핵심 ADR 구현 완료. 도메인별 검증 범위는 각 도메인 문서 §11 | `domains/` |
| 데이터 | 전 도메인 Prisma(Supabase Postgres, 36개 테이블, 배포 DB도 같음 — D71 2026-11-02 적용) — `MockDataService` 삭제 | [D36](decisions/D36.md) |
| api 호스팅 | **AWS Lambda(서울) 운영 중**, Worker origin = Function URL(별칭 `live`). 배포는 `dev` push 또는 Actions 수동 실행(OIDC, 헬스체크 실패 시 이전 버전). 운영 실측 W 약 40ms, 과부하 실제 처리 약 80~90 rps(D50). 동시 실행 상한 10·1,024MB(D42), DB는 Session pooler 5432(D49). NestJS 11(D65) | [D37](decisions/D37.md), [D50](decisions/D50.md) |
| 웹·엣지 | Cloudflare Worker(정적 자산 + 프록시 + 로그인 rate limit). 관리자 웹은 직원 계정만(D66), 회원 기능은 `apps/member-web`(`/m/`, PWA — D41·D45). 마지막 Worker 재배포 2026-11-02(D70 계약 회차 번호 전송·D71 계약 파일 보존 화면 포함, log/196) | [D25](decisions/D25.md), [D66](decisions/D66.md) |
| 규칙의 자리 | 지점 격리 = 전역 `BranchScopeGuard`(D46), 세부 권한 = 전역 `PermissionGuard`(D60), 계약 종료 = 쓰기 트랜잭션 안 지점 행 공유 락(D70), 종료 전이 시 파견 종료(ADR-STF-07·08), 종료 확정은 해지 합의서 필요(D69). 계약 정보 = 계약 회차(`ContractRound`, D69). 변경 이력 19종(D44·D47·D52·ADR-STF-09·D60 권한·D68 지점 등록·계약 3종·D69 계약 파일 3종·D71 실물 이관·정리), 혼잡도 = 진행 중 강습 예약 + 현장 입력(ADR-FAC-05) | [D46](decisions/D46.md), [D60](decisions/D60.md) |
| 검증 | API jest 56개 파일 609건(실DB, 기준·고밀도 템플릿 둘 — D58), 화면 자동 테스트 17건(D59, CI만), 그 밖 화면은 lint·빌드와 시연 데이터 점검(log/125~130). 작업 단계 측정 20건(`npm run steps --workspace=e2e`, CI 아님 — log/198) | [D59](decisions/D59.md) |
| 시연 데이터 | 계약 상태별 5곳(서초·강남 정상, 마포 갱신 임박, 송파 만료, 노원 종료). `npm run seed:demo`가 실행일 기준 지난 90일·앞으로 3주를 얹는다(회원 211명 등). 배포 DB도 같은 데이터(2026-10-20 재시드, log/143) | [D58](decisions/D58.md) |
| 산출물 | 요구사항·데이터 정의서(Excel), 기업 분석·제안서·아키텍처 설계서·사용자 매뉴얼·진행 보고서 5부(Word), 교육 자료(PDF), RFP 이행 증빙(PDF) — 2026-10-23 기준(충족률 문장만 10-25 재생성, log/182), `scripts/deliverables/`로 재생성 | [log/176](log/176.md), [log/177](log/177.md) |
| 중간 제출 | 중간보고서 덱 55장(https://claude.ai/artifact/M2NBGeZcaBdTgkT1msjwQb, 생성기 `presentation/assets/4-7_중간발표/deck-source/viz/deck47.js`), RFP 이행 증빙(https://claude.ai/artifact/K1RjzzmZN4Er8tiKitEZ4e), 제출 폴더 조립 `node scripts/deliverables/pack-midterm.mjs` → `중간제출/`(저장소 밖) | [D67](decisions/D67.md), [log/178](log/178.md), [log/179](log/179.md) |
| 저장소 | `dev` = 주 개발·배포 브랜치, `main` = 완성본(완료 시 병합). 작업은 임시 브랜치 → `dev` PR → CI → rebase 병합 → 브랜치 삭제(`gh pr merge --delete-branch`). 배포 DB 마이그레이션은 워크플로가 돌리지 않는다 — 스키마 변경 PR은 **병합 전에** Supabase에 적용(승인) | [D39](decisions/D39.md) |
| 결정 방식 | 상위 목표 = 실무 노하우·도메인 지식 습득이 먼저, 포트폴리오 품질은 그다음. 결정마다 전역 가드레일 9절 — 시험 적용 중 | [D53](decisions/D53.md) |

## 다음 할 일 (우선순위순 — 전수조사 목록 A~E는 [log/197](log/197.md))

1. **작업 단계 줄이기 ③ — 첫 화면 밖 폼**(기준선 [log/198](log/198.md)): 회차 등록 폼(예약 관리 맨 아래, 스크롤 2~3), 직원 근태관리의 휴가 신청·업무일지(S02·S03), 휴가 승인함(B06). ①은 D72(log/200), ②는 log/199로 끝. 고친 뒤 `npm run steps --workspace=e2e`로 전후.
2. **목록 일관화 결정과 적용(A-1~A-4, B-1·B-3, 관리자 웹 모달 `role="dialog"` 없음)** — 쪽 나누기·검색·정렬·CSV를 한 방식으로 정하는 횡단 결정(새 D번호)을 먼저, 확인 모달·빈 상태 패턴도 함께. 그다음 화면별 적용(쌓이는 문서 목록부터).
3. **D69 2차 — 문서 실제 파일 업로드**(2번의 문서 목록과 같은 시점에): 사용자 결정 — 기존 가짜 주소 문서는 그대로, 열 때 열람 기록, 보존기한 지나면 알림만. 형식·한도 D57, 올리는 사람은 지금 문서 등록 권한(제안 — 착수 때 확인). 스키마 변경이면 승인.
4. **시각화(A-5)** — 기간 집계 API가 필요해 가장 크다. 차별화전략 §2 영업 리포트와 묶을지 결정.
5. **회원 앱 형태 재검토(D67 ③, D40)** — 착수 순서는 사용자.
6. **최종 발표 자료(사용자 착수 예정)** — [4-0 공통지침](presentation/4-0_발표자료_공통지침.md) 먼저. 중간 이후 바뀐 것: D68~D71. 충족률은 추적표 §3(재대조 끝, 81%).
7. 작은 것: "검증되지 않음" 테스트(log/197 D-5), `audit.ts` 주석의 D71 누락(다음 api 작업 때), 요구사항 정의서 재생성(산출물 재생성 때).

## 사용자 승인 대기 (승인 전 착수 금지)

- 지금은 없다.

## 열린 위험 (실운영을 하지 않아 대응은 보류 — 실운영을 다시 검토하면 여기서 시작)

- **순간 몰림 거절**: 로그인 몰림 1,866건 중 38건, 50 rps 조회 47건 거절(D50) — 원인 미확인(1초보다 짧은 몰림인지 호출당 부가 시간인지). 2026-11-01 배포 직후 화면 확인 중 Throttles 4건(콜드 스타트 추정, log/193). 세션 모드에선 실행 환경 수 ≈ DB 연결 수라 상한을 올리려면 Pool Size(지금 15)부터.
- **무료 한도**: 방문당 호출이 가정(10회)을 넘으면(실측 3~11회) Workers 하루 10만 건에 닿는다 — 일일 요청 9만이면 유료 검토(D40). DB 500MB는 예약·결제 이력만으로 1~1.5년(design-constants ⑮, 가정).
- **Worker 로그인 rate limit은 연결을 재사용할 때만 걸린다**(log/079) — 2차 방어는 Lambda 상한 10 + 503.
- **비밀값 노출 수용**: `ORIGIN_SECRET`·DB 비밀번호가 대화에 노출된 채(security-plan S1, log/168). 이상 접속·비용 경보가 오면 즉시 교체: `.env` → `set-lambda-env.sh` → Actions 재배포, Worker는 `wrangler secret put ORIGIN_SECRET`.
- **새 테이블 RLS는 손으로**: 배포 DB의 RLS(정책 없이 켜서 PostgREST 차단)는 저장소 밖에만 있다. 테이블을 만드는 Prisma 마이그레이션을 배포하면 Supabase에서 `ENABLE ROW LEVEL SECURITY`를 따로 해야 한다 — 빠뜨린 3개를 log/189에서 켬.
- **AWS 지출 한도 없음**: 예산 경보($1/$5/$20)·Lambda 경보(오류·지연·메모리 85%, SNS 이메일)는 있고 대응은 수동. 경보 메일의 unsubscribe 링크를 누르면 구독이 지워진다.
- **열람 기록 누적**: 자동 삭제가 없어 2027-10-10부터 연 1회 [data-retention](architecture/data-retention.md) 절차로 수동 삭제(배포 DB 쓰기, 승인).
- **회원 웹 refresh token이 localStorage**(D41) — 공지 서식 HTML(D62)은 허용 목록 정화 두 겹. 허용 목록을 넓히면 쿠키 전환을 함께 검토. 빌드 순서(admin → member)를 어기면 `dist/m`이 지워진 채 배포된다(`npm run build:web` 사용).
- **화면 검증 범위**: 화면 자동 테스트는 역할별 핵심 경로 17건뿐 — 그 밖의 화면은 lint·빌드와 수동 점검까지. 계약 파일 보존 화면(D71)은 로컬 미리보기로만 확인.
- **로컬 Windows 개발 환경**: Docker Desktop이 지난 실행의 소켓 파일(`%LOCALAPPDATA%\Docker\run`)을 못 치워 엔진이 안 뜨는 일이 반복된다 — 사용자가 Docker Desktop을 다시 띄우면 풀렸다. `e2e/reset-db.mjs`·`serve.mjs`는 Windows 경로 버그로 `npm run e2e`가 로컬 Windows에서 실패한다(CI 무관, log/191 — 전용 DB 초기화를 손으로 하고 임시 설정으로 우회). `.env`에 `DIRECT_URL`이 없어 Prisma 명령은 두 URL을 직접 넘긴다.
