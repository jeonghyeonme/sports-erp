import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { todayKst } from '../src/common/date/kst-date';
import { ACCOUNTS, BRANCH, createApp, login } from './helpers/app';
import { useDenseTemplate } from './helpers/worker-db';

// D58 — 시연 데이터 층(고밀도 템플릿) 위에서 돈다.
useDenseTemplate();

/**
 * D58 — 현장 사용자(지점 관리자·회원)가 매일 여는 화면의 응답 시간. 고밀도 데이터(지점 5곳, 회원 ~210명, 예약·결제 ~5,700건,
 * 근태 ~1,500건)에서 요청마다 중앙값을 잰다. 한도는 CI 러너 편차를 감안해 넉넉히 잡았다 — 목적은 N+1 조회나 전체 적재처럼
 * 데이터 양에 비례해 느려지는 회귀를 잡는 것이지 미세 성능 비교가 아니다(로컬 측정값은 log/122).
 * 먼저 응답에 데이터가 실제로 실렸는지(빈 목록이 빨라 보이는 착시)를 확인한다.
 */
const LIMIT_MS = 1500;
const RUNS = 5;

describe('응답 시간 — 고밀도 데이터(D58)', () => {
  let app: INestApplication;
  const tok: Record<string, string> = {};
  const timings: Array<{ name: string; medianMs: number }> = [];

  beforeAll(async () => {
    app = await createApp();
    tok.seochoAdmin = await login(app, ACCOUNTS.seochoAdmin);
    tok.seochoMember = await login(app, ACCOUNTS.seochoMember);
    tok.superAdmin = await login(app, ACCOUNTS.superAdmin);
  });
  afterAll(async () => {
    await app.close();
    console.log(timings.map((t) => `${t.medianMs.toFixed(0).padStart(5)}ms  ${t.name}`).join('\n'));
  });

  const month = todayKst().slice(0, 7);
  const lastMonth = (() => {
    const d = new Date(`${month}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();

  // [이름, 계정, 경로, 응답에 데이터가 있는지]
  const cases: Array<[string, string, string, (body: { data: unknown; meta?: { total: number } }) => boolean]> = [
    ['지점 관리자 — 회원 목록', 'seochoAdmin', '/members', (b) => (b.meta?.total ?? 0) >= 30],
    ['지점 관리자 — 회원 검색(성)', 'seochoAdmin', `/members?q=${encodeURIComponent('김')}`, (b) => Array.isArray(b.data)],
    ['지점 관리자 — 결제 목록', 'seochoAdmin', '/payments', (b) => (b.meta?.total ?? 0) >= 500],
    ['지점 관리자 — 결제 하루 필터', 'seochoAdmin', `/payments?dateFrom=${todayKst()}&dateTo=${todayKst()}`, (b) => Array.isArray(b.data)],
    ['지점 관리자 — 근태 월 요약(지난달)', 'seochoAdmin', `/attendance/summary?branchId=${BRANCH.seocho}&month=${lastMonth}`, (b) => JSON.stringify(b.data).length > 50],
    ['지점 관리자 — 결근 미리보기(이번 달)', 'seochoAdmin', `/attendance/absence-preview?branchId=${BRANCH.seocho}&month=${month}`, (b) => Array.isArray(b.data)],
    ['지점 관리자 — 자산 목록', 'seochoAdmin', '/assets', (b) => (b.meta?.total ?? 0) >= 10],
    ['지점 관리자 — 게시판', 'seochoAdmin', '/posts', (b) => (b.meta?.total ?? 0) >= 10],
    ['회원 — 내 예약', 'seochoMember', '/reservations', (b) => (b.meta?.total ?? 0) >= 1],
    ['회원 — 프로그램(저녁 시간대)', 'seochoMember', `/programs?branchId=${BRANCH.seocho}&timeBand=EVENING`, (b) => Array.isArray(b.data)],
    ['회원 — 공지', 'seochoMember', '/posts?sort=latest&limit=5', (b) => Array.isArray(b.data) && (b.data as unknown[]).length > 0],
    ['본사 — 지점 목록(건수 집계)', 'superAdmin', '/branches', (b) => (b.data as unknown[]).length === 5],
    ['본사 — 전체 결제', 'superAdmin', '/payments', (b) => (b.meta?.total ?? 0) >= 2000],
  ];

  it.each(cases)('%s', async (name, who, path, hasData) => {
    const call = () => request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', tok[who]);
    const first = await call(); // 첫 요청은 연결·쿼리 계획 준비가 섞여 재지 않는다
    expect(first.status).toBe(200);
    expect(hasData(first.body)).toBe(true);

    const samples: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const started = performance.now();
      const res = await call();
      samples.push(performance.now() - started);
      expect(res.status).toBe(200);
    }
    const medianMs = samples.sort((a, b) => a - b)[Math.floor(RUNS / 2)];
    timings.push({ name, medianMs });
    expect(medianMs).toBeLessThan(LIMIT_MS);
  });

  it('회차 목록 — 지난 회차가 쌓인 프로그램의 회차 전체', async () => {
    const programs = await request(app.getHttpServer()).get(`/api/v1/programs?branchId=${BRANCH.seocho}&limit=100`).set('Authorization', tok.seochoAdmin);
    const withSlots = (programs.body.data as Array<{ id: string; pricingType: string; status: string }>).find(
      (p) => p.pricingType === 'PAID_SESSION' && p.status === 'RUNNING' && p.id.startsWith('demo-'),
    );
    expect(withSlots).toBeDefined();
    const started = performance.now();
    const res = await request(app.getHttpServer()).get(`/api/v1/programs/${withSlots!.id}/slots`).set('Authorization', tok.seochoAdmin);
    const ms = performance.now() - started;
    expect(res.status).toBe(200);
    expect((res.body.data as unknown[]).length).toBeGreaterThan(10);
    timings.push({ name: '지점 관리자 — 프로그램 회차 전체', medianMs: ms });
    expect(ms).toBeLessThan(LIMIT_MS);
  });
});
