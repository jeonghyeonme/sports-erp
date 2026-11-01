import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { todayKst } from '../src/common/date/kst-date';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { holdRowLock, waitForLockWaiters } from './helpers/row-lock';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D70 — 동시성 점검(log/194)에서 찾은 빈틈 두 가지를 실DB로 재현한다(계약 회차 번호 확인은 contract-renewal.spec).
 *
 * 1. 계약 종료 차단 검사: 신규 활동이 계약 상태를 트랜잭션 밖에서 읽으면, 진행 중인 종료 확정(커밋 전)을 ACTIVE로 읽고
 *    종료 뒤에 커밋돼 종료 지점에 새 행이 남는다. 고친 뒤에는 쓰기 트랜잭션 안에서 지점 행을 공유 락으로 읽어
 *    종료 확정이 커밋될 때까지 기다렸다가 TERMINATED를 보고 409를 낸다.
 * 2. 퇴사·파견 발령: 발령이 직원 행을 잠그지 않으면 커밋 전 퇴사를 ACTIVE로 읽고 발령해, 퇴사자에게 진행 중 파견이 남는다.
 *
 * 순서는 행 락으로 결정적으로 만든다(row-lock.ts) — 테스트가 지점·직원 행을 잡고 커밋 전 변경을 한 뒤, 요청이
 * 락에서 기다리는 것(고친 코드) 또는 요청이 먼저 끝나는 것(고치기 전 코드)을 확인하고 놓는다.
 */
describe('동시성 빈틈 (D70)', () => {
  let app: INestApplication;
  let admin: string; // 서초점 관리자
  let superAdmin: string;
  let member: string; // 서초점 회원 수진
  let slotId: string;

  const send = (auth: string, method: 'post', path: string, body: object) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', auth).send(body);

  /** 락을 잡은 채(커밋 전 변경 포함) 요청을 보내고, 요청이 락에서 기다리거나 먼저 끝나면 락을 놓는다. */
  async function raceAgainst(hold: { release: () => Promise<void> }, fire: () => request.Test) {
    const pending = fire().then((res) => res);
    await Promise.race([waitForLockWaiters(1), pending]);
    await hold.release();
    return pending;
  }

  const terminatingSeocho = () =>
    holdRowLock('Branch', BRANCH.seocho, (tx) =>
      tx.branch.update({ where: { id: BRANCH.seocho }, data: { contractStatus: 'TERMINATED' } }),
    );

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    admin = await login(app, ACCOUNTS.seochoAdmin);
    superAdmin = await login(app, ACCOUNTS.superAdmin);
    member = await login(app, ACCOUNTS.seochoMember);
    const slot = await db(app).scheduleSlot.findFirst({
      where: { program: { branchId: BRANCH.seocho, status: 'RUNNING' }, date: { gt: new Date(`${todayKst()}T00:00:00Z`) } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
    });
    if (!slot) throw new Error('테스트 전제 위반: 서초점 진행중 프로그램의 내일 이후 회차가 없다');
    slotId = slot.id;
  });
  afterEach(async () => {
    await app.close();
  });

  describe('1. 종료 확정과 겹친 신규 활동은 종료 지점에 남지 않는다(409 BRANCH_TERMINATED)', () => {
    const cases: Array<{
      name: string;
      fire: () => request.Test;
      count: () => Promise<number>;
    }> = [
      {
        name: '신규 회원 등록',
        fire: () => send(admin, 'post', '/members', { name: '경합회원' }),
        count: () => db(app).member.count({ where: { branchId: BRANCH.seocho } }),
      },
      {
        name: '예약 생성',
        fire: () => send(member, 'post', '/reservations', { scheduleSlotId: slotId }),
        count: () => db(app).reservation.count({ where: { scheduleSlotId: slotId } }),
      },
      {
        name: '수강 등록',
        fire: () => send(admin, 'post', '/members/member-sujin/enrollments', { programId: 'program-seocho-pilates', enrolledAt: todayKst() }),
        count: () => db(app).courseEnrollment.count({ where: { memberId: 'member-sujin' } }),
      },
      {
        name: 'PT 세션 등록',
        fire: () =>
          send(admin, 'post', '/members/member-sujin/pt-sessions', {
            programId: 'program-seocho-pilates',
            totalSessions: 10,
            purchasedAt: todayKst(),
          }),
        count: () => db(app).pTSession.count({ where: { memberId: 'member-sujin' } }),
      },
      {
        name: '게시글 작성',
        fire: () => send(admin, 'post', '/posts', { title: '경합', content: '경합 공지', category: 'NOTICE' }),
        count: () => db(app).post.count({ where: { branchId: BRANCH.seocho } }),
      },
      {
        name: '시설 등록',
        fire: () => send(admin, 'post', '/facilities', { name: '경합 시설', type: 'GYM', capacity: 10 }),
        count: () => db(app).facility.count({ where: { branchId: BRANCH.seocho } }),
      },
      {
        name: '혼잡도 수동 보정',
        fire: () => send(admin, 'post', '/facilities/facility-seocho-gym/congestion/manual', { currentCount: 7 }),
        count: async () => (await db(app).facility.findUniqueOrThrow({ where: { id: 'facility-seocho-gym' } })).currentCount === 7 ? 1 : 0,
      },
      {
        name: '자산 등록',
        fire: () =>
          send(admin, 'post', '/assets', { name: '경합 자산', category: 'OTHER', acquiredAt: '2026-09-25', acquisitionCost: 50000 }),
        count: () => db(app).asset.count({ where: { branchId: BRANCH.seocho } }),
      },
      {
        name: '문서 등록',
        fire: () => send(admin, 'post', '/documents', { category: 'MANUAL', title: '경합 문서', fileUrl: 'https://files.example/x.pdf' }),
        count: () => db(app).document.count({ where: { branchId: BRANCH.seocho } }),
      },
      {
        name: '업무지원 요청',
        fire: () => send(admin, 'post', '/support-requests', { category: 'OTHER', title: '경합', content: '경합 요청' }),
        count: () => db(app).supportRequest.count({ where: { branchId: BRANCH.seocho } }),
      },
    ];

    it.each(cases)('$name', async ({ fire, count }) => {
      const before = await count();
      const res = await raceAgainst(await terminatingSeocho(), fire);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
      expect(await count()).toBe(before);
    });

    it('대조군 — 종료가 아닌 상태 변경(만료)과 겹치면 기다렸다가 그대로 등록된다', async () => {
      const hold = await holdRowLock('Branch', BRANCH.seocho, (tx) =>
        tx.branch.update({ where: { id: BRANCH.seocho }, data: { contractStatus: 'EXPIRED' } }),
      );
      const res = await raceAgainst(hold, () => send(admin, 'post', '/members', { name: '대조군회원' }));
      expect(res.status).toBe(201);
    });
  });

  describe('2. 퇴사와 파견 발령은 같은 직원 행에서 줄을 선다', () => {
    const STAFF = 'staff-seoyeon'; // 서초점 트레이너, 진행 중 파견 1건
    const openAssignments = () => db(app).staffAssignment.count({ where: { staffId: STAFF, endDate: null } });

    it('커밋 전 퇴사와 겹친 발령은 퇴사를 보고 409 — 퇴사자에게 진행 중 파견이 남지 않는다', async () => {
      const today = new Date(`${todayKst()}T00:00:00Z`);
      const resigning = await holdRowLock('Staff', STAFF, async (tx) => {
        await tx.staff.update({ where: { id: STAFF }, data: { status: 'RESIGNED', resignDate: today } });
        await tx.staffAssignment.updateMany({ where: { staffId: STAFF, endDate: null }, data: { endDate: today } });
      });
      const res = await raceAgainst(resigning, () =>
        send(superAdmin, 'post', `/staff/${STAFF}/assignments`, { branchId: BRANCH.gangnam }),
      );
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('STAFF_ALREADY_RESIGNED');
      expect(await openAssignments()).toBe(0);
      expect((await db(app).staff.findUniqueOrThrow({ where: { id: STAFF } })).branchId).toBe(BRANCH.seocho);
    });

    it('같은 직원을 동시에 두 번 발령해도 500 없이 차례로 처리되고 진행 중 파견은 1건이다', async () => {
      const [a, b] = await Promise.all([
        send(superAdmin, 'post', `/staff/${STAFF}/assignments`, { branchId: BRANCH.gangnam }),
        send(superAdmin, 'post', `/staff/${STAFF}/assignments`, { branchId: BRANCH.gangnam }),
      ]);
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(await openAssignments()).toBe(1);
    });
  });
});
