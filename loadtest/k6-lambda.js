// D37 §4 — Lambda 전환 후 "요청량을 감당하는가"를 판정하는 k6 시나리오(S1~S3). S4(콜드 스타트)는
// CloudWatch 로그의 REPORT 줄(Init Duration)로 본다 — aws-lambda/README.md "검증".
//
//   k6 run -e BASE_URL=<Function URL>/api/v1 -e ORIGIN_SECRET=<비밀값> loadtest/k6-lambda.js
//
// - Function URL에 직접 보낸다(비밀 헤더 포함). Worker를 거치면 로그인 rate limit(IP당 60초 10회)이 S1을 막고,
//   S2·S3 요청이 Workers 무료 일일 한도(10만)를 쓴다.
// - 통과 기준은 thresholds에 그대로 적었다 — 하나라도 넘으면 k6가 실패로 끝난다.
// - S3는 처리 한계(상한 10 ÷ 50ms ≈ 200 rps)를 넘기는 시나리오다. 모두가 느려지면 실패, 넘친 요청만 빠르게
//   거절(Lambda 429, Worker 경유 시 503 SERVER_BUSY)되고 성공한 요청은 빠르면 통과다.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL;
if (!BASE_URL) throw new Error('BASE_URL(<Function URL>/api/v1)이 필요하다');
const SECRET = __ENV.ORIGIN_SECRET;
const EMAIL = 'kim.minsu@spoism.example'; // 서초점 BRANCH_ADMIN 데모 계정
const PASSWORD = 'demo-password-1234';

const baseHeaders = { 'Content-Type': 'application/json', ...(SECRET ? { 'X-Origin-Secret': SECRET } : {}) };

const loginDuration = new Trend('login_duration', true);
const loginErrors = new Counter('login_errors');
const okDuration = new Trend('ok_duration', true);
const rejectedDuration = new Trend('rejected_duration', true);
const rejected = new Counter('rejected');
const failed = new Counter('failed'); // 200도 거절(429/503)도 아닌 응답 — 5xx·타임아웃 등

export const options = {
  scenarios: {
    s1_login_ramp: {
      executor: 'ramping-vus',
      exec: 'login',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 40 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
    s2_mixed_50rps: {
      executor: 'constant-arrival-rate',
      exec: 'browse',
      rate: 50,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 20,
      maxVUs: 100,
      startTime: '2m30s',
    },
    s3_overload_300rps: {
      executor: 'constant-arrival-rate',
      exec: 'browse',
      rate: 300,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 100,
      maxVUs: 400,
      startTime: '8m',
    },
  },
  thresholds: {
    'login_duration': ['p(95)<500'],
    'login_errors': ['count==0'],
    'ok_duration{scenario:s2_mixed_50rps}': ['p(95)<300'],
    'rejected{scenario:s2_mixed_50rps}': ['count==0'],
    'failed{scenario:s2_mixed_50rps}': ['count==0'],
    'ok_duration{scenario:s3_overload_300rps}': ['p(95)<500'],
    'rejected_duration{scenario:s3_overload_300rps}': ['p(95)<100'],
    'failed{scenario:s3_overload_300rps}': ['count==0'],
  },
};

export function setup() {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email: EMAIL, password: PASSWORD }), { headers: baseHeaders });
  if (res.status !== 200) throw new Error(`setup 로그인 실패: ${res.status} ${res.body}`);
  return { token: res.json('data.accessToken') };
}

// 사용자 하나가 로그인 후 1초 쉬는 패턴(최대 40 VU ≈ 초당 40회). 쉬지 않으면 거절 응답(수 ms)마다 즉시 재시도해
// 분당 13만 건을 두드려, 로그인 성능이 아니라 재시도 폭주를 재게 된다(2026-10-04 첫 실측).
export function login() {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email: EMAIL, password: PASSWORD }), { headers: baseHeaders });
  loginDuration.add(res.timings.duration);
  if (!check(res, { '로그인 200': (r) => r.status === 200 })) loginErrors.add(1);
  sleep(1);
}

// 관리자 화면 흐름의 조회 4종 중 하나를 돌아가며 부른다(요청 하나 = 도착 하나).
const PATHS = [
  '/branches/branch-seocho/programs/summary',
  '/members?branchId=branch-seocho',
  '/programs?branchId=branch-seocho',
  '/posts',
];

export function browse(data) {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const res = http.get(`${BASE_URL}${path}`, { headers: { ...baseHeaders, Authorization: `Bearer ${data.token}` }, tags: { name: path.split('?')[0] } });
  if (res.status === 200) okDuration.add(res.timings.duration);
  else if (res.status === 429 || res.status === 503) {
    rejected.add(1);
    rejectedDuration.add(res.timings.duration);
  } else failed.add(1);
}
