// 스포이즘 ERP 부하테스트 — k6 스크립트.
// 실행: 이 컨테이너(Claude 세션)에선 조직 egress 정책이 onrender.com을 막고 있어
// 직접 실행이 불가능하다 — 로컬 머신 등 제약 없는 환경에서 돌려야 한다.
//
//   설치: https://k6.io/docs/get-started/installation/
//   실행: k6 run loadtest/k6-scenarios.js
//   결과를 다시 붙여주면 병목 해석·대응 방안을 정리한다(docs/process/06_진행_로그.md에 기록).
//
// 두 시나리오로 나눈 이유: MockDataService의 GET 계열은 인메모리 배열 스캔이라
// 원래도 빨라서 병목이 잘 안 드러난다. 반면 로그인(bcrypt.compare, cost 10)은
// CPU 바운드라 Render 무료 티어(공유 CPU)에서 먼저 한계를 보일 가능성이 높다 —
// 그래서 "로그인 자체"와 "로그인 후 조회"를 분리해서, 어느 쪽이 먼저 무너지는지
// 구분해서 본다.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://sports-erp-api.onrender.com/api/v1';
const EMAIL = 'kim.minsu@spoism.example'; // 서초점 BRANCH_ADMIN 데모 계정
const PASSWORD = 'demo-password-1234';

const loginErrors = new Counter('login_errors');
const browseErrors = new Counter('browse_errors');
const loginDuration = new Trend('login_duration', true);

export const options = {
  scenarios: {
    // 시나리오 1 — 로그인 자체의 한계를 찾는다(bcrypt CPU 비용).
    login_ramp: {
      executor: 'ramping-vus',
      exec: 'loginScenario',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 20 },
        { duration: '1m', target: 40 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
    // 시나리오 2 — 로그인 이후 실제 관리자가 화면을 넘겨보는 상황(조회 위주).
    // 토큰은 setup()에서 한 번만 발급해 재사용한다(각 VU가 매번 로그인하면
    // "로그인 비용"과 "조회 비용"이 섞여 버려서 분리하려는 목적이 깨진다).
    browse_ramp: {
      executor: 'ramping-vus',
      exec: 'browseScenario',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
      startTime: '3m30s', // login_ramp가 끝난 뒤 시작(둘이 동시에 겹치면 어느 쪽 병목인지 헷갈림)
    },
  },
  thresholds: {
    // "몇 명까지 버티나"를 보는 테스트라 실패해도 정지시키지 않고 끝까지 돌린다 —
    // 다만 이 값들을 넘기면 리포트에 빨간 줄로 표시돼 병목 지점을 바로 알 수 있다.
    http_req_duration: ['p(95)<2000'],
    login_errors: ['count<50'],
    browse_errors: ['count<50'],
  },
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200) {
    throw new Error(`setup 로그인 실패: ${res.status} ${res.body}`);
  }
  const accessToken = res.json('data.accessToken');
  return { accessToken };
}

export function loginScenario() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  loginDuration.add(res.timings.duration);
  const ok = check(res, {
    '로그인 200': (r) => r.status === 200,
    '토큰 발급됨': (r) => !!r.json('data.accessToken'),
  });
  if (!ok) loginErrors.add(1);
  sleep(1);
}

export function browseScenario(data) {
  const headers = { Authorization: `Bearer ${data.accessToken}` };

  // 실제 BRANCH_ADMIN이 관리자 화면을 넘겨보는 흐름을 흉내낸다: 지점 요약 →
  // 회원 목록 → 프로그램 목록 → 게시판. 매 반복 이 4개를 순서대로 호출.
  const requests = [
    ['branch_programs_summary', `${BASE_URL}/branches/branch-seocho/programs/summary`],
    ['members_list', `${BASE_URL}/members?branchId=branch-seocho`],
    ['programs_list', `${BASE_URL}/programs?branchId=branch-seocho`],
    ['posts_list', `${BASE_URL}/posts`],
  ];

  for (const [name, url] of requests) {
    const res = http.get(url, { headers, tags: { name } });
    const ok = check(res, { [`${name} 200`]: (r) => r.status === 200 });
    if (!ok) browseErrors.add(1);
  }
  sleep(1);
}
