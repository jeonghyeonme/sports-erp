import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { useDenseTemplate } from './helpers/worker-db';

// D74 2차(log/205) — 서버 쪽 나누기 목록(회원·자산·업무지원)의 머리글 정렬 sort·dir.
// 개수는 시드에서 센다(D58). 지점 격리는 정렬과 상관없이 그대로여야 한다.
useDenseTemplate();

describe('목록 정렬 sort·dir (D74 2차)', () => {
  let app: INestApplication;
  let seocho: string;
  let hq: string;
  const get = (auth: string, path: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', auth);
  const ids = (res: request.Response) => (res.body.data as { id: string }[]).map((r) => r.id);

  beforeAll(async () => {
    app = await createApp();
    seocho = await login(app, ACCOUNTS.seochoAdmin);
    hq = await login(app, ACCOUNTS.superAdmin);
  });
  afterAll(async () => {
    await app.close();
  });

  it('회원: 이름순은 DB의 이름 → id 순서와 같고, 역순은 그 반대 — 쪽을 넘겨도 빠짐·겹침이 없다', async () => {
    const total = await db(app).member.count({ where: { branchId: BRANCH.seocho } });
    const expected = (
      await db(app).member.findMany({ where: { branchId: BRANCH.seocho }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true } })
    ).map((m) => m.id);
    const pages: string[] = [];
    for (let p = 1; (p - 1) * 50 < total; p++) {
      const res = await get(seocho, `/members?sort=name&dir=asc&limit=50&page=${p}`);
      expect(res.status).toBe(200);
      pages.push(...ids(res));
    }
    expect(pages).toEqual(expected);
    const desc = await get(seocho, `/members?sort=name&dir=desc&limit=100`);
    expect(ids(desc).slice(0, 10)).toEqual([...expected].reverse().slice(0, 10));
  });

  it('회원: 모르는 열·방향은 무시하고 기본 순서(회원번호순), 지점 정렬도 자기 지점만', async () => {
    const base = await get(seocho, '/members?limit=20');
    const unknown = await get(seocho, '/members?sort=phone&dir=sideways&limit=20');
    expect(unknown.status).toBe(200);
    expect(ids(unknown)).toEqual(ids(base));
    const byBranch = await get(seocho, '/members?sort=branch&dir=desc&limit=100');
    for (const m of byBranch.body.data) expect(m.branchId).toBe(BRANCH.seocho);
  });

  it('자산: 취득가액 내림차순은 값이 커지지 않는다', async () => {
    const res = await get(hq, '/assets?sort=acquisitionCost&dir=desc&limit=100');
    expect(res.status).toBe(200);
    const costs = (res.body.data as { acquisitionCost: number }[]).map((a) => a.acquisitionCost);
    expect(costs.length).toBeGreaterThan(1);
    for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeLessThanOrEqual(costs[i - 1]);
  });

  it('업무지원: 요청일 오름차순은 기본(최근 것부터)의 반대 순서', async () => {
    const total = await db(app).supportRequest.count();
    const asc = await get(hq, `/support-requests?sort=createdAt&dir=asc&limit=100`);
    const base = await get(hq, `/support-requests?limit=100`);
    expect(asc.body.meta.total).toBe(total);
    const dates = (asc.body.data as { createdAt: string }[]).map((r) => r.createdAt);
    for (let i = 1; i < dates.length; i++) expect(dates[i] >= dates[i - 1]).toBe(true);
    if (total <= 100) expect(ids(asc)).toEqual([...ids(base)].reverse());
  });
});
