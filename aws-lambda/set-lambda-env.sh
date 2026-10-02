#!/usr/bin/env bash
# 런북 1~2번의 비밀값 부분 — 사용자가 직접 실행한다(`! bash aws-lambda/set-lambda-env.sh`). 값을 출력하지 않는다.
# Claude는 .env를 읽지 않는다(전역 가드레일·guard-bash hook) — 그래서 이 단계만 사용자 실행으로 나눴다(docs/log/055).
# aws-lambda/.env 의 ORIGIN_SECRET, LAMBDA_DATABASE_URL 을 Lambda $LATEST 환경 변수에 넣는다.
# JWT 비밀값은 아직 없을 때만 새로 만든다(다시 실행해도 로그인 토큰이 무효화되지 않게).
# 별칭 live가 가리키는 버전에는 반영되지 않는다 — 다음 배포(GitHub Actions)가 발행하는 새 버전부터 적용된다.
set -euo pipefail
export AWS_PROFILE=sports-erp AWS_REGION=ap-northeast-2
cd "$(dirname "$0")/.."
set -a; . aws-lambda/.env; set +a
: "${ORIGIN_SECRET:?aws-lambda/.env에 ORIGIN_SECRET이 없다}"
: "${LAMBDA_DATABASE_URL:?aws-lambda/.env에 LAMBDA_DATABASE_URL이 없다}"
case "$LAMBDA_DATABASE_URL" in *:6543/*pgbouncer=true*) ;; *) echo "경고: Transaction pooler(6543) + pgbouncer=true 형식이 아니다 — 확인할 것" >&2 ;; esac

CURRENT=$(aws lambda get-function-configuration --function-name sports-erp-api --query 'Environment.Variables' --output json)
ENVJSON=$(CURRENT="$CURRENT" node -e '
const c=require("crypto"); const cur=JSON.parse(process.env.CURRENT||"null")||{};
const v={...cur, NODE_ENV:"production", DATABASE_URL:process.env.LAMBDA_DATABASE_URL, ORIGIN_SECRET:process.env.ORIGIN_SECRET,
  JWT_ACCESS_SECRET:cur.JWT_ACCESS_SECRET||c.randomBytes(32).toString("hex"),
  JWT_REFRESH_SECRET:cur.JWT_REFRESH_SECRET||c.randomBytes(32).toString("hex")};
console.log(JSON.stringify({Variables:v}));')
aws lambda update-function-configuration --function-name sports-erp-api --environment "$ENVJSON" >/dev/null
unset ENVJSON CURRENT
aws lambda wait function-updated-v2 --function-name sports-erp-api
echo "환경 변수 설정 완료 — 키 목록:"
aws lambda get-function-configuration --function-name sports-erp-api --query 'keys(Environment.Variables)' --output text
