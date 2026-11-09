# STATUS — 지금 상태와 다음 할 일

> **세션 시작점.** 이 파일은 "지금"만 담고 세션을 마칠 때마다 **덮어쓴다**(80줄 상한, `scripts/doc-check.mjs`). 끝난 일은 지우고 경위는 [log/](log/README.md)로 보낸다.
> 마지막 갱신: 2026-11-09 · [log/213](log/213.md)(사용감 변경 전·후 캡처 비교), [log/212](log/212.md)(11주차 발표 덱 게시), [log/211](log/211.md)(충족률 분모에서 해당 없음 제외 — 94%, D76), [log/210](log/210.md)(추적표 D72~D75 재대조), [log/209](log/209.md)(Worker 재배포 확인, 발표 전 할 일 정리). 2026-11-08 세션(사용감·목록 일관화·문서 파일·시각화)은 [log/197](log/197.md)~[log/208](log/208.md) — 결정 D72~D75·권한관리 ADR-AUTH-09·자원문서관리 ADR-RES-05. 그 이전 경위는 [log/README](log/README.md) 인덱스에서 찾는다.

## 현재 상태

| 영역 | 상태 | 근거 |
|---|---|---|
| 방향 | **실운영은 하지 않는다**(2026-10-22, 사용자). 실운영이 있어야 끝나는 RFP 부분 3조항(PG 실제 호출 N7-3 · 업무위탁 계약서 N8-2 · 검수·도입 T3-2)과 순간 몰림 거절 원인 확인은 범위 밖. 키오스크 제외 | [D67](decisions/D67.md) |
| RFP | 72조항 중 구현+조정 58/62(**94%**) — 분모는 조항 수에서 해당 없음 10개를 뺀 값(D76, 2026-11-09 — 옛 방식 58/72 = 81%). 남은 미충족 4개 = 부분 N7-3(PG 테스트 키 호출) + 의도적 제외 T2-1·P2-2·P2-3. 영역별 기능·성능 100% · 시스템~제약 94% · 과업·산출물 81%. D72~D75 재대조 판정 변동 없음(log/210). 판정 원천은 [요구사항추적표](reference/요구사항추적표.md) §3 한 곳 — 요구사항 정의서·RFP 이행 증빙·제안서가 여기서 생성된다(생성기는 D76 반영, 파일은 재생성 때) | [D76](decisions/D76.md), [log/211](log/211.md) |
| 도메인 9개 | 문서화·핵심 ADR 구현 완료. 도메인별 검증 범위는 각 도메인 문서 §11 | `domains/` |
| 데이터 | 전 도메인 Prisma(Supabase Postgres, 36개 테이블, 배포 DB도 같음 — 문서 파일 칸 2026-11-08 적용, log/207) — `MockDataService` 삭제 | [D36](decisions/D36.md) |
| api 호스팅 | **AWS Lambda(서울) 운영 중**, Worker origin = Function URL(별칭 `live`). 배포는 `dev` push 또는 Actions 수동 실행(OIDC, 헬스체크 실패 시 이전 버전). 운영 실측 W 약 40ms, 과부하 실제 처리 약 80~90 rps(D50). 동시 실행 상한 10·1,024MB(D42), DB는 Session pooler 5432(D49). NestJS 11(D65) | [D37](decisions/D37.md), [D50](decisions/D50.md) |
| 웹·엣지 | Cloudflare Worker(정적 자산 + 프록시 + 로그인 rate limit). 관리자 웹은 직원 계정만(D66), 회원 기능은 `apps/member-web`(`/m/`, PWA — D41·D45). 마지막 Worker 재배포 2026-11-09(사용자 — 운영 확인 2026-11-09: 차트·문서 파일 올리기·열기·회원 빠른 찾기 정상, 사용자. `dev` 16b01cf까지: 회원 빠른 찾기 D72·화면 안 순서 D73·목록 일관화 D74·CSV 확대·문서 파일·운영 실적 차트 D75, log/209) | [D25](decisions/D25.md), [D66](decisions/D66.md) |
| 규칙의 자리 | 지점 격리 = 전역 `BranchScopeGuard`(D46), 세부 권한 = 전역 `PermissionGuard`(D60), 계약 종료 = 쓰기 트랜잭션 안 지점 행 공유 락(D70), 종료 전이 시 파견 종료(ADR-STF-07·08), 종료 확정은 해지 합의서 필요(D69). 계약 정보 = 계약 회차(`ContractRound`, D69). 변경 이력 20종(D44·D47·D52·ADR-STF-09·D60 권한·D68 지점 등록·계약 3종·D69 계약 파일 3종·D71 실물 이관·정리·ADR-RES-05 문서 열람), 혼잡도 = 진행 중 강습 예약 + 현장 입력(ADR-FAC-05) | [D46](decisions/D46.md), [D60](decisions/D60.md) |
| 검증 | API jest 59개 파일 631건(실DB, 2026-11-09 로컬 전체 실행 — 기준·고밀도 템플릿 둘 — D58), 화면 자동 테스트 24건(D59, CI만), 그 밖 화면은 lint·빌드와 시연 데이터 점검(log/125~130). 작업 단계 측정 20건(`npm run steps --workspace=e2e`, CI 아님 — log/198) | [D59](decisions/D59.md) |
| 시연 데이터 | 계약 상태별 5곳(서초·강남 정상, 마포 갱신 임박, 송파 만료, 노원 종료). `npm run seed:demo`가 실행일 기준 지난 90일·앞으로 3주를 얹는다(회원 211명 등). 배포 DB도 같은 데이터(2026-10-20 재시드, log/143) | [D58](decisions/D58.md) |
| 산출물 | 요구사항·데이터 정의서(Excel), 기업 분석·제안서·아키텍처 설계서·사용자 매뉴얼·진행 보고서 5부(Word), 교육 자료(PDF), RFP 이행 증빙(PDF) — **2026-10-23 기준이라 D68~D75 이후 화면·스키마·도움말이 반영되지 않았다**(발표 전 할 일 2), `scripts/deliverables/`로 재생성 | [log/176](log/176.md), [log/177](log/177.md) |
| 중간 제출 | 중간보고서 덱 55장(https://claude.ai/artifact/M2NBGeZcaBdTgkT1msjwQb, 생성기 `presentation/assets/4-7_중간발표/deck-source/viz/deck47.js`), RFP 이행 증빙(https://claude.ai/artifact/K1RjzzmZN4Er8tiKitEZ4e), 제출 폴더 조립 `node scripts/deliverables/pack-midterm.mjs` → `중간제출/`(저장소 밖) | [D67](decisions/D67.md), [log/178](log/178.md), [log/179](log/179.md) |
| 저장소 | `dev` = 주 개발·배포 브랜치, `main` = 완성본(완료 시 병합). 작업은 임시 브랜치 → `dev` PR → CI → rebase 병합 → 브랜치 삭제(`gh pr merge --delete-branch`). 배포 DB 마이그레이션은 워크플로가 돌리지 않는다 — 스키마 변경 PR은 **병합 전에** Supabase에 적용(승인) | [D39](decisions/D39.md) |
| 결정 방식 | 상위 목표 = 실무 노하우·도메인 지식 습득이 먼저, 포트폴리오 품질은 그다음. 결정마다 전역 가드레일 9절 — 시험 적용 중 | [D53](decisions/D53.md) |

## 다음 할 일 — 11주차 발표 준비 (발표 전에 이 순서로 끝낸다)

> 다음 세션의 목표는 **11주차 발표 자료**다. [4-0 공통지침](presentation/4-0_발표자료_공통지침.md)을 먼저 읽는다(덱 구성안·캡처 규칙·폴더). 덱·RFP 이행 증빙의 원천은 [요구사항추적표](reference/요구사항추적표.md) §3과 산출물이라, 추적표 재대조·분모 변경은 끝났다(log/210·211, D76 — 94%) — 덱 숫자는 지금 추적표로 쓴다. 발표에서는 "해당 없음 10개 제외"를 함께 밝힌다.

1. **11주차 발표 덱 확인**(사용자): 22장 게시(사용감은 변경 전·후 단계별 캡처 비교, log/213)(https://claude.ai/artifact/XVecKCuRR2Js23EYSAgDVk, 구성안 [4-8](presentation/4-8_11주차발표_슬라이드구성.md), log/212) — 게시 후 렌더(겹침·잘림)를 아직 눈으로 보지 않았다. 열어 보고 고칠 장을 알려 주면 생성기 `deck48.py`로 고친다. 발표 날짜가 정해지면 표지에 넣는다.
2. **산출물 재생성 — 발표 자료 작업과 같은 시드·캡처 단계에서**(사용자 결정 2026-11-09, 최종 제출 전 필수. 덱에 산출물 화면·표를 넣으면 그 산출물은 덱보다 먼저)(`scripts/deliverables/`): 데이터 정의서(Document 칸 `storagePath`·`fileName`·CHECK — log/206), 요구사항 정의서(추적표에서), 사용자 매뉴얼(도움말 문구·화면이 log/199~208에서 바뀜 — `capture-manual.mjs` 재캡처), RFP 이행 증빙(캡처 `capture-rfp.mjs`), 진행 보고서(log/197~208 반영), 아키텍처 설계서(새 API: 빠른 찾기는 기존 API, `/documents/upload-url`·`/:id/open`·`/branches/performance`). 교육 자료 PDF는 화면이 바뀐 곳만 확인.
3. **시연 데이터 — 결정됨**(사용자, 2026-11-09): 배포 DB는 재시드하지 않고 발표는 캡처로 한다. 캡처는 로컬 DB에 `npm run seed:demo`를 다시 얹은 뒤 찍는다(4-0 §5 — 실행일 기준 지난 90일).
4. **정리**(사용자): 원격 작업 브랜치 `claude/*` 9개(jolly-brahmagupta-bmaxnp·list-consistency·csv-export·list-search·list-sort·document-files·document-files-ops·visualization·status-before-presentation) 삭제 — 모두 `dev`에 병합됨(세션은 브랜치 삭제 불가).

**발표 뒤(선택, 착수 여부는 사용자)**: 시설·혼잡도 화면 1440px 폭에서 시설 카드 버튼(입력·정보 수정·운영 중단)이 세로로 찌그러짐(log/212 캡처 중 발견), 영업 리포트(차별화전략 §2 — D75 차트 부품 재사용), 회원 앱 형태 재검토(D67 ③·D40), 남은 스크롤 2곳(공지 등록 버튼 B09·회원 웹 예약 취소 M02, log/198), 처리 대기함 "처리할 업무지원 요청"(요청+처리중) 수와 업무지원 목록 본사 기본 필터("요청"만)가 달라 보임(배포 DB 요청 4·처리중 2 — 데이터 문제 아님, 2026-11-09 확인, 사용자 보류), "검증되지 않음" 테스트 보강(log/197 D-5 — 자산·업무지원 검색·정렬, 직원 상세 인사서류 열기, 900px 이하 폭).

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
- **화면 검증 범위**: 화면 자동 테스트는 역할별 핵심 경로 24건뿐 — 그 밖의 화면은 lint·빌드와 수동 점검까지. 계약 파일 보존 화면(D71)은 로컬 미리보기로만 확인.
- **로컬 Windows 개발 환경**: Docker Desktop이 지난 실행의 소켓 파일(`%LOCALAPPDATA%\Docker\run`)을 못 치워 엔진이 안 뜨는 일이 반복된다 — 사용자가 Docker Desktop을 다시 띄우면 풀렸다. `e2e/reset-db.mjs`·`serve.mjs`는 Windows 경로 버그로 `npm run e2e`가 로컬 Windows에서 실패한다(CI 무관, log/191 — 전용 DB 초기화를 손으로 하고 임시 설정으로 우회). `.env`에 `DIRECT_URL`이 없어 Prisma 명령은 두 URL을 직접 넘긴다.
