# api → AWS Lambda(서울) 전환 체크리스트

근거: docs/decisions/D37.md. 요약하면 다음과 같다.
- API는 Lambda(ap-northeast-2, Function URL)에서 돈다.
- DB는 Supabase(서울) 그대로다.
- 앞단은 기존 Cloudflare Worker(UI + `/api/*` 프록시 + 로그인 rate limit)다.
- 동시 실행 상한 10을 넘는 요청은 입구에서 바로 거절한다(Lambda 429 → Worker 503 `SERVER_BUSY`).

**CLI로 진행하려면 [CLI-RUNBOOK.md](CLI-RUNBOOK.md)** — 사용자 PC에서 `aws login`한 로컬 Claude Code가 아래 0~6번을 명령으로 실행한다(2026-10-02, 클라우드 세션은 자격 증명 취득이 권한 정책으로 막혀 이 경로를 택함).

**이 세션(Claude)에서는 AWS·Cloudflare에 접속할 수 없다.** 아래 AWS 콘솔·Cloudflare·GitHub 설정은 직접 해야 한다. 코드 쪽(핸들러·패키징·배포 워크플로·Worker 변경)은 저장소에 이미 있다.

**순서**: 0 확인 → 1 비밀값 → 2 함수(빈 껍데기) → 3 Function URL·상한 → 4 OIDC·첫 배포(여기서 코드가 처음 올라간다) → 5 Worker 전환 → 6 워밍·관측·비용 → 7 검증 → 8 정리. 로컬에서 zip을 만들어 올리지 않는다. 첫 업로드부터 GitHub Actions에 맡긴다(2번 참고).

| 구성 요소 | 위치 |
|---|---|
| Lambda 핸들러 | `apps/api/src/lambda.ts` → `dist/lambda.handler` |
| 전역 설정 공용 함수 | `apps/api/src/app.setup.ts`(`configureApp`) |
| 배포 묶음 만들기 | `bash apps/api/scripts/package-lambda.sh` → `apps/api/.lambda/lambda.zip`(워크플로가 실행 — 로컬은 확인용) |
| 자동 배포 | `.github/workflows/deploy-api-lambda.yml`(`dev` push 시) |
| Worker 변경 | `cloudflare-worker/src/index.ts`(비밀 헤더, 429 → 503) |
| 부하 검증 | `loadtest/k6-lambda.js`(D37 §4 S1~S3) |

---

## 0. 먼저 확인

- [ ] **리전은 아시아 태평양(서울) `ap-northeast-2`.** Supabase와 같은 리전이다. 다른 리전이면 쿼리마다 왕복 지연이 쌓인다(D37 컨텍스트).
- [ ] **Service Quotas → AWS Lambda → Concurrent executions** 값을 확인한다.
  - 10이면 그 값이 곧 상한이다. 3번의 reserved concurrency는 건너뛴다.
  - 1,000 이상이면 3번에서 reserved concurrency 10을 건다.

## 1. 비밀값 준비

| 이름 | 값 | 쓰는 곳 |
|---|---|---|
| `ORIGIN_SECRET` | 무작위 32바이트 이상(`openssl rand -hex 32`) | Lambda 환경변수, Worker secret, GitHub secret — **세 곳 모두 같은 값** |
| `JWT_ACCESS_SECRET` | 무작위 32바이트 이상 | Lambda 환경변수 |
| `JWT_REFRESH_SECRET` | 무작위 32바이트 이상, access와 다른 값 | Lambda 환경변수 |
| `DATABASE_URL` | Supabase 대시보드 → Connect → **Transaction pooler**(포트 6543) 문자열 끝에 `?pgbouncer=true&connection_limit=1&pool_timeout=5` | Lambda 환경변수 |

- JWT 비밀값을 새로 만들면 기존 로그인 토큰은 무효가 된다. 데모 사용자는 다시 로그인하면 된다.
- `DIRECT_URL`은 마이그레이션 전용이라 Lambda에는 필요 없다.

## 2. Lambda 함수 만들기(빈 껍데기)

**코드는 여기서 올리지 않는다.** 첫 업로드부터 4번의 GitHub Actions가 한다.
- 워크플로는 운영 의존성을 Lambda 공식 이미지(Amazon Linux 2023) 안에서 설치한다.
- 로컬(특히 macOS)에서 만든 zip은 `bcrypt` 네이티브 바이너리가 Lambda와 맞지 않을 수 있다.
- 여기서는 설정만 갖춘 함수를 만든다.

**함수 생성**: 콘솔 → Lambda → 함수 생성 → "새로 작성". 기본 예제 코드 그대로 만든다.
- [ ] 이름 `sports-erp-api`, 런타임 **Node.js 22.x**, 아키텍처 **x86_64**
  - Prisma 엔진이 `rhel-openssl-3.0.x`(x86_64)만 들어 있다(D27). arm64는 안 된다.
- [ ] 실행 역할: "기본 Lambda 권한으로 새 역할 생성"(CloudWatch Logs 쓰기만)

**구성**:
- [ ] 런타임 설정 → 핸들러 `dist/lambda.handler`
  - 지금 들어 있는 예제 코드와는 맞지 않아 호출하면 실패한다. 4번에서 실제 코드가 올라가면 맞는다.
- [ ] 일반 구성 → 메모리 **1024MB**, 제한 시간 **10초**
- [ ] 환경 변수: `NODE_ENV=production`, 그리고 1번의 `DATABASE_URL`·`JWT_ACCESS_SECRET`·`JWT_REFRESH_SECRET`·`ORIGIN_SECRET`
  - 하나라도 빠지면 init에서 바로 실패한다(의도된 동작, D37 결정 5). 로그에 어떤 변수가 없는지 나온다.

**버전과 별칭**:
- [ ] 버전 → "새 버전 발행"(버전 1, 예제 코드 상태)
- [ ] 별칭 → 이름 **`live`** → 버전 1
- 이후 배포는 워크플로가 새 버전을 발행하고 `live`를 옮긴다. 롤백은 `live`를 이전 버전으로 되돌리면 된다.

## 3. 진입점과 동시 실행 상한

**Function URL**: **별칭 `live`를 선택한 상태에서** 구성 → 함수 URL → 생성한다.
- [ ] 인증 유형 `NONE`, CORS 끔
  - UI와 API가 Worker 오리진 하나로 묶여 있어서 CORS가 필요 없다(D25).
- [ ] 발급된 URL(`https://<id>.lambda-url.ap-northeast-2.on.aws/`)을 적어 둔다. 4·5번에서 쓴다.
  - 공개 주소라 세션에 알려줘도 된다. 알려주면 5번의 `wrangler.jsonc` 수정은 Claude가 커밋한다.
  - 비밀값 4개는 대화에 붙여넣지 않는다.

**동시 실행 상한** — 0번 결과에 따라:
- [ ] 계정 한도가 1,000 이상이면 별칭이 아니라 **함수**의 구성 → 동시성 → 예약된 동시성 **10**
- [ ] 계정 한도가 10이면 설정하지 않는다(계정 한도가 상한)

## 4. GitHub 자동 배포(OIDC)와 첫 배포

**IAM 자격 증명 공급자**: 유형 OpenID Connect, 공급자 URL `https://token.actions.githubusercontent.com`, 대상 `sts.amazonaws.com`.

**IAM 역할 `sports-erp-github-deploy`** — 신뢰 정책(이 저장소의 배포 브랜치만 맡을 수 있게):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::<계정ID>:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:jeonghyeonme@96642864/sports-erp@1353168182:ref:refs/heads/dev"
      }
    }
  }]
}
```

- `sub`는 GitHub가 실제로 보내는 형식(소유자·저장소 이름 뒤에 고유 ID `@숫자`)과 **글자 그대로** 같아야 한다. 옛 형식 `repo:jeonghyeonme/sports-erp:ref:...`로는 `Not authorized to perform sts:AssumeRoleWithWebIdentity`로 실패했다([log/056](../docs/log/056.md)).
- 브랜치 이름이 `sub`에 들어 있어서, 배포 브랜치 이름을 바꾸면 이 값도 같이 바꿔야 한다(2026-10-06 `main-5x9td9` → `dev`, [D39](../docs/decisions/D39.md)). 전환하는 동안에는 값을 배열로 써서 두 브랜치를 모두 허용한다.
- 실제 값은 실패한 실행 직후 CloudTrail(서울) `AssumeRoleWithWebIdentity` 이벤트의 `userIdentity`에서 확인한다.

권한 정책(이 함수만):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "lambda:GetFunction", "lambda:GetFunctionConfiguration", "lambda:UpdateFunctionCode",
      "lambda:PublishVersion", "lambda:GetAlias", "lambda:UpdateAlias"
    ],
    "Resource": [
      "arn:aws:lambda:ap-northeast-2:<계정ID>:function:sports-erp-api",
      "arn:aws:lambda:ap-northeast-2:<계정ID>:function:sports-erp-api:*"
    ]
  }]
}
```

**GitHub 저장소 설정** — Settings → Secrets and variables → Actions:
- [ ] Variables: `AWS_LAMBDA_DEPLOY_ROLE_ARN`(위 역할 ARN), `LAMBDA_FUNCTION_NAME`(`sports-erp-api`)
- [ ] Secrets: `ORIGIN_SECRET`(1번 값), `LAMBDA_FUNCTION_URL`(3번 URL)
  - Function URL은 공개 주소지만 저장소·Actions 로그·문서에 남기지 않는다. 저장소가 공개라서, 수집된 주소로 오는 403 요청도 Lambda 호출로 과금되기 때문이다. Secret은 로그에서 `***`로 가려진다.
  - `AWS_LAMBDA_DEPLOY_ROLE_ARN`이 비어 있으면 배포 잡은 건너뛴다.

**첫 배포**:
- [ ] Actions 탭 → "Deploy api (AWS Lambda)" → **Run workflow**(브랜치 `dev`)로 수동 실행한다.
  - Run workflow 버튼은 **기본 브랜치에 있는 워크플로에만** 보인다. 2026-10-04에 저장소 기본 브랜치를 `main`에서 `main-5x9td9`로 바꿨고([log/056](../docs/log/056.md)), 2026-10-06에 그 이름을 `dev`로 바꿨다([D39](../docs/decisions/D39.md)).
  - 워크플로가 하는 일: 코드 업로드 → 버전 발행 → `live` 이동 → health 확인
  - **health 확인까지 초록이면 Lambda 쪽은 성공이다.** 실패하면 `live`는 이전 버전으로 자동으로 돌아간다. Actions 로그의 에러 부분을 세션에 붙여주면 된다.
  - 이후에는 `dev`에 api 변경이 병합될 때마다 자동으로 돈다.

**직접 확인**:
- [ ] `curl <URL>api/v1/health` → **403 `FORBIDDEN_ORIGIN`**이어야 한다. 비밀 헤더 없는 직접 호출은 막힌다.
- [ ] `curl -H "X-Origin-Secret: <ORIGIN_SECRET>" <URL>api/v1/health` → 200이어야 한다.

## 5. Cloudflare Worker 전환

`API_ORIGIN`과 `ORIGIN_SECRET`은 둘 다 Worker secret이다. 저장소(`wrangler.jsonc`)에는 Function URL을 적지 않는다.

- [ ] 리포 루트에서 `npm run build --workspace=apps/admin-web`(UI도 최신으로)을 실행한다.
- [ ] 저장소 밖에 secret 파일을 만들고 코드와 함께 한 번에 배포한 뒤 파일을 지운다:
  ```bash
  # 내용: {"API_ORIGIN":"<3번 Function URL, 끝 / 없이>","ORIGIN_SECRET":"<1번 값>"}
  cd cloudflare-worker && npx wrangler deploy --secrets-file ~/worker-secrets.json; rm ~/worker-secrets.json
  ```
  - 기존 배포에 `API_ORIGIN`이 secret이 아닌 일반 변수로 남아 있어 충돌 에러가 나면, Cloudflare 대시보드 → Worker → Settings → Variables and Secrets에서 그 변수를 지우고 다시 실행한다(이 경우는 아직 확인되지 않았다).
  - 되돌릴 때는 `API_ORIGIN`만 Render 주소로 바꿔 같은 방법으로 다시 배포한다.
- [ ] Worker 주소에서 화면이 뜨고 로그인이 되는지 확인한다(데모 계정 `kim.minsu@spoism.example` / `demo-password-1234`).

## 6. 워밍·관측·비용 안전장치

**워밍**: EventBridge Scheduler → 일정 생성.
- [ ] 반복 `rate(5 minutes)`, 대상 "AWS Lambda Invoke" → 함수 `sports-erp-api`, **별칭 `live`**, 페이로드 `{"warmup": true}`
- 콜드 스타트를 줄이고, 1시간에 한 번 DB에 `SELECT 1`을 보내 Supabase 무료 프로젝트의 7일 비활성 일시정지를 막는다.
- Worker를 거치지 않으므로 Workers 요청 한도에 잡히지 않는다.

**관측**:
- [ ] CloudWatch → 로그 그룹 `/aws/lambda/sports-erp-api` → 보존 기간 **14일**
- [ ] CloudWatch 경보: `Throttles` > 0(5분), `Errors` > 0(5분), `Duration` p95 > 1000ms. 알림은 이메일(SNS)로 받는다.

**비용**:
- [ ] Billing → Budgets → 월 **$1** 비용 예산 + 이메일 알림
- 동시 실행 상한 10이 비용 상한도 겸한다(D37 결정 2).

## 7. 검증(D37 §4)

- [ ] k6: `k6 run -e BASE_URL=<Function URL>api/v1 -e ORIGIN_SECRET=<값> loadtest/k6-lambda.js`
  - thresholds가 곧 통과 기준이다(S1 로그인 p95<500ms, S2 50 rps p95<300ms·거절 0, S3 300 rps 거절 p95<100ms·성공 p95<500ms).
  - 결과 요약을 세션에 붙여주면 D37·진행 로그에 기록한다. 로그인 기준을 못 넘으면 메모리를 1769MB로 올리고 다시 잰다.
- [ ] S4 콜드 스타트: 30분 이상 쉬게 한 뒤(워밍 일정은 잠시 끔) 요청을 보낸다. CloudWatch 로그 `REPORT` 줄의 `Init Duration`이 1.5초 미만인지 본다.
  - 로컬 Amazon Linux 2023 컨테이너 측정값은 1.2초였다(docs/log/052).
- [ ] S3를 Worker 주소로도 짧게 돌려 넘친 요청이 503 `SERVER_BUSY`로 오는지 본다(선택). Workers 무료 일일 한도 안에서.

## 8. 전환 후 정리

- [x] Render `sports-erp-api` 일시정지(Suspend) — 2026-10-06 완료(docs/log/075). Render는 D26 코드에 멈춰 있어 롤백 대상이 아니다. 롤백은 Lambda 별칭으로 한다.
- [ ] Render `sports-erp-web`(이미 일시정지, D25로 폐기)은 대시보드에서 삭제해도 된다.

## 승인 대기

- ~~`statement_timeout` 5초~~ — 2026-10-09 사용자 승인(log/093). Lambda는 풀러를 거쳐 `postgres` 역할로 접속하므로 `ALTER ROLE postgres SET statement_timeout = '5s'`. SQL Editor에도 걸린다. 실행 SQL은 log/093.
