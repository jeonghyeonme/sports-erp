#!/usr/bin/env bash
# D37 — api를 AWS Lambda 배포용 zip으로 묶는다. 리포 루트에서 실행한다.
#   bash apps/api/scripts/package-lambda.sh            # 결과: apps/api/.lambda/lambda.zip
#   LAMBDA_DOCKER=1 bash apps/api/scripts/package-lambda.sh
#       운영 의존성 설치를 Lambda 공식 이미지(nodejs:22, Amazon Linux 2023) 안에서 한다 — CI(배포 워크플로)는 이쪽.
#       bcrypt는 네이티브 모듈이라, 미리 빌드된 바이너리를 못 받아 소스로 빌드되면 빌드한 OS의 glibc에 묶인다.
#
# 순서: 전체 설치된 워크스페이스에서 Prisma Client 생성·빌드 → 별도 스테이징 폴더에서 api의 운영 의존성만 설치
#       (개발 환경의 node_modules를 건드리지 않는다) → 생성된 Prisma Client를 옮겨 넣고 Lambda용 엔진만 남긴다 → zip.
set -euo pipefail

ROOT="$(pwd)"
if [[ ! -f "$ROOT/apps/api/package.json" ]]; then
  echo "리포 루트에서 실행하세요." >&2
  exit 1
fi
OUT="$ROOT/apps/api/.lambda"
STAGE="$OUT/stage"
BUNDLE="$OUT/bundle"
rm -rf "$OUT"
mkdir -p "$STAGE" "$BUNDLE"

npm run prisma:generate --workspace=apps/api
npm run build --workspace=apps/api

# npm ci는 워크스페이스 폴더마다 package.json이 있어야 lockfile과 맞는다 — 매니페스트만 복사한다.
cp package.json package-lock.json "$STAGE/"
for ws in apps/*/package.json packages/*/package.json; do
  mkdir -p "$STAGE/$(dirname "$ws")"
  cp "$ws" "$STAGE/$ws"
done

if [[ "${LAMBDA_DOCKER:-0}" == "1" ]]; then
  docker run --rm -v "$STAGE:/var/task" -w /var/task --entrypoint npm \
    public.ecr.aws/lambda/nodejs:22 ci --omit=dev --workspace=apps/api --ignore-scripts=false --no-audit --no-fund
else
  (cd "$STAGE" && npm ci --omit=dev --workspace=apps/api --no-audit --no-fund)
fi

cp -r "$STAGE/node_modules" "$BUNDLE/node_modules"
# 워크스페이스 심볼릭 링크(@sports-erp/*)와 실행 파일 링크는 Lambda에서 쓰지 않는다.
rm -rf "$BUNDLE/node_modules/@sports-erp" "$BUNDLE/node_modules/.bin"
# Prisma CLI·스키마 엔진(마이그레이션용)과 타입 정의는 런타임에 쓰지 않는다 — zip을 직접 업로드 한도(50MB) 아래로 둔다.
rm -rf "$BUNDLE/node_modules/prisma" "$BUNDLE/node_modules/@prisma/engines" "$BUNDLE/node_modules/@types"

# 생성된 Prisma Client를 넣고, Lambda(Amazon Linux 2023, x86_64) 엔진만 남긴다(schema.prisma binaryTargets, D27).
rm -rf "$BUNDLE/node_modules/.prisma"
cp -r "$ROOT/node_modules/.prisma" "$BUNDLE/node_modules/.prisma"
find "$BUNDLE/node_modules/.prisma/client" -name 'libquery_engine-*' ! -name '*rhel-openssl-3.0.x*' -delete
if ! ls "$BUNDLE/node_modules/.prisma/client/"libquery_engine-rhel-openssl-3.0.x* >/dev/null 2>&1; then
  echo "rhel-openssl-3.0.x Prisma 엔진이 없습니다 — schema.prisma binaryTargets 확인" >&2
  exit 1
fi

cp -r "$ROOT/apps/api/dist" "$BUNDLE/dist"
cp "$ROOT/apps/api/package.json" "$BUNDLE/package.json"

(cd "$BUNDLE" && zip -qr "$OUT/lambda.zip" .)
echo "lambda.zip: $(du -h "$OUT/lambda.zip" | cut -f1) (압축 전 $(du -sh "$BUNDLE" | cut -f1)) — 핸들러: dist/lambda.handler"
