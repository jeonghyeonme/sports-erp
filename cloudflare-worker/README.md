# api 게이트웨이 + admin-web 정적 자산 (Cloudflare Worker)

D24(`docs/decisions/D24.md`) 1.5단계 — 도메인 없이 `*.workers.dev`로 Render api 앞에 엣지 프록시를 세워, 로그인·회원가입·연동 경로만 Cloudflare Rate Limiting으로 막는다. 나머지 `/api/*` 경로는 그대로 Render로 흘려보낸다.

**D25(2026-09-27)로 admin-web(UI)도 이 Worker의 정적 자산으로 흡수됐다** — Render의 `sports-erp-web` Static Site는 더 이상 쓰지 않는다. `wrangler.jsonc`의 `assets.run_worker_first`가 `/api/*`로만 한정돼 있어서, UI 요청은 `src/index.ts`를 거치지 않고 Cloudflare가 바로 정적 자산으로 서빙하고, `not_found_handling: single-page-application`이 새로고침 시 `index.html` 폴백을 보장한다. 결과적으로 UI와 API가 같은 오리진이 되어 CORS 자체가 성립하지 않는다.

**D37(2026-09-30)로 origin이 Render에서 AWS Lambda(서울, Function URL)로 바뀐다.** Worker는 Lambda가 받아 주는 비밀 헤더(`X-Origin-Secret`, `wrangler secret put ORIGIN_SECRET`)를 붙이고, Lambda가 동시 실행 상한에 걸려 돌려주는 429를 공통 에러 포맷의 503 `SERVER_BUSY`로 바꾼다. 앱이 스스로 내는 429(회원 연동 시도 초과)는 그대로 통과시킨다. 전환 절차는 [`aws-lambda/README.md`](../aws-lambda/README.md) 5번.

## 배포 전 확인

- **이 세션(Claude)은 실행할 수 없다** — 조직 egress 정책이 `api.cloudflare.com`/`workers.dev`를 막고 있다(`loadtest/README.md`와 같은 제약). 로컬 등 제약 없는 환경에서 실행할 것.
- Cloudflare 계정이 필요하다(무료로 충분 — 커스텀 도메인 불필요).
- **먼저 admin-web을 빌드해야 한다** — `wrangler.jsonc`의 `assets.directory`가 `../apps/admin-web/dist`를 가리킨다. 빌드 결과물이 없으면 `wrangler deploy`가 빈 자산으로 배포되거나 실패한다.

## 배포

```bash
# 1) 리포 루트에서 admin-web 빌드 (VITE_API_BASE_URL을 지정하지 않으면 상대경로 /api/v1로
#    폴백하므로, 같은 오리진(이 Worker)에서 서빙될 때만 그대로 두면 된다)
npm install
npm run build --workspace=apps/admin-web

# 2) Worker 배포
cd cloudflare-worker
npm install
npx wrangler login       # 처음 한 번만 — 브라우저가 열리고 Cloudflare 로그인 요청
npx wrangler deploy
```

origin 주소 `API_ORIGIN`은 저장소가 아니라 Worker secret에 있다(D37 — 공개 저장소에 Lambda Function URL을 남기지 않는다). `wrangler.jsonc`의 `secrets.required`에 올라 있어서, secret이 없으면 `wrangler deploy`가 실패한다. secret은 배포해도 지워지지 않으므로 한 번 넣은 뒤로는 위 명령 그대로 배포하면 된다.

**처음 한 번(또는 origin을 바꿀 때)** — 코드와 secret을 한 번에 올려서 origin이 비는 순간이 없게 한다:

```bash
# 값은 Render 주소(전환 전) 또는 Lambda Function URL(전환 후, 끝 "/" 없이). 파일은 저장소 밖에 두고 바로 지운다.
printf '{"API_ORIGIN":"%s"}' "<origin 주소>" > ~/worker-secrets.json
npx wrangler deploy --secrets-file ~/worker-secrets.json; rm ~/worker-secrets.json
```

성공하면 마지막에 이런 줄이 나온다:

```
Uploaded sports-erp-api-gateway (X.XX sec)
Deployed sports-erp-api-gateway triggers (X.XX sec)
  https://sports-erp-api-gateway.<계정서브도메인>.workers.dev
```

이미 배포됐던 것과 같은 URL(`https://sports-erp-api-gateway.01-beauty-minimal.workers.dev`)이 그대로 유지된다(Worker 이름을 바꾸지 않았음). **이 URL을 열어서 admin-web 화면이 뜨는지, 로그인이 되는지, 아무 화면에서나 새로고침해도 404가 안 나는지 확인해서 알려주세요.**

admin-web을 코드 변경 후 다시 배포하려면 위 두 단계(빌드 → `wrangler deploy`)를 반복해야 한다 — Render처럼 git push만으로 자동 재배포되지 않는다(Cloudflare Workers Builds로 git 연동하면 되지만 아직 설정 안 함, 필요해지면 별도로 검토).

## 동작 확인(선택)

```bash
# 정상 통과(200이 나와야 함 — 실제 데모 계정으로)
curl -X POST https://<위에서 받은 주소>/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"kim.minsu@spoism.example","password":"demo-password-1234"}'

# 11번째 연속 호출부터 429가 나와야 함(60초당 10회 제한)
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<위 주소>/api/v1/auth/login \
    -H "Content-Type: application/json" -d '{"email":"x","password":"x"}'
done
```

## 실패 시

`wrangler deploy`가 `unsafe.bindings`(rate limit 설정) 관련 에러를 내면, Cloudflare 공식 문서에서 정확한 필드명을 재확인 못 한 채 작성한 부분이라 에러 메시지를 그대로 붙여주세요 — 문법을 바로 고치겠습니다.
