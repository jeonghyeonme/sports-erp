# Lambda 전환 — CLI 실행 절차 (로컬 Claude Code용)

> 콘솔 대신 **사용자 PC의 AWS CLI 자격 증명**으로 [README.md](README.md)의 0~8번을 실행하는 순서다. 근거는 [D37](../docs/decisions/D37.md).
> 로컬 Claude Code 세션은 이 파일을 위에서부터 따라가면 된다. 리소스를 만들기 전에 사용자에게 아래 "만들 것" 목록을 보여주고 확인받는다.
> 클라우드 세션에서는 자격 증명 취득이 권한 정책으로 막혀서 이 경로를 택했다(2026-10-02).
> **어디까지 했는지는 [STATUS](../docs/STATUS.md)를 본다.** 2026-10-03에 0~4번과 6번의 리소스를 만들었다([log/055](../docs/log/055.md)).

## 전제 (사용자가 먼저 해 둘 것)

1. AWS CLI v2 설치 후 로그인한다. 계정은 **클래식 가입 계정**이고, CLI는 관리자 권한 IAM 사용자로 로그인한다. "새로운 AWS 경험" 계정은 AWS 관리 SCP가 서울 Lambda와 OIDC를 막아서 쓰지 않는다([log/054](../docs/log/054.md)).
   ```bash
   aws configure set region ap-northeast-2 --profile sports-erp
   aws login --region ap-northeast-2 --profile sports-erp   # 별도 터미널에서 — 프로필 덮어쓰기 y/n 질문은 `!`로는 답할 수 없다
   ```
   - 자격 증명은 12시간 유효하고, 90일까지는 브라우저 재로그인 없이 갱신된다.
2. 비밀값 파일 `aws-lambda/.env`를 만든다. `.gitignore`의 `.env` 규칙에 걸려 커밋되지 않는다.
   ```bash
   ORIGIN_SECRET=<openssl rand -hex 32 결과>
   LAMBDA_DATABASE_URL='<Supabase Transaction pooler(6543) URI>?pgbouncer=true&connection_limit=1&pool_timeout=5'
   ```
   - URL은 **작은따옴표로 감싼다.** 스크립트가 이 파일을 bash로 `source`해서, 따옴표가 없으면 `&`가 백그라운드 기호로 읽힌다.
   - `?pgbouncer=true...`가 빠지면 부하 중에 `42P05 prepared statement "sN" already exists`로 로그인·조회가 500이 된다. 실제로 이 값이 빠진 채 배포돼 장애가 났다([log/056](../docs/log/056.md)). `set-lambda-env.sh`가 경고를 내면 진행하지 말고 `.env`를 고친다.
   - `ORIGIN_SECRET`은 GitHub 저장소 Secrets(`ORIGIN_SECRET`)에도 같은 값으로 넣는다.
   - 비밀번호에 특수문자가 있으면 URL 인코딩한다.
3. (선택) `gh auth login`을 해 두면 GitHub Variables 등록과 워크플로 실행도 Claude가 한다.

**비밀값은 대화창에 붙여넣지 않는다.** Claude는 `.env`를 읽지 않는다(전역 가드레일·guard-bash hook). 비밀값이 필요한 명령은 사용자가 `!`로 실행한다 — 함수 환경 변수는 [set-lambda-env.sh](set-lambda-env.sh), health 확인·Worker 전환은 아래 4·5번 명령. 그래서 1~2번의 함수는 `NODE_ENV`만 넣어 만들고, 비밀값은 스크립트로 나중에 넣는다.

Windows PowerShell 주의: PowerShell에서 `bash`를 치면 Git Bash가 아니라 **WSL bash**가 떠서 `aws: command not found`가 난다. `& "C:\Program Files\Git\bin\bash.exe" aws-lambda/set-lambda-env.sh`처럼 Git Bash를 지정한다. PowerShell 5.1은 `&&`를 모르고, JSON 인자의 따옴표를 깨뜨리므로 정책 JSON은 파일로 저장해 `file://`로 넘긴다.

Windows Git Bash 주의: `/aws/lambda/...` 같은 인자는 `MSYS_NO_PATHCONV=1`이 없으면 Windows 경로로 바뀐다. 자리표시 zip은 PowerShell `Compress-Archive`(역슬래시 경로가 들어감) 대신 python `zipfile`로 만든다.

## 공통 변수

```bash
export AWS_PROFILE=sports-erp AWS_REGION=ap-northeast-2
set -a; . aws-lambda/.env; set +a
FN=sports-erp-api
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
```

## 0. 확인 — 아무것도 만들지 않는다

```bash
aws sts get-caller-identity                     # 계정·역할 확인
aws service-quotas get-service-quota --service-code lambda --quota-code L-B99A9384 \
  --query Quota.Value                           # 동시 실행 한도: 10이면 3번 상한 생략, 1000 이상이면 3번에서 10으로 건다
aws lambda list-functions --max-items 1         # 서울 리전 Lambda 권한 확인(AccessDenied면 프로젝트 권한 문제 → 사용자에게 보고)
```

**만들 것**(사용자에게 확인받을 목록):
- 실행 역할 `sports-erp-api-exec`
- 함수 `sports-erp-api`, 버전 1, 별칭 `live`, Function URL(+공개 호출 권한), 필요하면 예약 동시성 10
- GitHub OIDC 공급자, 배포 역할 `sports-erp-github-deploy`
- 워밍용 역할 `sports-erp-scheduler`와 일정, 로그 보존 14일, 경보 3개

## 1~2. 실행 역할 + 빈 함수

JWT 비밀값은 여기서 만들어 Lambda 환경 변수로만 넣는다. 다른 곳에 저장하지 않는다.

```bash
aws iam create-role --role-name sports-erp-api-exec --assume-role-policy-document \
  '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name sports-erp-api-exec \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
sleep 10   # 역할 전파 대기

# create-function은 코드가 필요하다 — 자리표시 zip(실제 코드는 4번에서 GitHub Actions가 올린다)
# 핸들러(dist/lambda.handler)와 같은 위치에 둔다 — index.js로 두면 워밍 호출이 "핸들러 없음" 오류를 내 Errors 경보가 울린다
mkdir -p /tmp/ph/dist && echo 'exports.handler=async()=>({statusCode:503,body:"not deployed"})' > /tmp/ph/dist/lambda.js
(cd /tmp/ph && zip -q ph.zip dist/lambda.js)

ENVJSON=$(node -e 'const c=require("crypto");console.log(JSON.stringify({Variables:{NODE_ENV:"production",
  DATABASE_URL:process.env.LAMBDA_DATABASE_URL,ORIGIN_SECRET:process.env.ORIGIN_SECRET,
  JWT_ACCESS_SECRET:c.randomBytes(32).toString("hex"),JWT_REFRESH_SECRET:c.randomBytes(32).toString("hex")}}))')

aws lambda create-function --function-name $FN --runtime nodejs22.x --architectures x86_64 \
  --handler dist/lambda.handler --memory-size 1024 --timeout 10 \
  --role arn:aws:iam::$ACCOUNT:role/sports-erp-api-exec \
  --zip-file fileb:///tmp/ph/ph.zip --environment "$ENVJSON" >/dev/null
aws lambda wait function-active-v2 --function-name $FN
unset ENVJSON

aws lambda publish-version --function-name $FN --query Version --output text      # → 1
aws lambda create-alias --function-name $FN --name live --function-version 1
```

## 3. Function URL + 동시 실행 상한

```bash
aws lambda create-function-url-config --function-name $FN --qualifier live --auth-type NONE --query FunctionUrl --output text
# 공개 호출 허용(인증 NONE URL)
aws lambda add-permission --function-name $FN --qualifier live --statement-id url-public \
  --action lambda:InvokeFunctionUrl --principal '*' --function-url-auth-type NONE
# 최근 계정은 URL 호출에 lambda:InvokeFunction 권한도 요구한다(2026-10-03 실제로 이것 없이 {"Message":"Forbidden"}).
# 조건 lambda:InvokedViaFunctionUrl=true로 "URL을 통한 호출만" 허용한다 — principal '*'에 조건 없이 열지 말 것.
aws lambda add-permission --function-name $FN --qualifier live --statement-id url-invoke-via-url \
  --action lambda:InvokeFunction --principal '*' --invoked-via-function-url
# 0번에서 한도가 1000 이상이었을 때만:
# aws lambda put-function-concurrency --function-name $FN --reserved-concurrent-executions 10
```

Function URL은 공개 주소다. 이후 단계에서 쓰고, 사용자에게도 알려준다.

## 4. GitHub OIDC + 배포 역할 + 첫 배포

신뢰 정책·권한 정책 JSON은 [README.md](README.md) 4번 그대로다(`<계정ID>` → `$ACCOUNT`).

```bash
aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
# README 4번의 두 JSON을 /tmp/trust.json, /tmp/deploy.json으로 저장(<계정ID> 치환)한 뒤:
aws iam create-role --role-name sports-erp-github-deploy --assume-role-policy-document file:///tmp/trust.json --query Role.Arn --output text
aws iam put-role-policy --role-name sports-erp-github-deploy --policy-name deploy-sports-erp-api --policy-document file:///tmp/deploy.json
```

GitHub Variables 2개와 Secrets 2개를 등록한다. `gh`가 있으면 Claude가 하고, 없으면 사용자가 Settings → Secrets and variables → Actions에서 한다.
Function URL은 Variable이 아니라 **Secret**이다. 공개 저장소의 Actions 로그에 주소가 찍히지 않게 하려는 것이다([README.md](README.md) 4번).

```bash
gh variable set AWS_LAMBDA_DEPLOY_ROLE_ARN --body "arn:aws:iam::$ACCOUNT:role/sports-erp-github-deploy"
gh variable set LAMBDA_FUNCTION_NAME --body "$FN"
gh secret set LAMBDA_FUNCTION_URL --body "<3번 URL>"
gh secret set ORIGIN_SECRET --body "$ORIGIN_SECRET"
gh workflow run deploy-api-lambda.yml --ref dev && sleep 5 && gh run watch
```

**확인**:
- `curl <URL>api/v1/health` → 403 + `FORBIDDEN_ORIGIN`(앱이 막음, 정상)
- 비밀 헤더를 붙이면 200
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' -H "X-Origin-Secret: $ORIGIN_SECRET" <URL>api/v1/health
  ```
- 본문이 `{"Message":"Forbidden"}`이면 AWS가 막은 것이다 → 3번 권한 두 개를 확인한다.
- 워크플로 실패 시 `gh run view --log-failed`로 원인을 본다. 이때 `live`는 자동으로 이전 버전에 돌아가 있다.

## 5. Cloudflare Worker 전환

`API_ORIGIN`도 Worker secret이다. `wrangler.jsonc`는 고치지 않는다. 코드와 secret 두 개를 한 번에 올려서 origin이 비는 순간을 없앤다.

```bash
FURL="<3번 URL>"   # 끝 "/"는 아래에서 뗀다
npm run build --workspace=apps/admin-web
node -e 'console.log(JSON.stringify({API_ORIGIN:process.argv[1].replace(/\/$/,""),ORIGIN_SECRET:process.env.ORIGIN_SECRET}))' "$FURL" > ~/worker-secrets.json
(cd cloudflare-worker && npx wrangler deploy --secrets-file ~/worker-secrets.json); rm -f ~/worker-secrets.json
```

Worker 주소에서 로그인을 확인한다(`kim.minsu@spoism.example` / `demo-password-1234`). 문제가 있으면 `API_ORIGIN`만 Render 주소로 바꿔 같은 방법으로 다시 배포한다.
- 기존 배포에 남은 일반 변수 `API_ORIGIN`과 이름이 충돌한다는 에러가 나면, 대시보드 → Worker → Settings → Variables and Secrets에서 그 변수를 지우고 다시 실행한다(아직 확인되지 않음).
- Function URL은 STATUS·log·D37·발표자료 등 문서에 적지 않는다. "Function URL(별칭 live)"로만 쓴다.

## 6. 워밍·관측

```bash
aws iam create-role --role-name sports-erp-scheduler --assume-role-policy-document \
  '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"scheduler.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam put-role-policy --role-name sports-erp-scheduler --policy-name invoke-live --policy-document \
  "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"lambda:InvokeFunction\",\"Resource\":\"arn:aws:lambda:$AWS_REGION:$ACCOUNT:function:$FN:live\"}]}"
sleep 10
aws scheduler create-schedule --name sports-erp-api-warmup --schedule-expression 'rate(5 minutes)' \
  --flexible-time-window Mode=OFF \
  --target "{\"Arn\":\"arn:aws:lambda:$AWS_REGION:$ACCOUNT:function:$FN:live\",\"RoleArn\":\"arn:aws:iam::$ACCOUNT:role/sports-erp-scheduler\",\"Input\":\"{\\\"warmup\\\":true}\"}"

aws logs create-log-group --log-group-name /aws/lambda/$FN 2>/dev/null
aws logs put-retention-policy --log-group-name /aws/lambda/$FN --retention-in-days 14
```

경보(Throttles·Errors > 0, Duration p95 > 1000ms)와 SNS 이메일은 사용자의 이메일 주소가 필요하다. 사용자에게 확인받고 만든다. 월 $1 예산은 결제 권한이 필요하므로 사용자가 콘솔에서 건다.

## 7~8. 검증·정리

- [README.md](README.md) 7번(k6 S1~S4)을 실행하고, 결과를 D37 §4와 `docs/log/`에 기록한다(`wrap-up` 스킬).
- `docs/STATUS.md`의 api 호스팅 행을 갱신한다.
- 사용자가 Render `sports-erp-api`를 일시정지한다.
- `aws-lambda/.env`는 지워도 된다. 이후 배포는 GitHub OIDC가 하므로 로컬 자격 증명이 필요 없다.
