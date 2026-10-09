import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D43 — 쌓이는 목록 4개(회원·예약·결제·자산)의 offset 페이지네이션과 필터를 DB 조건으로 내린 것(ADR-RSV-04).
 * 형식은 게시판(ADR-BRD-02)과 같다: page·limit(기본 20, 상한 100) → meta { page, pageSize, total }.
 * B8 사용자 결정(log/088): 예약·결제는 최근 것부터, 자산 기본 목록은 폐기 제외, 회원은 담당 직원 필터(none = 미배정).
 * 지점 격리는 branch-isolation.spec이 본다 — 여기서는 BRANCH_ADMIN의 total이 자기 지점 기준인지만 확인한다.
 */
describe('목록 페이지네이션 — D43·ADR-RSV-04', () => {
  let app: INestApplication;
  const tok: Record<string, string> = {};

  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', tok[who]);
  const post = (who: string, path: string, body?: object) =>
    request(app.getHttpServer()).post(`/api/v1${path}`).set('Authorization', tok[who]).send(body ?? {});

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    for (const [k, email] of Object.entries(ACCOUNTS)) tok[k] = await login(app, email);
  });
  afterEach(async () => {
    await app.close();
  });

  describe('회원 GET /members', () => {
    it('limit으로 자르고 total은 전체 건수, 마지막 쪽은 남은 만큼만 온다', async () => {
      const total = await db(app).member.count();
      const first = await get('superAdmin', '/members?limit=50');
      expect(first.status).toBe(200);
      expect(first.body.meta).toEqual({ page: 1, pageSize: 50, total });
      expect(first.body.data).toHaveLength(Math.min(50, total));

      const lastPage = Math.ceil(total / 50);
      const last = await get('superAdmin', `/members?limit=50&page=${lastPage}`);
      expect(last.body.data).toHaveLength(total - 50 * (lastPage - 1));
      // 쪽 사이에 겹치는 회원이 없다(정렬이 안정적이다)
      const ids = new Set(first.body.data.map((m: { id: string }) => m.id));
      expect(last.body.data.some((m: { id: string }) => ids.has(m.id))).toBe(lastPage === 1);
    });

    it('limit은 100을 넘지 않고, 잘못된 page·limit은 1·20으로 대체된다', async () => {
      expect((await get('superAdmin', '/members?limit=1000')).body.meta.pageSize).toBe(100);
      expect((await get('superAdmin', '/members?page=-3&limit=abc')).body.meta).toMatchObject({ page: 1, pageSize: 20 });
    });

    it('담당 직원 필터 — 직원 id면 그 직원 회원만, none이면 미배정 회원만(지점 상세)', async () => {
      const mine = await get('seochoAdmin', '/members?assignedStaffId=staff-seoyeon');
      expect(mine.body.data.map((m: { id: string }) => m.id)).toEqual(['member-sujin']);
      expect(mine.body.meta.total).toBe(1);

      const none = await get('seochoAdmin', '/members?assignedStaffId=none');
      expect(none.body.data.map((m: { id: string }) => m.id)).toEqual(['member-dormant']);
    });

    it('지점 관리자의 total은 자기 지점 회원 수다', async () => {
      const res = await get('seochoAdmin', '/members');
      expect(res.body.meta.total).toBe(await db(app).member.count({ where: { branchId: BRANCH.seocho } }));
    });
  });

  describe('자산 GET /assets', () => {
    it('기본 목록은 폐기(DISPOSED)를 빼고, status=DISPOSED로 따로 본다', async () => {
      await db(app).asset.update({ where: { id: 'asset-seocho-sanitizer' }, data: { status: 'DISPOSED' } });

      const base = await get('seochoAdmin', '/assets');
      expect(base.status).toBe(200);
      expect(base.body.data.map((a: { id: string }) => a.id)).not.toContain('asset-seocho-sanitizer');
      expect(base.body.meta.total).toBe(2);

      const disposed = await get('seochoAdmin', '/assets?status=DISPOSED');
      expect(disposed.body.data.map((a: { id: string }) => a.id)).toEqual(['asset-seocho-sanitizer']);
      expect(disposed.body.meta.total).toBe(1);
    });
  });

  describe('예약 GET /reservations — 최근 것부터', () => {
    it('회원 본인 목록이 최근 예약부터 오고 total이 붙는다', async () => {
      const first = await post('seochoMember', '/reservations', { scheduleSlotId: 'slot-seocho-yoga-1' });
      const second = await post('seochoMember', '/reservations', { scheduleSlotId: 'slot-seocho-yoga-2' });
      expect([first.status, second.status]).toEqual([201, 201]);

      const res = await get('seochoMember', '/reservations?limit=1');
      expect(res.body.meta).toEqual({ page: 1, pageSize: 1, total: 2 });
      expect(res.body.data[0].id).toBe(second.body.data.id);
    });
  });

  describe('결제 GET /payments — 날짜 필터는 KST 하루 경계의 DB 조건(ADR-RSV-04)', () => {
    // 예약 2건을 만들어 결제한 뒤 승인 시각을 KST 자정 양옆으로 옮기고, 결제 안 한 예약 1건을 더 둔다.
    let afterMidnight: string; // 2026-10-09 00:30 KST(= 10-08 15:30Z) 승인
    let beforeMidnight: string; // 2026-10-08 23:30 KST(= 10-08 14:30Z) 승인
    let pending: string; // 미승인

    beforeEach(async () => {
      const reserveAndPay = async (slotId: string) => {
        const r = await post('seochoMember', '/reservations', { scheduleSlotId: slotId });
        expect(r.status).toBe(201);
        expect((await post('seochoMember', `/payments/${r.body.data.id}/mock-pay`)).status).toBe(201);
        return (await db(app).payment.findUniqueOrThrow({ where: { reservationId: r.body.data.id } })).id;
      };
      afterMidnight = await reserveAndPay('slot-seocho-yoga-1');
      beforeMidnight = await reserveAndPay('slot-seocho-yoga-2');
      await db(app).payment.update({ where: { id: afterMidnight }, data: { approvedAt: new Date('2026-10-08T15:30:00Z') } });
      await db(app).payment.update({ where: { id: beforeMidnight }, data: { approvedAt: new Date('2026-10-08T14:30:00Z') } });

      const slot = await db(app).scheduleSlot.create({
        data: { programId: 'program-seocho-yoga', date: new Date('2099-01-01T00:00:00Z'), startTime: '07:00', endTime: '08:00', capacity: 5 },
      });
      const r = await post('seochoMember', '/reservations', { scheduleSlotId: slot.id });
      pending = (await db(app).payment.findUniqueOrThrow({ where: { reservationId: r.body.data.id } })).id;
    });

    const ids = (res: request.Response) => res.body.data.map((p: { id: string }) => p.id).sort();

    it('KST 00:00~08:59에 승인된 결제는 그 KST 날짜로 걸리고, 미승인 건은 날짜 필터에서 빠지지 않는다', async () => {
      const res = await get('seochoAdmin', '/payments?dateFrom=2026-10-09&dateTo=2026-10-09');
      expect(res.status).toBe(200);
      expect(ids(res)).toEqual([afterMidnight, pending].sort());
      expect(res.body.meta.total).toBe(2);
    });

    it('대조군: 전날(10-08) KST 23:30 승인 건은 10-08로 걸린다', async () => {
      const res = await get('seochoAdmin', '/payments?dateFrom=2026-10-08&dateTo=2026-10-08');
      expect(ids(res)).toEqual([beforeMidnight, pending].sort());
    });

    it('날짜 없이는 전부, 최근 결제부터 온다', async () => {
      const res = await get('seochoAdmin', '/payments');
      expect(res.body.meta.total).toBe(3);
      expect(res.body.data[0].id).toBe(pending); // 가장 나중에 만든 결제
    });

    it('형식이 틀린 날짜는 빈 목록이다(500이 아니다)', async () => {
      const res = await get('seochoAdmin', '/payments?dateFrom=2026-10-9');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });
  });
});
