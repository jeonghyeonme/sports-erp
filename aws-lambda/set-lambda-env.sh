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
# log/056 6번 장애(풀러 형식 누락)의 재발 방지 — 경고만 하고 진행하던 것을 중단으로 바꿨다(사용자 결정 2A, log/093).
# D49 — 기본은 Session pooler(5432) + connection_limit=1. 트랜잭션 풀러(6543)는 pgbouncer=true가 있을 때만(되돌리기용).
# 6543에서 pgbouncer=true가 빠지면 42P05(prepared statement 충돌), 세션 모드에서 connection_limit=1이 빠지면
# 실행 환경마다 연결을 여러 개 잡아 풀(Pool Size)을 채운다 — 둘 다 여기서 막는다. 직접 연결(db.*.supabase.co)도 막는다.
case "$LAMBDA_DATABASE_URL" in
  *pooler.supabase.com:5432/*pgbouncer=true*) echo "중단: Session pooler(5432)에는 pgbouncer=true를 붙이지 않는다(D49) — aws-lambda/.env를 고칠 것" >&2; exit 1 ;;
  *pooler.supabase.com:5432/*connection_limit=1\&*|*pooler.supabase.com:5432/*connection_limit=1) echo "DB 연결: Session pooler(5432, D49)" ;;
  *pooler.supabase.com:6543/*pgbouncer=true*) echo "DB 연결: Transaction pooler(6543) + pgbouncer=true — D49 이전 형식(되돌리기용)" ;;
  *) echo "중단: LAMBDA_DATABASE_URL이 Session pooler(5432)+connection_limit=1 또는 Transaction pooler(6543)+pgbouncer=true 형식이 아니다 — aws-lambda/.env를 고친 뒤 다시 실행할 것" >&2; exit 1 ;;
esac

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
