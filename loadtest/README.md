# 부하테스트 (k6)

`2-1_기술결정사항.md` D14가 "포트폴리오 규모에서 실측 인프라 수치는 무의미하다"고 판단해 설계 원칙으로 대체했던 부분을, 실제 배포(Render) 이후 다시 열어 실측하기로 한 것이다(2026-09-27 결정). 실측 결과가 나오면 D14를 갱신할 것.

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
