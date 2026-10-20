import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { todayKst } from '../src/common/date/kst-date';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * 지점별 시나리오(engineering-risks §4, log/141) — R1·R2(log/123) 다음으로 남아 있던 장면을 재현한다.
 * - 계약 종료 전이와 채용 동시 요청: 종료 지점에 활성 파견이 남지 않는다(ADR-STF-05·07 지점 행 락)
 * - 파견 이동 날의 근태 귀속: 이동 뒤 체크인은 새 지점, 이동 전 체크인은 옛 지점에 남는다(ADR-ATT-03)
 * - 재시도로 같은 요청이 두 번 올 때: 예약·결제는 한 번만, 겹치는 휴가 신청은 막는다(연차 이중 차감 방지)
 */
describe('지점별 시나리오 (engineering-risks §4)', () => {
  let app: INestApplication;
  const MAPO = 'branch-mapo';

  const api = (auth: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth),
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
    patch: (p: string, b?: object) => request(app.getHttpServer()).patch(`/api/v1${p}`).set('Authorization', auth).send(b),
  });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('마포(갱신 임박) 종료 전이와 동시에 들어온 채용 5건 — 종료 지점에 활성 파견이 남지 않는다', async () => {
    const hq = await login(app, ACCOUNTS.superAdmin);
    const hires = Array.from({ length: 5 }, (_, i) =>
      api(hq).post('/staff', { branchId: MAPO, name: `동시채용${i}`, email: `race-hire-${i}@spoism.example` }),
    );
    const [terminate, ...results] = await Promise.all([
      api(hq).patch(`/branches/${MAPO}/contract-status`, { status: 'TERMINATED' }),
      ...hires,
    ]);
    expect(terminate.status).toBe(200);
    for (const r of results) expect([201, 409]).toContain(r.status);
    const open = await db(app).staffAssignment.count({ where: { branchId: MAPO, endDate: null } });
    expect(open).toBe(0);
    // 종료보다 먼저 커밋된 채용은 종료가 파견을 닫아 재배치 대기로 넘어간다 — 결과 창에 그 사람이 빠지지 않는다.
    const hiredBefore = results.filter((r) => r.status === 201).map((r) => r.body.data.id as string);
    const targets = (terminate.body.data.reassignmentTargets as Array<{ id: string }>).map((t) => t.id);
    expect(targets).toEqual(expect.arrayContaining(hiredBefore));
  });

  describe('파견 이동 날의 근태 귀속(ADR-ATT-03)', () => {
    it('오늘 강남으로 발령된 뒤 체크인하면 그 기록은 강남 것이고, 서초 요약에는 없다', async () => {
      const hq = await login(app, ACCOUNTS.superAdmin);
      expect((await api(hq).post('/staff/staff-seoyeon/assignments', { branchId: BRANCH.gangnam })).status).toBe(201);
      const staff = await login(app, ACCOUNTS.seochoStaff);
      const checkIn = await api(staff).post('/attendance/check-in');
      expect(checkIn.status).toBe(201);
      expect(checkIn.body.data.branchId).toBe(BRANCH.gangnam);

      const month = todayKst().slice(0, 7);
      const gangnamAdmin = await login(app, ACCOUNTS.gangnamAdmin);
      const seochoAdmin = await login(app, ACCOUNTS.seochoAdmin);
      const gangnam = (await api(gangnamAdmin).get(`/attendance/summary?month=${month}`)).body.data as Array<{ staffId: string }>;
      const seocho = (await api(seochoAdmin).get(`/attendance/summary?month=${month}`)).body.data as Array<{ staffId: string; normal: number; late: number }>;
      expect(gangnam.map((r) => r.staffId)).toContain('staff-seoyeon');
      const inSeocho = seocho.find((r) => r.staffId === 'staff-seoyeon');
      expect((inSeocho?.normal ?? 0) + (inSeocho?.late ?? 0)).toBe(0);
    });

    it('체크인한 뒤 같은 날 발령되면 그날 기록은 서초에 남는다(기록 자체의 branchId — 옮겨 가지 않는다)', async () => {
      const staff = await login(app, ACCOUNTS.seochoStaff);
      const checkIn = await api(staff).post('/attendance/check-in');
      expect(checkIn.body.data.branchId).toBe(BRANCH.seocho);
      const hq = await login(app, ACCOUNTS.superAdmin);
      expect((await api(hq).post('/staff/staff-seoyeon/assignments', { branchId: BRANCH.gangnam })).status).toBe(201);
      const record = await db(app).attendanceRecord.findUniqueOrThrow({ where: { id: checkIn.body.data.id } });
      expect(record.branchId).toBe(BRANCH.seocho);
      // 같은 날 체크아웃은 이미 있는 기록을 닫는다 — 새 지점에 두 번째 기록이 생기지 않는다.
      expect((await api(staff).post('/attendance/check-out')).status).toBe(201);
      expect(await db(app).attendanceRecord.count({ where: { staffId: 'staff-seoyeon', date: record.date } })).toBe(1);
    });
  });

  describe('재시도로 같은 요청이 두 번 올 때(몰림 503·15초 재시도 안내, D55)', () => {
    it('같은 회차 예약을 동시에 두 번 보내면 한 건만 생기고 다른 하나는 409', async () => {
      const member = await login(app, ACCOUNTS.seochoMember);
      const admin = await login(app, ACCOUNTS.seochoAdmin);
      const date = new Date(Date.now() + 9 * 3600_000 + 3 * 86_400_000).toISOString().slice(0, 10);
      const slot = await api(admin).post('/programs/program-seocho-yoga/slots', { date, startTime: '06:30', endTime: '07:30' });
      const [a, b] = await Promise.all([
        api(member).post('/reservations', { scheduleSlotId: slot.body.data.id }),
        api(member).post('/reservations', { scheduleSlotId: slot.body.data.id }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(await db(app).reservation.count({ where: { scheduleSlotId: slot.body.data.id } })).toBe(1);

      const created = a.status === 201 ? a : b;
      const [p1, p2] = await Promise.all([
        api(member).post(`/payments/${created.body.data.id}/mock-pay`),
        api(member).post(`/payments/${created.body.data.id}/mock-pay`),
      ]);
      expect([p1.status, p2.status].sort()).toEqual([201, 409]);
      expect(await db(app).payment.count({ where: { reservationId: created.body.data.id, status: 'APPROVED' } })).toBe(1);
    });

    it('같은 기간 휴가를 두 번 신청하면 두 번째는 409 — 둘 다 승인돼 연차가 두 번 깎이지 않는다', async () => {
      const staff = await login(app, ACCOUNTS.seochoStaff);
      const body = { type: 'ANNUAL', startDate: '2026-12-21', endDate: '2026-12-23' };
      const first = await api(staff).post('/leave-requests', body);
      expect(first.status).toBe(201);
      const again = await api(staff).post('/leave-requests', body);
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('LEAVE_REQUEST_OVERLAP');
      // 하루만 겹쳐도 막는다. 반려된 신청과는 겹쳐도 된다.
      const overlap = await api(staff).post('/leave-requests', { type: 'SICK', startDate: '2026-12-23', endDate: '2026-12-24' });
      expect(overlap.status).toBe(409);
      const admin = await login(app, ACCOUNTS.seochoAdmin);
      await api(admin).patch(`/leave-requests/${first.body.data.id}/reject`);
      expect((await api(staff).post('/leave-requests', body)).status).toBe(201);
    });

    it('겹치는 휴가 신청을 동시에 여러 번 보내도 한 건만 남는다', async () => {
      const staff = await login(app, ACCOUNTS.seochoStaff);
      const body = { type: 'ANNUAL', startDate: '2026-12-28', endDate: '2026-12-29' };
      const results = await Promise.all(Array.from({ length: 5 }, () => api(staff).post('/leave-requests', body)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(4);
      const rows = await db(app).leaveRequest.count({
        where: { staffId: 'staff-seoyeon', startDate: new Date('2026-12-28T00:00:00Z'), status: { not: 'REJECTED' } },
      });
      expect(rows).toBe(1);
    });

    it('신청 때 막기 전에 쌓인 겹치는 신청이 있어도 두 번째 승인은 409 — 연차는 한 번만 깎인다', async () => {
      const staff = await login(app, ACCOUNTS.seochoStaff);
      const admin = await login(app, ACCOUNTS.seochoAdmin);
      const before = (await api(staff).get('/leave-balance/staff-seoyeon')).body.data.usedDays as number;
      const range = { startDate: new Date('2026-12-21T00:00:00Z'), endDate: new Date('2026-12-23T00:00:00Z') };
      const [a, b] = await Promise.all(
        ['legacy-a', 'legacy-b'].map((id) =>
          db(app).leaveRequest.create({ data: { id, staffId: 'staff-seoyeon', type: 'ANNUAL', days: 3, ...range } }),
        ),
      );
      expect((await api(admin).patch(`/leave-requests/${a.id}/approve`)).status).toBe(200);
      const second = await api(admin).patch(`/leave-requests/${b.id}/approve`);
      expect([second.status, second.body.error.code]).toEqual([409, 'LEAVE_REQUEST_OVERLAP']);
      expect((await api(staff).get('/leave-balance/staff-seoyeon')).body.data.usedDays).toBe(before + 3);
    });
  });
});
