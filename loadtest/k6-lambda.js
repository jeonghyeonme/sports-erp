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
// - S4는 S3 직후 50 rps로 돌아와 회복을 본다(2026-11-22 추가). 처음 30초(s4_recovery_window)는 회복 중이라 5xx·타임아웃만
//   보고, 그 뒤 2분(s4_recovered)은 S2와 같은 기준 — "과부하가 끝나고 30초 안에 평소 속도로 돌아온다"가 통과 조건이다.
// - 조회 묶음은 -e MIX=current(기본) | legacy. legacy는 D42·D50 측정 때의 4종 그대로라 지난 수치와 바로 비교할 때 쓰고,
//   current는 그 뒤 생긴 화면의 조회(처리 대기함·13개월 운영 실적 D75·문서함 ADR-RES-05·오늘 예약 ADR-RSV-08)를 더한다.

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
    s4_recovery_window: {
      executor: 'constant-arrival-rate',
      exec: 'browse',
      rate: 50,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 20,
      maxVUs: 100,
      startTime: '9m',
    },
    s4_recovered: {
      executor: 'constant-arrival-rate',
      exec: 'browse',
      rate: 50,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 20,
      maxVUs: 100,
      startTime: '9m30s',
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
    'failed{scenario:s4_recovery_window}': ['count==0'],
    'ok_duration{scenario:s4_recovered}': ['p(95)<300'],
    'rejected{scenario:s4_recovered}': ['count==0'],
    'failed{scenario:s4_recovered}': ['count==0'],
  },
};

export function setup() {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email: EMAIL, password: PASSWORD }), { headers: baseHeaders });
  if (res.status !== 200) throw new Error(`setup 로그인 실패: ${res.status} ${res.body}`);
  const token = res.json('data.accessToken');
  // 부하 전에 조회 묶음을 한 번씩 불러 본다 — 권한·경로가 틀려 403·404가 나면 그 수가 "failed"로 섞여 결과를 오독하게 된다.
  for (const path of PATHS) {
    const r = http.get(`${BASE_URL}${path}`, { headers: { ...baseHeaders, Authorization: `Bearer ${token}` } });
    if (r.status !== 200) throw new Error(`setup 조회 실패: ${path} → ${r.status} ${r.body}`);
  }
  return { token };
}

// 사용자 하나가 로그인 후 1초 쉬는 패턴(최대 40 VU ≈ 초당 40회). 쉬지 않으면 거절 응답(수 ms)마다 즉시 재시도해
// 분당 13만 건을 두드려, 로그인 성능이 아니라 재시도 폭주를 재게 된다(2026-10-04 첫 실측).
export function login() {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email: EMAIL, password: PASSWORD }), { headers: baseHeaders });
  loginDuration.add(res.timings.duration);
  if (!check(res, { '로그인 200': (r) => r.status === 200 })) loginErrors.add(1);
  sleep(1);
}

// 관리자 화면 흐름의 조회 묶음 중 하나를 돌아가며 부른다(요청 하나 = 도착 하나).
const LEGACY_PATHS = [
  '/branches/branch-seocho/programs/summary',
  '/members?branchId=branch-seocho',
  '/programs?branchId=branch-seocho',
  '/posts',
];
// KST 오늘(YYYY-MM-DD) — 예약 현황 화면의 기본 필터(ADR-RSV-08)와 같게
const KST_TODAY = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
// 2026-10-12(D50) 이후 생긴 화면이 실제로 부르는 조회 — admin-web의 요청 주소 그대로
const NEW_PATHS = [
  '/inbox', // 상단 바 처리 대기 배지 — 화면마다 불린다
  '/branches/branch-seocho/performance?months=13', // 지점 상세 운영 실적 차트(D75) — 집계라 가장 무겁다
  '/documents?page=1&limit=20', // 문서함(ADR-RES-05)
  `/reservations?dateFrom=${KST_TODAY}&dateTo=${KST_TODAY}&page=1&limit=20`, // 예약 현황 오늘(ADR-RSV-08)
];
const MIX = __ENV.MIX || 'current';
if (MIX !== 'current' && MIX !== 'legacy') throw new Error('MIX는 current 또는 legacy');
const PATHS = MIX === 'legacy' ? LEGACY_PATHS : [...LEGACY_PATHS, ...NEW_PATHS];

export function browse(data) {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const res = http.get(`${BASE_URL}${path}`, { headers: { ...baseHeaders, Authorization: `Bearer ${data.token}` }, tags: { name: path.split('?')[0] } });
  if (res.status === 200) okDuration.add(res.timings.duration);
  else if (res.status === 429 || res.status === 503) {
    rejected.add(1);
    rejectedDuration.add(res.timings.duration);
  } else failed.add(1);
}
