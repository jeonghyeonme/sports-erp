# 보안관리계획 — 인원·문서·장비·비밀값·개인정보 위탁

> RFP 보안요건(1-2 #8 "인원, 문서, 장비 등의 보안관리계획 수립")과 설치및운영(1-2 #2 "소프트웨어 개발보안 준수") 대응. 코드 수준 점검은 [secure-coding-checklist](secure-coding-checklist.md), 의존성 라이선스는 [dependency-licenses](dependency-licenses.md). 판정은 [요구사항추적표](../reference/요구사항추적표.md) §3-2, 경위는 log/139.
> **지금 있는 약점과 조치 계획을 숨기지 않고 §8에 적는다**(사용자 결정, 2026-10-19). 비밀값 자체는 어디에도 적지 않는다.

## 1. 범위와 전제

- 포트폴리오·졸업작품 프로젝트다. 실제 발주기관·수탁 계약이 없으므로 RFP의 "발주기관 승인·통지" 절차(Ⅸ장)는 사용자(프로젝트 소유자) 확인으로 대신한다.
- **운영 데이터는 모두 가상 인물이다.** 시드·시연 데이터(D58)는 픽스처로 만든 이름·`example` 도메인 이메일·가짜 전화번호뿐이고, 실제 이용자 개인정보를 받지 않는다. 회원 웹 가입은 열려 있으므로 누군가 실제 정보를 넣을 수는 있다 — 개인정보처리방침(`/m/privacy`)이 시연용임을 밝힌다(D51).
- 대상 시스템: api(AWS Lambda 서울), 관리자 웹·회원 웹과 엣지(Cloudflare Worker), DB·첨부 저장소(Supabase 서울), 소스·CI(GitHub, **공개 저장소**).

## 2. 인원

| 구분 | 누구 | 접근 범위 | 규칙 |
|---|---|---|---|
| 수행 인원 | 프로젝트 소유자 1명 | GitHub·AWS·Supabase·Cloudflare 소유 계정 전부 | 클라우드 콘솔 작업(비밀값 설정·경보·재배포)은 소유자만 한다 |
| AI 코딩 도구 | Claude Code 세션(로컬·클라우드) | 저장소 읽기·쓰기, 작업 브랜치 push, PR 생성·병합(CI 통과 후), 배포 URL 읽기 요청 | 루트 CLAUDE.md "사용자 승인이 필요한 결정"을 따른다 — **배포 DB 쓰기·스키마 변경·인증 방식 변경은 사용자 승인 뒤에만**. `aws-lambda/.env` 등 비밀값 파일을 읽지 않는다. 비밀값이 대화에 나오면 다시 적지 않고 교체를 권한다 |
| 시연 사용자(평가자) | 데모 계정(본사·지점 관리자·직원·회원) | 역할별 화면 | 데모 계정 비밀번호는 공개(저장소 `apps/api/src/fixtures/demo-password.ts`)다. 비밀번호 변경은 403(ADR-AUTH-05)이라 남이 바꿔 잠글 수는 없다 |

인원 변동(사람이 늘거나 빠짐)이 생기면 §5의 계정·비밀값을 먼저 회수·교체한다.

## 3. 문서

- **저장소에 비밀값을 넣지 않는다.** `.env`·`.env.*`는 `.gitignore` 대상이고 `.env.example`만 올린다. 배포 비밀값은 Lambda 환경변수·Worker secret·GitHub Actions secret에만 있다(§5). Function URL도 공개 Actions 로그에 찍히지 않게 secret으로 둔다(`deploy-api-lambda.yml`).
- 문서·로그(`docs/log/`)는 공개 저장소에 그대로 남는다. 계정 이메일은 데모 계정만, 비밀값·실 접속 문자열은 적지 않는다.
- 제출 산출물(`docs/deliverables/`)은 저장소에서 스크립트로 다시 만든다(`scripts/deliverables/`) — 손으로 고친 사본이 따로 돌지 않는다.
- RFP 원문 PDF(`docs/reference/제안요청서 원본.pdf`)가 공개 저장소에 있다. 실제 사업이면 Ⅸ.2(발주기관 승인 없는 외부 유출 금지)에 걸리는 자료다 — §8에 둔다.

## 4. 장비

| 장비 | 용도 | 관리 |
|---|---|---|
| 소유자 PC(Windows) | 로컬 개발, AWS CLI(`sports-erp` 프로필)·wrangler로 배포 설정 | `aws-lambda/.env`가 여기만 있다(저장소 밖). GitHub Desktop이 커밋 안 된 변경을 자동 stash할 수 있어 큰 작업 전후로 `git status` 확인(루트 CLAUDE.md). 디스크 암호화·화면 잠금은 OS 기본 설정에 맡긴다 |
| 클라우드 세션 컨테이너 | AI 세션 작업 공간 | 세션마다 새로 만들고 끝나면 회수된다. 배포 비밀값을 받지 않는다(첨부 저장소 확인은 배포 URL로만) |
| GitHub Actions 러너 | CI, Lambda 배포 | AWS 접근은 OIDC(장기 키 없음, D37). 저장된 secret은 `ORIGIN_SECRET`·`LAMBDA_FUNCTION_URL` |

## 5. 계정·비밀값

| 비밀값 | 보관 위치 | 없으면 | 교체 절차 |
|---|---|---|---|
| `JWT_ACCESS_SECRET`·`JWT_REFRESH_SECRET` | Lambda 환경변수 | 배포 환경 부팅 실패(`secretFromEnv`, D37 결정 5) | `aws-lambda/.env` → `set-lambda-env.sh` → Actions 재배포. 기존 로그인은 모두 무효(다시 로그인) |
| `ORIGIN_SECRET` | Lambda·Worker secret·GitHub secret **세 곳 같은 값** | 부팅 실패. Worker를 건너뛴 Function URL 직접 호출은 403 | 위와 같고 `npx wrangler secret put ORIGIN_SECRET`(cloudflare-worker 폴더)·GitHub secret도 함께 |
| `DATABASE_URL`(Supabase DB 비밀번호 포함) | Lambda 환경변수 | 부팅은 되지만 DB 요청 실패 | Supabase에서 비밀번호 재설정 → `.env` → `set-lambda-env.sh` → 재배포. Render가 정지돼 쓰는 곳은 Lambda뿐 |
| `SUPABASE_SERVICE_ROLE_KEY` | Lambda 환경변수만(브라우저·Worker 금지) | 첨부만 503 `STORAGE_NOT_CONFIGURED` | Supabase 키 재발급 → 같은 절차 |

- 비밀값은 무작위 32바이트 이상(`openssl rand -hex 32`, aws-lambda/README §1). `set-lambda-env.sh`는 JWT 비밀값이 비어 있으면 무작위로 만들고, DB 접속 문자열 형식(D49)을 검사한다.
- 클라우드 계정(GitHub·AWS·Supabase·Cloudflare)의 다단계 인증(MFA) 적용 여부는 문서로 확인한 적이 없다 — §8.
- AWS는 지출 한도가 없는 클래식 계정이라 예산 경보($1/$5/$20)와 Lambda 경보(SNS 이메일)로 감지하고 대응은 수동이다(STATUS 열린 위험).

## 6. 운영 중 보호 장치 (코드·설정)

자세한 근거는 [secure-coding-checklist](secure-coding-checklist.md). 요약만 둔다.

- **접근 통제**: 전역 JWT 인증(공개 경로는 `@Public`으로만), 역할 4개(`@Roles`), 지점 격리 전역 가드(D46)와 선언 누락 테스트(`branch-scope-coverage`), 공격 케이스 표(`branch-isolation`).
- **개인정보 노출 최소화**: 목록 전화번호 마스킹(ADR-MEM-04), 상세 열람 기록(D47), 열람 기록 보존 1년 수동 정리([data-retention](data-retention.md)).
- **엣지·용량**: Worker의 로그인·가입·연동 rate limit, Function URL 비밀 헤더(`x-origin-secret`), Lambda 동시 실행 상한 10과 503 `SERVER_BUSY`(D37·D42).
- **전송 구간**: 브라우저 ↔ Worker ↔ Lambda ↔ Supabase 모두 HTTPS/TLS(각 서비스 기본값). 첨부 파일은 비공개 버킷 + 짧은 서명 URL(D57).
- **변경 이력**: AuditLog 9종(D44·D47·D52·ADR-STF-09), 본사 "변경 이력" 화면.

## 7. 개인정보 처리 위탁 (개인정보보호법 제26조)

| 수탁자 | 위탁 업무 | 처리 위치 |
|---|---|---|
| Supabase | DB·첨부 파일 보관 | 서울(ap-northeast-2) |
| Amazon Web Services | api 실행(Lambda), 실행 로그 | 서울 |
| Cloudflare | 화면 배포·요청 중계 | 전 세계 엣지(요청 경유) |

- 위탁 사실과 수탁자는 개인정보처리방침 화면(`/m/privacy`)에 공개한다(D51).
- 제26조가 요구하는 위탁 계약 문서(각 서비스의 데이터 처리 부속서·약관) 보관과 수탁자 관리·감독 기록은 없다 — 실데이터가 없는 시연 운영이라 미뤘다(§8). 아래 7-1·7-2는 실데이터 운영 전에 그대로 따라 할 절차다(2026-10-22, log/165).

### 7-1. 위탁 문서 — 제26조 항목과 각 서비스 부속서(DPA)

제26조 제1항이 위탁 문서에 넣으라는 항목(2차 자료로 정리 — 이 세션은 국가법령정보센터에 접속하지 못해 **조문 원문과 대조 필요**): ① 위탁 업무 수행 목적 외 처리 금지 ② 기술적·관리적 보호조치 ③ 위탁 업무의 목적·범위 ④ 재위탁 제한 ⑤ 접근 제한 등 안전성 확보 조치 ⑥ 관리 현황 점검 등 감독 ⑦ 의무 위반 시 손해배상 등 책임. 클라우드 서비스는 개별 계약 대신 각 회사의 데이터 처리 부속서(DPA)가 이 문서 역할을 한다.

| 수탁자 | DPA를 맺는 방법 | 할 일 |
|---|---|---|
| Supabase | 대시보드 법률 문서 메뉴에서 요청 → 회사가 준비한 전자서명 문서에 서명([Supabase DPA](https://supabase.com/legal/dpa)) | 서명본을 내려받아 보관 |
| Amazon Web Services | 온라인 서비스 약관에 포함돼 개인정보를 처리하면 자동 적용([AWS 보안 블로그](https://aws.amazon.com/blogs/security/aws-gdpr-data-processing-addendum/)) | 적용 시점의 판(PDF) 보관 |
| Cloudflare | 셀프서브 가입 약관의 일부로 동의 시 적용([Cloudflare DPA](https://www.cloudflare.com/dpa/)) | 적용 판(PDF) 보관 |

DPA는 영문 GDPR 기준 문서라 위 ①~⑦과 1:1이 아니다 — 보관할 때 항목별로 해당 조항 번호를 적은 대조표를 함께 둔다. 결제를 실 PG로 바꾸면 PG사가 수탁자에 더해진다([pg-integration-check](pg-integration-check.md) §3).

### 7-2. 수탁자 관리·감독 (연 1회 + 변경 시)

1. 수탁자 목록·위탁 업무·처리 위치가 처리방침 화면(`/m/privacy`)과 같은지 본다.
2. 각 서비스의 DPA 새 판이 나왔는지, 하위 처리자(재위탁) 목록이 바뀌었는지 본다(각 DPA 페이지).
3. 처리 위치(서울 리전)가 그대로인지 Supabase·AWS 콘솔에서 본다.
4. 각 서비스의 보안 인증(SOC 2 등) 보고서 갱신 여부를 확인한다.
5. 결과를 진행 기록 한 건으로 남긴다(날짜·확인자·변경 사항) — 이 기록이 제26조의 감독 기록이다.

## 8. 지금 있는 약점과 조치 계획 (2026-10-19)

| # | 약점 | 영향 | 조치 | 담당·상태 |
|---|---|---|---|---|
| S1 | `ORIGIN_SECRET`·DB 비밀번호가 작업 대화에 노출됐다 | 대화 기록을 본 사람이 Worker를 건너뛰어 Lambda를 직접 부르거나 DB에 접속할 수 있다 | §5 절차로 둘 다 교체 | **수용(2026-10-22, 사용자)** — 실운영 계획이 없고 데이터가 시연용(S2와 같은 이유, log/168). 남는 위험: DB 비밀번호로 데이터 삭제·용량 채우기도 가능 — 훼손되면 재시드(log/143). 재고: 실데이터를 받거나 실제 운영할 때, 또는 이상 접속·비용 경보 시 즉시 §5 교체 |
| S2 | 데모 계정 비밀번호가 공개 저장소에 있고 본사(SUPER_ADMIN) 데모 계정도 있다 | 누구나 배포 시스템에 본사 권한으로 들어가 시연 데이터를 바꿀 수 있다(실데이터는 없음). 비밀번호 변경은 데모 5개만 403, 나머지 시드 36개는 바꿀 수 있다(log/168) | 검토안: 데모 비밀번호 교체(배포 DB 쓰기) 또는 api 읽기 전용 스위치 | **수용(2026-10-22, 사용자)** — 실서비스 운영 계획이 없고 데이터가 시연용이라 대응하지 않는다. 훼손되면 재시드(log/143)로 되돌린다. 재고: 실데이터를 받거나 실제 운영할 때 |
| S3 | ~~채용한 직원 계정의 첫 비밀번호가 데모 비밀번호와 같고 첫 로그인 때 변경을 강제하지 않는다~~ | — | 무작위 임시 비밀번호(응답에 한 번) + 첫 로그인 변경 전 업무 API 403(권한관리 ADR-AUTH-08). 새 비밀번호는 영문·숫자 8~72자(보안-9) | **해결(2026-10-22, 사용자 승인, log/164)** — 배포 DB 열 추가 후 배포 |
| S4 | 로그인 실패 잠금이 없다(범위 제외, 권한관리 A-8) | 비밀번호 추측 공격 | Worker rate limit이 1차 방어(같은 연결 12번째부터 429). 연결을 바꾸는 우회는 막지 못한다(log/079) | 수용 — 재론 시 계정별 제한 |
| S5 | 회원 웹 갱신 토큰을 localStorage에 둔다(D41) | XSS가 생기면 탈취 가능 | 공지 서식 HTML은 저장 전 허용 목록 정화 + 보일 때 DOMPurify 두 겹(D62 — D41 재고 트리거 검토, 쿠키 전환 대신) | 수용 — 허용 목록을 넓힐 때 D41 재검토 |
| S6 | 클라우드 계정 MFA 적용 여부를 확인한 적 없다 | 소유자 계정 탈취 시 전부 노출 | GitHub·AWS 루트·Supabase·Cloudflare MFA 확인·적용 | 소유자 — 확인 필요 |
| S7 | AWS 지출 한도가 없다 | 비용 폭주 시 자동 차단 없음 | 예산·Lambda 경보는 있음, 동시 실행 상한 10이 상한 역할 | 수용 — 대응 수동 |
| S8 | RFP 원문 PDF가 공개 저장소에 있다 | 실제 사업이면 발주 문서 무단 공개 | 과제 자료로서 공개해도 되는지 확인, 아니면 저장소에서 빼고 이력 정리 | 소유자 — 확인 필요 |
| S9 | 개인정보 위탁 계약 문서·수탁자 감독 기록이 없다(§7) | 실데이터를 받기 시작하면 제26조 미준수 | 실데이터 운영 전 각 서비스 DPA 보관·연 1회 점검 기록 — 절차는 §7-1·7-2(2026-10-22) | 실데이터 운영 시(사용자) |
| S10 | ~~운영 의존성에 알려진 취약점 4건(중간)이 남았다 — NestJS 10 SSE 주입, react-router 6 사용자 경로 이동~~ | — | 같은 메이저 고정·bcrypt 6으로 18 → 4건(D63), NestJS 11·react-router 7로 0건(D65) | **해결(2026-10-22, log/166)** |

**점검 주기**: 의존성을 바꿀 때 `node scripts/license-report.mjs --check`와 `npm audit --omit=dev`(D63)·`npm audit`(개발 도구, D64), 배포 구성을 바꿀 때 이 표와 [secure-coding-checklist](secure-coding-checklist.md)를 다시 본다. 비밀값이 어디서든 노출되면 즉시 §5 교체 절차.
