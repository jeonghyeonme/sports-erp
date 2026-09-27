# api 게이트웨이 (Cloudflare Worker)

D24(`docs/2.decisions/50_결정및이슈기록/2-1_기술결정사항.md`) 1.5단계 — 도메인 없이 `*.workers.dev`로 Render api 앞에 엣지 프록시를 세워, 로그인·회원가입·연동 경로만 Cloudflare Rate Limiting으로 막는다. 나머지 경로는 그대로 Render로 흘려보낸다.

## 배포 전 확인

- **이 세션(Claude)은 실행할 수 없다** — 조직 egress 정책이 `api.cloudflare.com`/`workers.dev`를 막고 있다(`loadtest/README.md`와 같은 제약). 로컬 등 제약 없는 환경에서 실행할 것.
- Cloudflare 계정이 필요하다(무료로 충분 — 커스텀 도메인 불필요).

## 배포

```bash
cd cloudflare-worker
npm install
npx wrangler login       # 브라우저가 열리고 Cloudflare 로그인 요청
npx wrangler deploy
```

성공하면 마지막에 이런 줄이 나온다:

```
Uploaded sports-erp-api-gateway (X.XX sec)
Deployed sports-erp-api-gateway triggers (X.XX sec)
  https://sports-erp-api-gateway.<계정서브도메인>.workers.dev
```

**이 URL을 그대로 복사해서 붙여주세요** — admin-web의 `VITE_API_BASE_URL`을 이 주소로 바꿔서 재배포하겠습니다(Render에서 제가 바로 처리 가능).

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
