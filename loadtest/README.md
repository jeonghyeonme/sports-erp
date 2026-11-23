# 부하테스트 (k6)

> **지금 쓰는 것은 `k6-lambda.js`다**(AWS Lambda Function URL 직접 — S1 로그인 몰림·S2 50 rps 조회(부하)·S3 300 rps 과부하(스트레스)·S4 회복(S3 직후 50 rps, 30초 뒤부터 S2 기준), 실행법은 파일 머리 주석). 약 11분 30초. 결과: 2026-10-04 [D42](../docs/decisions/D42.md)·[log/056](../docs/log/2026-W40.md#056), 2026-10-12 운영 재측정 [D50](../docs/decisions/D50.md)·[log/109](../docs/log/2026-W42.md#109)(W 약 40ms, 과부하 실제 처리 약 80~90 rps). Lambda 서버 처리 시간은 CloudWatch Logs Insights(REPORT 줄)로 본다(`aws-lambda/README.md`).
> **2026-11-22 재측정 준비**([log/238](../docs/log/2026-W47.md#238)): S4(회복)와 조회 묶음 `-e MIX=current`(기본 — D50 뒤 생긴 처리 대기함·운영 실적 13개월·문서함·오늘 예약 4종을 더한 8종) | `legacy`(D50과 같은 4종, 지난 수치와 비교용)를 더했다. 시작 전 setup이 조회 묶음을 한 번씩 불러 200이 아니면 멈춘다. 사용자 PC에서 아래처럼 두 번 돌리고 출력 전체를 세션에 붙인다(배포 DB에 로그인 기록이 쌓인다 — 사용자 승인 2026-11-22).
>
> ```bash
> k6 run -e BASE_URL=<Function URL>/api/v1 -e ORIGIN_SECRET=<비밀값> loadtest/k6-lambda.js
> k6 run -e BASE_URL=<Function URL>/api/v1 -e ORIGIN_SECRET=<비밀값> -e MIX=legacy loadtest/k6-lambda.js
> ```
>
> Windows PowerShell(저장소 루트, 비밀값은 `aws-lambda/.env`에서 읽어 화면에 내지 않는다):
>
> ```powershell
> $SECRET = ((Get-Content aws-lambda\.env | Where-Object { $_ -match '^ORIGIN_SECRET=' }) -split '=', 2)[1].Trim().Trim("'", '"')
> $FURL = (aws lambda get-function-url-config --function-name sports-erp-api --qualifier live --profile sports-erp --query FunctionUrl --output text).Trim().TrimEnd('/')
> k6 run -e "BASE_URL=$FURL/api/v1" -e "ORIGIN_SECRET=$SECRET" loadtest/k6-lambda.js
> k6 run -e "BASE_URL=$FURL/api/v1" -e "ORIGIN_SECRET=$SECRET" -e MIX=legacy loadtest/k6-lambda.js
> ```
>
> **2026-11-22 결과**([log/239](../docs/log/2026-W47.md#239)): 두 묶음 모두 기준 12개 통과 — S2 성공 p95 약 69ms·거절 0, S3 실제 처리 약 99 rps·거절 p95 13ms·5xx 0, S4 30초 안 회복. D50의 순간 몰림 거절은 재현되지 않았다(원인 미확인). W는 CloudWatch로 다시 재지 않았다.
>
> 아래는 Render 시절(2026-09-27)의 `k6-scenarios.js` 기록이다. Render `sports-erp-api`는 2026-10-06 일시정지돼 이 스크립트의 기본 대상은 더 이상 동작하지 않는다(`-e BASE_URL`로 로컬 대상은 가능). 당시 결과는 D24.

docs/decisions/archive.md#D14가 "포트폴리오 규모에서 실측 인프라 수치는 무의미하다"고 판단해 설계 원칙으로 대체했던 부분을, 실제 배포(Render) 이후 다시 열어 실측하기로 한 것이다(2026-09-27 결정). 실측 결과가 나오면 D14를 갱신할 것.

## 실행 전 확인

- **Claude 세션(이 컨테이너)에서는 실행할 수 없다** — 조직 egress 정책이 `onrender.com`을 막고 있다. 로컬 또는 제약 없는 환경에서 실행할 것.
- Render 무료 티어는 15분 미사용 시 슬립한다. 테스트 시작 전 브라우저로 한 번 접속해 깨워두지 않으면 첫 구간 수치가 콜드스타트로 왜곡된다.
- k6 설치: https://k6.io/docs/get-started/installation/

## 실행

```bash
k6 run loadtest/k6-scenarios.js

# 다른 환경(로컬 dev 서버 등)을 대상으로 하려면
k6 run -e BASE_URL=http://localhost:3000/api/v1 loadtest/k6-scenarios.js
```

## 무엇을 보는지

두 시나리오를 순서대로 돌린다(동시에 돌리면 어느 쪽이 병목인지 구분이 안 됨):

1. **login_ramp**(0~40 VU) — 로그인 자체의 한계. `bcrypt.compare`가 CPU 바운드라 Render 무료 티어(공유 CPU)에서 먼저 무너질 가능성이 높은 지점.
2. **browse_ramp**(0~100 VU) — 로그인 후 지점요약·회원목록·프로그램목록·게시판을 순서대로 조회. `MockDataService`가 인메모리 배열이라 이 자체는 원래 빠르므로, 여기서 느려진다면 Node 이벤트루프 자체가 막힌 것(로그인 시나리오의 bcrypt가 스레드풀을 다 쓰고 있거나, 무료 티어 CPU 스로틀링)일 가능성이 크다.

결과(k6 요약 출력 전체, 특히 `http_req_duration`의 p95/p99와 `login_errors`/`browse_errors` 카운트)를 세션에 붙여주면 해석해서 대응 방안(예: bcrypt cost 낮추기, 로그인 rate limit, 유료 플랜 전환 등)까지 정리한다.
