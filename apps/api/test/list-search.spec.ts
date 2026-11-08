import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { useDenseTemplate } from './helpers/worker-db';

// D74 2차(log/204) — 서버가 쪽을 나누는 목록(예약·자산·업무지원·변경 이력)의 검색어 q.
// 검색어는 시드에서 고른다(시연 데이터 층의 개수를 박지 않는다 — D58). 지점 격리는 검색어와 상관없이 그대로여야 한다.
useDenseTemplate();

describe('목록 검색 q (D74 2차)', () => {
  let app: INestApplication;
  let hq: string;
  let seocho: string;
  const get = (auth: string, path: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', auth);
  const includes = (v: unknown, q: string) => String(v ?? '').toLowerCase().includes(q.toLowerCase());

  beforeAll(async () => {
    app = await createApp();
    hq = await login(app, ACCOUNTS.superAdmin);
    seocho = await login(app, ACCOUNTS.seochoAdmin);
  });
  afterAll(async () => {
    await app.close();
  });

  it('예약: 회원 이름으로 거르고, 다른 지점 회원 이름은 지점 관리자에게 0건', async () => {
    const mine = await db(app).reservation.findFirstOrThrow({
      where: { scheduleSlot: { program: { branchId: BRANCH.seocho } } },
      include: { member: true },
    });
    const q = mine.member.name;
    const res = await get(seocho, `/reservations?q=${encodeURIComponent(q)}&limit=100`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const r of res.body.data) expect(includes(r.memberName, q) || includes(r.programName, q)).toBe(true);
    const all = await get(seocho, '/reservations?limit=1');
    expect(res.body.meta.total).toBeLessThan(all.body.meta.total);

    // 다른 지점에만 있는 회원 이름 — 검색해도 서초 지점 관리자에게는 없다(격리는 q와 무관)
    const others = await db(app).member.findMany({ where: { branchId: BRANCH.gangnam }, select: { name: true } });
    const seochoNames = new Set(
      (await db(app).member.findMany({ where: { branchId: BRANCH.seocho }, select: { name: true } })).map((m) => m.name),
    );
    const onlyGangnam = others.find((m) => !seochoNames.has(m.name));
    expect(onlyGangnam).toBeDefined();
    const leak = await get(seocho, `/reservations?q=${encodeURIComponent(onlyGangnam!.name)}`);
    expect([leak.status, leak.body.meta.total]).toEqual([200, 0]);
  });

  it('자산: 자산코드·품명·위치로 거른다, 빈 검색어는 조건 없음', async () => {
    const asset = await db(app).asset.findFirstOrThrow({ where: { branchId: BRANCH.seocho, status: { not: 'DISPOSED' } } });
    for (const q of [asset.assetCode, asset.name]) {
      const res = await get(seocho, `/assets?branchId=${BRANCH.seocho}&q=${encodeURIComponent(q)}&limit=100`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((a: { id: string }) => a.id)).toContain(asset.id);
      for (const a of res.body.data) expect([a.assetCode, a.name, a.location].some((v) => includes(v, q))).toBe(true);
    }
    const blank = await get(seocho, `/assets?branchId=${BRANCH.seocho}&q=%20%20&limit=1`);
    const none = await get(seocho, `/assets?branchId=${BRANCH.seocho}&limit=1`);
    expect(blank.body.meta.total).toBe(none.body.meta.total);
  });

  it('업무지원: 제목·요청자 이름으로 거른다', async () => {
    const sr = await db(app).supportRequest.findFirstOrThrow({ where: { branchId: BRANCH.seocho } });
    const q = sr.title.slice(0, 4);
    const res = await get(seocho, `/support-requests?q=${encodeURIComponent(q)}&limit=100`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: { id: string }) => r.id)).toContain(sr.id);
    for (const r of res.body.data) {
      expect(r.branchId ?? BRANCH.seocho).toBe(BRANCH.seocho);
      expect(includes(r.title, q) || includes(r.requesterName, q)).toBe(true);
    }
  });

  it('변경 이력(본사): 대상 이름이나 처리자 이름으로 거른다', async () => {
    const log = await db(app).auditLog.findFirstOrThrow({ where: { entity: 'Member' } });
    const member = await db(app).member.findUniqueOrThrow({ where: { id: log.entityId } });
    const res = await get(hq, `/audit-logs?q=${encodeURIComponent(member.name)}&limit=100`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: { id: string }) => r.id)).toContain(log.id);
    for (const r of res.body.data) expect(includes(r.entityName, member.name) || includes(r.actorName, member.name)).toBe(true);
    const nothing = await get(hq, `/audit-logs?q=${encodeURIComponent('없는이름zz')}`);
    expect(nothing.body.meta.total).toBe(0);
  });
});
