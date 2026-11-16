import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';

/**
 * D81 — 계약 갱신용 영업 리포트(GET /branches/:branchId/renewal-report). 새 데이터를 쌓지 않고 기존 기록을 읽어 계산하므로,
 * 리포트의 숫자가 원천(운영 실적 API·DB)과 같은지를 본다. 본사 전용 — 지점 관리자는 자기 지점도 403.
 */
describe('계약 갱신 리포트 (D81)', () => {
  let app: INestApplication;
  let hq: string;
  let seochoAdmin: string;

  const get = (auth: string, path: string) => request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', auth);

  beforeAll(async () => {
    app = await createApp();
    hq = await login(app, ACCOUNTS.superAdmin);
    seochoAdmin = await login(app, ACCOUNTS.seochoAdmin);
  });
  afterAll(async () => {
    await app.close();
  });

  it('본사: 계약 개요·회차 이력이 DB 회차와 같다', async () => {
    const res = await get(hq, `/branches/${BRANCH.seocho}/renewal-report`);
    expect(res.status).toBe(200);
    const r = res.body.data;
    const rounds = await db(app).contractRound.findMany({ where: { branchId: BRANCH.seocho }, orderBy: { roundNo: 'asc' } });
    expect(r.branch).toMatchObject({ id: BRANCH.seocho, name: '서초점' });
    expect(r.contract.rounds.map((x: { roundNo: number }) => x.roundNo)).toEqual(rounds.map((x) => x.roundNo));
    expect(r.contract.renewals).toBe(rounds.length - 1);
    expect(r.contract.current.roundNo).toBe(rounds[rounds.length - 1].roundNo);
    expect(r.contract.current.partner).toBe(rounds[rounds.length - 1].partner);
    expect(r.contract.firstStartAt).toBe(rounds[0].startAt.toISOString().slice(0, 10));
    expect(r.contract.servedDays).toBeGreaterThan(0);
    expect(r.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('운영 성과는 운영 실적 API(13개월)와 같은 값이고, 지난 12개월 합계는 진행 중인 이번 달을 뺀 합이다', async () => {
    const r = (await get(hq, `/branches/${BRANCH.seocho}/renewal-report`)).body.data;
    const perf = (await get(hq, `/branches/${BRANCH.seocho}/performance?months=13`)).body.data as Array<Record<string, number>>;
    expect(r.performance.months).toEqual(perf);
    const finished = perf.slice(0, -1);
    const total = (k: string, rows = finished) => rows.reduce((a, m) => a + m[k], 0);
    expect(r.performance.last12).toEqual({
      revenue: total('revenue'),
      reservations: total('reservations'),
      completed: total('completed'),
      newMembers: total('newMembers'),
    });
    expect(r.performance.recent6.reservations).toBe(total('reservations', finished.slice(-6)));
    expect(r.performance.prior6.reservations).toBe(total('reservations', finished.slice(-12, -6)));
    expect(r.performance.recent6.reservations + r.performance.prior6.reservations).toBe(r.performance.last12.reservations);
    expect(r.performance.branchCount).toBe(await db(app).branch.count());
    if (r.performance.last12.reservations > 0) {
      expect(r.performance.completionRate).toBeCloseTo((r.performance.last12.completed / r.performance.last12.reservations) * 100, 0);
    } else {
      expect(r.performance.completionRate).toBeNull();
    }
  });

  it('서비스 품질 숫자는 DB에서 센 값과 같다(회원 상태·진행 중 프로그램·운영 중 시설·지금 파견 인원)', async () => {
    const q = (await get(hq, `/branches/${BRANCH.seocho}/renewal-report`)).body.data.quality;
    const prisma = db(app);
    expect(q.members.active).toBe(await prisma.member.count({ where: { branchId: BRANCH.seocho, status: 'ACTIVE' } }));
    expect(q.programs.running).toBe(await prisma.program.count({ where: { branchId: BRANCH.seocho, status: 'RUNNING' } }));
    expect(q.facilities.active).toBe(await prisma.facility.count({ where: { branchId: BRANCH.seocho, isActive: true } }));
    expect(q.staff.current).toBe(await prisma.staffAssignment.count({ where: { branchId: BRANCH.seocho, endDate: null } }));
    expect(q.support.total).toBe(q.support.done + q.support.rejected + q.support.open);
  });

  it('업무지원 요청을 처리하면 처리 건수·평균 처리 기간에 반영된다', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/support-requests')
      .set('Authorization', seochoAdmin)
      .send({ category: 'FACILITY', title: '리포트 반영 확인', content: '갱신 리포트 테스트용 요청입니다.' });
    expect(created.status).toBe(201);
    const before = (await get(hq, `/branches/${BRANCH.seocho}/renewal-report`)).body.data.quality.support;
    const done = await request(app.getHttpServer())
      .patch(`/api/v1/support-requests/${created.body.data.id}/status`)
      .set('Authorization', hq)
      .send({ status: 'DONE', response: '처리했습니다.' });
    expect(done.status).toBe(200);
    const after = (await get(hq, `/branches/${BRANCH.seocho}/renewal-report`)).body.data.quality.support;
    expect(after.total).toBe(before.total);
    expect(after.done).toBe(before.done + 1);
    expect(after.open).toBe(before.open - 1);
    expect(after.averageResolveDays).not.toBeNull();
  });

  it('지점 관리자는 자기 지점 리포트도 403(본사 전용)', async () => {
    const res = await get(seochoAdmin, `/branches/${BRANCH.seocho}/renewal-report`);
    expect(res.status).toBe(403);
  });

  it('없는 지점은 404', async () => {
    const res = await get(hq, '/branches/branch-nowhere/renewal-report');
    expect(res.status).toBe(404);
  });
});
