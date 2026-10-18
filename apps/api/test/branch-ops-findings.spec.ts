import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * 화면 점검 발견 F3·F5·F6(log/125) — docs/log/129.
 * - F6 ADR-RSV-08: 체크인은 회차 당일(KST)만. 3주 뒤 회차도 체크인되던 것을 막는다.
 * - F5 ADR-RSV-08: 예약 목록의 회차 날짜 범위(dateFrom·dateTo) — 거르면 회차 시각순.
 * - F3: 지점 운영 실적(최근 3개월 월별) — KST 달 경계로 묶는다.
 * 테스트가 회차·예약·결제를 직접 만들어 쓰므로 테스트마다 워커 DB를 새로 만든다.
 */
const kstDate = (offsetDays = 0) => new Date(Date.now() + 9 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

describe('예약 체크인·날짜 필터·지점 운영 실적 (log/125 F3·F5·F6)', () => {
  let app: INestApplication;
  let admin: string;

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    admin = await login(app, ACCOUNTS.seochoAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  const call = (token: string, method: 'get' | 'patch', path: string) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', token).send({});

  /** 서초 요가에 date(KST) 회차 하나 + member-sujin의 예약 하나를 바로 만든다(예약 API의 지난 회차 차단을 피한다). */
  const seedReservation = async (key: string, date: string, startTime: string, status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' = 'CONFIRMED') => {
    const prisma = db(app);
    await prisma.scheduleSlot.create({
      data: { id: `slot-ops-${key}`, programId: 'program-seocho-yoga', date: new Date(`${date}T00:00:00Z`), startTime, endTime: '23:59', capacity: 10 },
    });
    await prisma.reservation.create({ data: { id: `resv-ops-${key}`, memberId: 'member-sujin', scheduleSlotId: `slot-ops-${key}`, status } });
    return `resv-ops-${key}`;
  };

  describe('F6 체크인은 회차 당일(KST)만', () => {
    it('오늘 회차는 체크인되고, 내일·어제·3주 뒤 회차는 409 CHECK_IN_NOT_TODAY', async () => {
      const today = await seedReservation('today', kstDate(0), '07:00');
      const tomorrow = await seedReservation('tomorrow', kstDate(1), '07:00');
      const yesterday = await seedReservation('yesterday', kstDate(-1), '07:00');
      const later = await seedReservation('later', kstDate(21), '07:00');

      const ok = await call(admin, 'patch', `/reservations/${today}/check-in`);
      expect(ok.status).toBe(200);
      expect(ok.body.data.status).toBe('COMPLETED');
      for (const id of [tomorrow, yesterday, later]) {
        const res = await call(admin, 'patch', `/reservations/${id}/check-in`);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('CHECK_IN_NOT_TODAY');
        expect((await db(app).reservation.findUniqueOrThrow({ where: { id } })).status).toBe('CONFIRMED');
      }
    });

    it('오늘 회차라도 확정이 아니면 예전처럼 409 RESERVATION_NOT_CONFIRMED', async () => {
      const id = await seedReservation('cancelled', kstDate(0), '07:00', 'CANCELLED');
      const res = await call(admin, 'patch', `/reservations/${id}/check-in`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RESERVATION_NOT_CONFIRMED');
    });
  });

  describe('F5 예약 목록 회차 날짜 필터', () => {
    it('dateFrom·dateTo = 오늘이면 오늘 회차 예약만, 회차 시각순으로', async () => {
      await seedReservation('late', kstDate(0), '19:00');
      await seedReservation('early', kstDate(0), '06:30');
      await seedReservation('tomorrow', kstDate(1), '05:00');
      const res = await call(admin, 'get', `/reservations?dateFrom=${kstDate(0)}&dateTo=${kstDate(0)}`);
      expect(res.status).toBe(200);
      const ids = (res.body.data as Array<{ id: string; slot: { date: string } }>).map((r) => r.id);
      expect(ids).toContain('resv-ops-early');
      expect(ids).toContain('resv-ops-late');
      expect(ids).not.toContain('resv-ops-tomorrow');
      expect(ids.indexOf('resv-ops-early')).toBeLessThan(ids.indexOf('resv-ops-late'));
      expect((res.body.data as Array<{ slot: { date: string } }>).every((r) => r.slot.date === kstDate(0))).toBe(true);
    });

    it('형식이 틀린 날짜는 빈 목록(500이 아니다), 필터가 없으면 예전 목록 그대로', async () => {
      for (const bad of ['2026-13-45', 'today', '20261019']) {
        const res = await call(admin, 'get', `/reservations?dateFrom=${bad}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
      }
      await seedReservation('any', kstDate(3), '10:00');
      const all = await call(admin, 'get', '/reservations?limit=100');
      expect((all.body.data as Array<{ id: string }>).some((r) => r.id === 'resv-ops-any')).toBe(true);
    });
  });

  describe('F3 지점 운영 실적', () => {
    const perf = async (token: string) => {
      const res = await call(token, 'get', `/branches/${BRANCH.seocho}/performance`);
      expect(res.status).toBe(200);
      return res.body.data as Array<{ month: string; revenue: number; refunded: number; reservations: number; completed: number; newMembers: number }>;
    };

    it('최근 3개월을 오래된 달부터 돌려주고, 마지막이 이번 달(KST)이다', async () => {
      const rows = await perf(await login(app, ACCOUNTS.superAdmin));
      expect(rows).toHaveLength(3);
      expect(rows[2].month).toBe(kstDate(0).slice(0, 7));
      expect(rows.map((r) => r.month)).toEqual([...rows.map((r) => r.month)].sort());
    });

    it('이번 달 승인·환불·예약·이용 완료·가입이 반영되고, KST 1일 00:30 승인은 이번 달로 센다', async () => {
      const hq = await login(app, ACCOUNTS.superAdmin);
      const before = (await perf(hq))[2];
      const prisma = db(app);
      const month = kstDate(0).slice(0, 7);
      const firstDay = `${month}-01`;
      const pay = (reservationId: string, amount: number, extra: object) =>
        prisma.payment.create({
          data: { reservationId, memberId: 'member-sujin', amount, supplyAmount: amount, vat: 0, method: 'MOCK_CARD', ...extra },
        });
      const done = await seedReservation('done', kstDate(0), '07:00', 'COMPLETED');
      // KST 1일 00:30 = UTC 전날 15:30 — UTC 달로 묶으면 지난달로 빠진다
      await pay(done, 30000, { status: 'APPROVED', approvedAt: new Date(`${firstDay}T00:30:00+09:00`) });
      const refund = await seedReservation('refund', kstDate(0), '08:00', 'CANCELLED');
      await pay(refund, 20000, { status: 'REFUNDED', approvedAt: new Date(), refundedAt: new Date() });
      await prisma.member.create({
        data: { id: 'member-ops-new', branchId: BRANCH.seocho, memberNo: 'OPS-NEW-1', name: '신규', joinedAt: new Date(`${kstDate(0)}T00:00:00Z`) },
      });

      const after = (await perf(hq))[2];
      expect(after.revenue - before.revenue).toBe(30000); // 30,000 + 20,000 승인 − 20,000 환불
      expect(after.refunded - before.refunded).toBe(20000);
      expect(after.reservations - before.reservations).toBe(1); // 취소는 빼고 센다
      expect(after.completed - before.completed).toBe(1);
      expect(after.newMembers - before.newMembers).toBe(1);
      // 지점 관리자도 자기 지점은 본다(남의 지점은 branch-isolation 공격 표)
      expect((await perf(admin))[2]).toEqual(after);
    });
  });
});
