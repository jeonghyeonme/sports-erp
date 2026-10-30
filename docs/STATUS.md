# STATUS — 지금 상태와 다음 할 일

> **세션 시작점.** 이 파일은 "지금"만 담고 세션을 마칠 때마다 **덮어쓴다**(80줄 상한, `scripts/doc-check.mjs`). 끝난 일은 지우고 경위는 [log/](log/README.md)로 보낸다.
> 마지막 갱신: 2026-10-30 · [log/186](log/186.md)(계약 갱신·정정·이력·임박 표시 구현, D68 1차), [log/185](log/185.md)(계약 갱신 기능 계획 D68), [log/184](log/184.md)(pack-midterm Windows 경로 수정), [log/183](log/183.md)(산출물 폴더를 RFP 산출물 표 기준으로), [log/182](log/182.md)(충족률 분모 = 조항 수 전부, 81%), [log/181](log/181.md)(증빙 결정 기록 제목 쉬운 말), [log/180](log/180.md)(STATUS 정리 — 실운영 안 함 반영), [log/179](log/179.md)(중간 제출 폴더 조립), [log/178](log/178.md)(중간보고서 덱 55장), [log/177](log/177.md)(RFP 이행 증빙), [log/176](log/176.md)(산출물 전부 재생성), [log/175](log/175.md)(중간 제출 구성 D67). 그 이전 경위는 [log/README](log/README.md) 인덱스에서 찾는다.

## 현재 상태

| 영역 | 상태 | 근거 |
|---|---|---|
| 방향 | **실운영은 하지 않는다**(2026-10-22, 사용자). 실운영이 있어야 끝나는 RFP 부분 3조항(PG 실제 호출 N7-3 · 업무위탁 계약서 N8-2 · 검수·도입 T3-2)과 순간 몰림 거절 원인 확인은 범위 밖. 키오스크 제외 | [D67](decisions/D67.md) |
| RFP | 72조항 중 완료+조정 58/72(81%) — 분모는 조항 수 전부(해당 없음·제외도 남김, log/182). 영역별 기능·성능 97% · 시스템~제약 68% · 과업·산출물 72%. 판정 원천은 [요구사항추적표](reference/요구사항추적표.md) §3 한 곳 — 요구사항 정의서·RFP 이행 증빙·중간보고서 덱이 여기서 생성된다 | [log/160](log/160.md), [log/182](log/182.md) |
| 도메인 9개 | 문서화·핵심 ADR 구현 완료. 도메인별 검증 범위는 각 도메인 문서 §11 | `domains/` |
| 데이터 | 전 도메인 Prisma(Supabase Postgres, 34개 테이블) — `MockDataService` 삭제 | [D36](decisions/D36.md) |
| api 호스팅 | **AWS Lambda(서울) 운영 중**, Worker origin = Function URL(별칭 `live`). 배포는 `dev` push 또는 Actions 수동 실행(OIDC, 헬스체크 실패 시 이전 버전). 운영 실측 W 약 40ms, 과부하 실제 처리 약 80~90 rps(D50). 동시 실행 상한 10·1,024MB(D42), DB는 Session pooler 5432(D49). NestJS 11(D65) | [D37](decisions/D37.md), [D50](decisions/D50.md) |
| 웹·엣지 | Cloudflare Worker(정적 자산 + 프록시 + 로그인 rate limit). 관리자 웹은 직원 계정만(D66), 회원 기능은 `apps/member-web`(`/m/`, PWA — D41·D45). 마지막 Worker 재배포 2026-10-22(log/174) | [D25](decisions/D25.md), [D66](decisions/D66.md) |
| 규칙의 자리 | 지점 격리 = 전역 `BranchScopeGuard`(D46), 세부 권한 = 전역 `PermissionGuard`(D60), 계약 종료 = `BranchService.loadGate()`, 종료 전이 시 파견 종료(ADR-STF-07·08). 변경 이력 12종(D44·D47·D52·ADR-STF-09·D68 계약 3종), 혼잡도 = 진행 중 강습 예약 + 현장 입력(ADR-FAC-05) | [D46](decisions/D46.md), [D60](decisions/D60.md) |
| 검증 | API jest 54개 파일 571건(실DB, 기준·고밀도 템플릿 둘 — D58), 화면 자동 테스트 15건(D59, CI만), 그 밖 화면은 lint·빌드와 시연 데이터 점검(log/125~130) | [D59](decisions/D59.md) |
| 시연 데이터 | 계약 상태별 5곳(서초·강남 정상, 마포 갱신 임박, 송파 만료, 노원 종료). `npm run seed:demo`가 실행일 기준 지난 90일·앞으로 3주를 얹는다(회원 211명 등). 배포 DB도 같은 데이터(2026-10-20 재시드, log/143) | [D58](decisions/D58.md) |
| 산출물 | 요구사항·데이터 정의서(Excel), 기업 분석·제안서·아키텍처 설계서·사용자 매뉴얼·진행 보고서 5부(Word), 교육 자료(PDF), RFP 이행 증빙(PDF) — 2026-10-23 기준(충족률 문장만 10-25 재생성, log/182), `scripts/deliverables/`로 재생성 | [log/176](log/176.md), [log/177](log/177.md) |
| 중간 제출 | 중간보고서 덱 55장(https://claude.ai/artifact/M2NBGeZcaBdTgkT1msjwQb, 생성기 `presentation/assets/4-7_중간발표/deck-source/viz/deck47.js`), RFP 이행 증빙(https://claude.ai/artifact/K1RjzzmZN4Er8tiKitEZ4e), 제출 폴더 조립 `node scripts/deliverables/pack-midterm.mjs` → `중간제출/`(저장소 밖) | [D67](decisions/D67.md), [log/178](log/178.md), [log/179](log/179.md) |
| 저장소 | `dev` = 주 개발·배포 브랜치, `main` = 완성본(완료 시 병합). 작업은 임시 브랜치 → `dev` PR → CI → rebase 병합 → 브랜치 삭제(원격 삭제는 세션에서 403 — 사용자) | [D39](decisions/D39.md) |
| 결정 방식 | 상위 목표 = 실무 노하우·도메인 지식 습득이 먼저, 포트폴리오 품질은 그다음. 결정마다 전역 가드레일 9절 — 시험 적용 중 | [D53](decisions/D53.md) |

## 다음 할 일 (우선순위순)

1. **신규 지점 등록(D68 2차, 착수는 사용자)** — 새 위탁계약 = 새 지점. 이름·지점 코드(유일, 중복 409)·지역·주소·전화·출근 기준 시각 + 계약 상대방·시작일·종료일, 대시보드에 [지점 등록]. 1차(갱신·정정·이력·임박 표시)는 끝났다(log/186). 지점 코드는 회원번호·직원코드 채번에 쓰이므로 `CodeSequence` 시작값을 함께 본다.
2. **다음 계획 세 갈래(D67, 계획 수준 — 착수 순서는 사용자)** — ① 사용감 확보: 목록 쪽 나누기·검색·정렬을 화면마다 같은 방식으로, 대시보드·운영 실적 시각화, 자주 하는 작업의 단계 줄이기 ② 계약서 OCR·AI 분석 적용 검토(차별화전략 §1-1, 관리자 확인 후 반영 — D68의 수기 입력 API가 토대) ③ 회원 앱 형태 재검토(휴대폰 웹 · 하이브리드 · 네이티브, D40 재검토).
3. 사용자(선택): log/186 화면을 운영에 올리려면 `dev` 병합 후 Lambda는 자동, Worker는 `npm run build:web` → `cd cloudflare-worker && npx wrangler deploy`. 사용자 매뉴얼(산출물)은 화면 도움말이 바뀐 만큼 재생성 대상(`scripts/deliverables/`).

## 사용자 승인 대기 (승인 전 착수 금지)

- 지금은 없다.

## 열린 위험 (실운영을 하지 않아 대응은 보류 — 실운영을 다시 검토하면 여기서 시작)

- **순간 몰림 거절**: 로그인 몰림 1,866건 중 38건, 50 rps 조회 47건 거절(D50) — 원인 미확인(1초보다 짧은 몰림인지 호출당 부가 시간인지). 세션 모드에선 실행 환경 수 ≈ DB 연결 수라 상한을 올리려면 Pool Size(지금 15)부터.
- **무료 한도**: 방문당 호출이 가정(10회)을 넘으면(실측 3~11회) Workers 하루 10만 건에 닿는다 — 일일 요청 9만이면 유료 검토(D40). DB 500MB는 예약·결제 이력만으로 1~1.5년(design-constants ⑮, 가정).
- **Worker 로그인 rate limit은 연결을 재사용할 때만 걸린다**(log/079) — 2차 방어는 Lambda 상한 10 + 503.
- **비밀값 노출 수용**: `ORIGIN_SECRET`·DB 비밀번호가 대화에 노출된 채(security-plan S1, log/168). 이상 접속·비용 경보가 오면 즉시 교체: `.env` → `set-lambda-env.sh` → Actions 재배포, Worker는 `wrangler secret put ORIGIN_SECRET`.
- **AWS 지출 한도 없음**: 예산 경보($1/$5/$20)·Lambda 경보(오류·지연·메모리 85%, SNS 이메일)는 있고 대응은 수동. 경보 메일의 unsubscribe 링크를 누르면 구독이 지워진다.
- **열람 기록 누적**: 자동 삭제가 없어 2027-10-10부터 연 1회 [data-retention](architecture/data-retention.md) 절차로 수동 삭제(배포 DB 쓰기, 승인).
- **회원 웹 refresh token이 localStorage**(D41) — 공지 서식 HTML(D62)은 허용 목록 정화 두 겹. 허용 목록을 넓히면 쿠키 전환을 함께 검토. 빌드 순서(admin → member)를 어기면 `dist/m`이 지워진 채 배포된다(`npm run build:web` 사용).
- **화면 검증 범위**: 화면 자동 테스트는 역할별 핵심 경로 14건뿐 — 그 밖의 화면은 lint·빌드와 수동 점검까지.
