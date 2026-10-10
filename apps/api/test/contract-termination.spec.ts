import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BranchContractStatus } from '@prisma/client';
import { todayKst, toKstDateString } from '../src/common/date/kst-date';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { setBranchStatus } from './helpers/branch-status';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * 위탁계약 종료(TERMINATED) 지점의 신규 활동 차단 — entities.md §2-1 "TERMINATED 전이가 하위 도메인에 미치는 영향".
 * - 차단 대상은 TERMINATED뿐이다. EXPIRED(만료)·RENEWAL_DUE(갱신임박)는 차단하지 않는다.
 * - 과거 데이터(회원·게시글·예약 이력) 조회는 유지한다(소프트 삭제 원칙).
 * MockDataService가 인메모리 상태를 가지므로 테스트마다 새 앱을 띄운다.
 */
describe('위탁계약 종료 지점의 신규 활동 차단', () => {
  let app: INestApplication;
  let admin: string; // 서초점 관리자
  let superAdmin: string; // 본사 — 채용·파견 발령(log/090)
  let member: string; // 서초점 회원 수진
  let slotId: string;

  // D29 — 계약 상태의 원천은 DB다. 바꾼 값은 setup/after-env.ts가 매 테스트 뒤에 되돌린다.
  const setSeochoStatus = (status: BranchContractStatus) => setBranchStatus(BRANCH.seocho, status);
  const api = (auth: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth),
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
    patch: (p: string, b?: object) => request(app.getHttpServer()).patch(`/api/v1${p}`).set('Authorization', auth).send(b),
  });

  beforeEach(async () => {
    // D32 — 회원·예약이 DB에 남으므로(예: "예약 이력 1건" 기대) 테스트마다 워커 DB를 새로 만든다.
    await resetWorkerDb();
    app = await createApp();
    admin = await login(app, ACCOUNTS.seochoAdmin);
    superAdmin = await login(app, ACCOUNTS.superAdmin);
    member = await login(app, ACCOUNTS.seochoMember);
    const slot = await db(app).scheduleSlot.findFirst({
      where: { program: { branchId: BRANCH.seocho, status: 'RUNNING' } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
    });
    if (!slot) throw new Error('테스트 전제 위반: 서초점 진행중 프로그램의 회차가 없다');
    slotId = slot.id;
  });
  afterEach(async () => {
    await app.close();
  });

  describe('TERMINATED: 신규 활동은 409 BRANCH_TERMINATED', () => {
    beforeEach(() => setSeochoStatus('TERMINATED'));

    it('신규 회원 등록', async () => {
      const res = await api(admin).post('/members', { name: '신규회원' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
    });
    it('예약 생성', async () => {
      const res = await api(member).post('/reservations', { scheduleSlotId: slotId });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
    });
    it('게시글 신규 작성', async () => {
      const res = await api(admin).post('/posts', { title: 't', content: 'c', category: 'NOTICE' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
    });
    it('시설 신규 등록 (ADR-FAC-03)', async () => {
      const res = await api(admin).post('/facilities', { name: '신규 시설', type: 'GYM', capacity: 10 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
    });
    it('혼잡도 수동 보정 (ADR-FAC-03)', async () => {
      const res = await api(admin).post('/facilities/facility-seocho-gym/congestion/manual', { currentCount: 5 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
    });
    it('자산 신규 등록 (ADR-RES-01)', async () => {
      const res = await api(admin).post('/assets', {
        name: '신규 자산',
        category: 'OTHER',
        acquiredAt: '2026-09-25',
        acquisitionCost: 50000,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
    });
    it('문서 신규 업로드 (ADR-RES-01)', async () => {
      const res = await api(admin).post('/documents', {
        category: 'MANUAL',
        title: '신규 문서',
        fileUrl: 'https://files.example/x.pdf',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
    });
    it('직원 채용(최초 파견) — log/090', async () => {
      const res = await api(superAdmin).post('/staff', { branchId: BRANCH.seocho, name: '신규직원', email: 'new.hire@spoism.example' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
    });
    it('종료 지점으로 파견 발령 — log/090', async () => {
      const res = await api(superAdmin).post('/staff/staff-choi/assignments', { branchId: BRANCH.seocho });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
    });
    it('종료 지점에서 다른 지점으로 빼내는 파견은 막지 않는다 — 재배치는 종료 후 해야 할 일이다', async () => {
      const res = await api(superAdmin).post('/staff/staff-seoyeon/assignments', { branchId: BRANCH.gangnam });
      expect(res.status).toBe(201);
    });
    it('차단된 요청은 데이터를 남기지 않는다', async () => {
      const prisma = db(app);
      const counts = async () => [
        await prisma.member.count(),
        await prisma.reservation.count(),
        await prisma.post.count(), // D36 — 게시글 원천은 DB
        await prisma.facility.count(),
        await prisma.asset.count(), // D35 — 자산 원천은 DB
        await prisma.document.count(), // D34 — 문서 원천은 DB
        await prisma.staff.count(),
        await prisma.staffAssignment.count(),
        await prisma.account.count(),
      ];
      const before = await counts();
      await api(admin).post('/members', { name: '신규회원' });
      await api(member).post('/reservations', { scheduleSlotId: slotId });
      await api(admin).post('/posts', { title: 't', content: 'c', category: 'NOTICE' });
      await api(admin).post('/facilities', { name: '신규 시설', type: 'GYM', capacity: 10 });
      await api(admin).post('/assets', {
        name: '신규 자산',
        category: 'OTHER',
        acquiredAt: '2026-09-25',
        acquisitionCost: 50000,
      });
      await api(admin).post('/documents', {
        category: 'MANUAL',
        title: '신규 문서',
        fileUrl: 'https://files.example/x.pdf',
      });
      await api(superAdmin).post('/staff', { branchId: BRANCH.seocho, name: '신규직원', email: 'new.hire@spoism.example' });
      await api(superAdmin).post('/staff/staff-choi/assignments', { branchId: BRANCH.seocho });
      expect(await counts()).toEqual(before);
    });
  });

  describe('TERMINATED: 과거 데이터 조회는 유지된다', () => {
    beforeEach(() => setSeochoStatus('TERMINATED'));

    it('회원 목록·상세', async () => {
      const list = await api(admin).get('/members');
      expect(list.status).toBe(200);
      expect(list.body.data.length).toBeGreaterThan(0);
      expect((await api(admin).get(`/members/${list.body.data[0].id}`)).status).toBe(200);
    });
    it('게시글 열람', async () => {
      const res = await api(admin).get('/posts');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
    it('시설 목록 조회 (ADR-FAC-03)', async () => {
      const res = await api(admin).get('/facilities?branchId=branch-seocho');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
    it('기존 시설 정정(수정)은 "신규 활동"이 아니라 차단하지 않는다 (ADR-FAC-03)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/facilities/facility-seocho-gym')
        .set('Authorization', admin)
        .send({ name: '서초점 헬스장(개편)' });
      expect(res.status).toBe(200);
    });
    it('자산 목록 조회 (ADR-RES-01)', async () => {
      const res = await api(admin).get('/assets?branchId=branch-seocho');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
    it('문서 목록 조회 (ADR-RES-01)', async () => {
      const res = await api(admin).get('/documents?branchId=branch-seocho');
      expect(res.status).toBe(200);
    });
    it('기존 자산 정정(수정)은 "신규 활동"이 아니라 차단하지 않는다 (ADR-RES-01)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/assets/asset-seocho-treadmill')
        .set('Authorization', admin)
        .send({ note: '점검 완료' });
      expect(res.status).toBe(200);
    });
    it('branchId=null 전사 문서 업로드는 특정 지점 계약상태와 무관해 차단되지 않는다 (ADR-RES-01)', async () => {
      const superAdmin = await login(app, ACCOUNTS.superAdmin);
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set('Authorization', superAdmin)
        .send({ category: 'MANUAL', title: '전사 매뉴얼', fileUrl: 'https://files.example/manual.pdf' });
      expect(res.status).toBe(201);
      expect(res.body.data.branchId).toBeUndefined();
    });
    it('기존 예약 이력 조회', async () => {
      await setSeochoStatus('ACTIVE'); // 예약은 활성 상태에서 만들고
      expect((await api(member).post('/reservations', { scheduleSlotId: slotId })).status).toBe(201);
      await setSeochoStatus('TERMINATED'); // 종료된 뒤에도 이력은 보인다
      const res = await api(member).get('/reservations');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe.each<BranchContractStatus>(['ACTIVE', 'RENEWAL_DUE', 'EXPIRED'])('%s: 차단하지 않는다', (status) => {
    beforeEach(() => setSeochoStatus(status));

    it('신규 회원 등록', async () => {
      expect((await api(admin).post('/members', { name: '신규회원' })).status).toBe(201);
    });
    it('예약 생성', async () => {
      expect((await api(member).post('/reservations', { scheduleSlotId: slotId })).status).toBe(201);
    });
    it('게시글 신규 작성', async () => {
      expect((await api(admin).post('/posts', { title: 't', content: 'c', category: 'NOTICE' })).status).toBe(201);
    });
    it('시설 신규 등록 (ADR-FAC-03)', async () => {
      const res = await api(admin).post('/facilities', { name: '신규 시설', type: 'GYM', capacity: 10 });
      expect(res.status).toBe(201);
    });
    it('혼잡도 수동 보정 (ADR-FAC-03)', async () => {
      const res = await api(admin).post('/facilities/facility-seocho-gym/congestion/manual', { currentCount: 5 });
      expect(res.status).toBe(201);
    });
    it('자산 신규 등록 (ADR-RES-01)', async () => {
      const res = await api(admin).post('/assets', {
        name: '신규 자산',
        category: 'OTHER',
        acquiredAt: '2026-09-25',
        acquisitionCost: 50000,
      });
      expect(res.status).toBe(201);
    });
    it('문서 신규 업로드 (ADR-RES-01)', async () => {
      const res = await api(admin).post('/documents', {
        category: 'MANUAL',
        title: '신규 문서',
        fileUrl: 'https://files.example/x.pdf',
      });
      expect(res.status).toBe(201);
    });
    it('직원 채용(최초 파견) — log/090', async () => {
      expect((await api(superAdmin).post('/staff', { branchId: BRANCH.seocho, name: '신규직원', email: 'new.hire@spoism.example' })).status).toBe(201);
    });
  });

  // entities.md §2-1: "TERMINATED 지점에 현재 파견 중(StaffAssignment.endDate=null)인 직원이 있으면
  // 그 파견을 종료 처리하고 본사가 재배치할 대상 목록에 올려야 함" — ADR-STF-07(PATCH /branches/:id/contract-status).
  describe('TERMINATED 전이 시 진행 중 파견 자동 종료 (ADR-STF-07)', () => {
    const changeStatus = (auth: string, status: BranchContractStatus, branchId: string = BRANCH.seocho) =>
      api(auth).patch(`/branches/${branchId}/contract-status`, { status });
    const openAtSeocho = () => db(app).staffAssignment.findMany({ where: { branchId: BRANCH.seocho, endDate: null } });

    it('파견을 오늘 날짜로 종료하고, 재배치 대상·담당 해제 회원을 돌려주고, 담당·강사 연결을 같은 트랜잭션에서 푼다', async () => {
      const prisma = db(app);
      const before = await openAtSeocho();
      // 전제: 서초점에 진행 중 파견 2건(민수·서연), 서연은 담당 회원 1명·강사 프로필 1개
      expect(before.map((a) => a.staffId).sort()).toEqual(['staff-minsu', 'staff-seoyeon']);
      expect(await prisma.member.count({ where: { assignedStaffId: 'staff-seoyeon' } })).toBe(1);
      expect(await prisma.instructor.count({ where: { staffId: 'staff-seoyeon' } })).toBe(1);

      const res = await changeStatus(superAdmin, 'TERMINATED');
      expect(res.status).toBe(200);
      expect(res.body.data.contractStatus).toBe('TERMINATED');
      expect(res.body.data.previousStatus).not.toBe('TERMINATED');
      expect(res.body.data.reassignmentTargets.map((s: { id: string }) => s.id)).toEqual(['staff-minsu', 'staff-seoyeon']);
      expect(res.body.data.unassignedMembers).toHaveLength(1);
      expect(res.body.data.unassignedMembers[0].staffId).toBe('staff-seoyeon');

      expect(await openAtSeocho()).toHaveLength(0);
      const ended = await prisma.staffAssignment.findMany({ where: { id: { in: before.map((a) => a.id) } } });
      expect(ended.map((a) => toKstDateString(a.endDate!))).toEqual([todayKst(), todayKst()]);
      expect(await prisma.member.count({ where: { assignedStaffId: 'staff-seoyeon' } })).toBe(0);
      expect(await prisma.instructor.count({ where: { staffId: 'staff-seoyeon' } })).toBe(0);
      // 퇴사가 아니다 — 재직 상태·계정·Staff.branchId(재배치 대기 표시)는 그대로
      const seoyeon = await prisma.staff.findUniqueOrThrow({ where: { id: 'staff-seoyeon' }, include: { account: true } });
      expect(seoyeon.status).toBe('ACTIVE');
      expect(seoyeon.account.isActive).toBe(true);
      expect(seoyeon.branchId).toBe(BRANCH.seocho);
      // D44 — 직원별 이력 2건, 처리자는 본사 관리자
      const audits = await prisma.auditLog.findMany({ where: { action: 'ASSIGNMENT_ENDED' } });
      expect(audits.map((a) => a.entityId).sort()).toEqual(['staff-minsu', 'staff-seoyeon']);
      expect(audits.every((a) => a.actorId === 'account-haneul')).toBe(true);
    });

    it('재배치 대상 직원은 본사가 다른 지점으로 발령할 수 있다(빼내는 발령 허용, ADR-STF-05)', async () => {
      await changeStatus(superAdmin, 'TERMINATED');
      const res = await api(superAdmin).post('/staff/staff-seoyeon/assignments', { branchId: BRANCH.gangnam });
      expect(res.status).toBe(201);
      expect(res.body.data.branchId).toBe(BRANCH.gangnam);
      const open = await db(app).staffAssignment.findMany({ where: { staffId: 'staff-seoyeon', endDate: null } });
      expect(open.map((a) => a.branchId)).toEqual([BRANCH.gangnam]);
    });

    describe.each<BranchContractStatus>(['RENEWAL_DUE', 'EXPIRED'])('대조군 — %s 전이는 파견을 건드리지 않는다', (status) => {
      it('진행 중 파견·담당 회원·강사 연결·이력 모두 그대로', async () => {
        const prisma = db(app);
        const res = await changeStatus(superAdmin, status);
        expect(res.status).toBe(200);
        expect(res.body.data.contractStatus).toBe(status);
        expect(res.body.data.reassignmentTargets).toEqual([]);
        expect(await openAtSeocho()).toHaveLength(2);
        expect(await prisma.member.count({ where: { assignedStaffId: 'staff-seoyeon' } })).toBe(1);
        expect(await prisma.instructor.count({ where: { staffId: 'staff-seoyeon' } })).toBe(1);
        expect(await prisma.auditLog.count({ where: { action: 'ASSIGNMENT_ENDED' } })).toBe(0);
      });
    });

    it('이미 TERMINATED인 지점을 다시 TERMINATED로 지정하면 전이가 아니므로 아무것도 종료하지 않는다', async () => {
      await setSeochoStatus('TERMINATED'); // 테스트용으로 상태만 바꾼다(파견은 열린 채)
      const res = await changeStatus(superAdmin, 'TERMINATED');
      expect(res.status).toBe(200);
      expect(res.body.data.reassignmentTargets).toEqual([]);
      expect(await openAtSeocho()).toHaveLength(2);
    });

    it('지점 관리자는 자기 지점이라도 계약 상태를 바꿀 수 없다(403) — 대조군은 위의 본사 200', async () => {
      const res = await changeStatus(admin, 'TERMINATED');
      expect(res.status).toBe(403);
      expect(await openAtSeocho()).toHaveLength(2);
      expect((await db(app).branch.findUniqueOrThrow({ where: { id: BRANCH.seocho } })).contractStatus).not.toBe('TERMINATED');
    });

    it('잘못된 상태 값은 400, 없는 지점은 404', async () => {
      expect((await api(superAdmin).patch(`/branches/${BRANCH.seocho}/contract-status`, { status: 'CLOSED' })).status).toBe(400);
      const res = await changeStatus(superAdmin, 'TERMINATED', 'branch-nope');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('BRANCH_NOT_FOUND');
    });

    it('종료 전이와 동시에 들어온 발령이 종료 지점에 활성 파견을 남기지 않는다(지점 행 락, 실DB 동시성)', async () => {
      const others = await db(app).staff.findMany({
        where: { status: 'ACTIVE', branchId: { not: BRANCH.seocho } },
        orderBy: { staffCode: 'asc' },
        take: 6,
      });
      const assigns = others.map((s) => api(superAdmin).post(`/staff/${s.id}/assignments`, { branchId: BRANCH.seocho }));
      const [terminate, ...results] = await Promise.all([changeStatus(superAdmin, 'TERMINATED'), ...assigns]);
      expect(terminate.status).toBe(200);
      // 각 발령은 종료 전에 커밋돼 종료 대상이 되거나(201), 종료 뒤라 거부된다(409) — 어느 쪽이든 결과는 같다.
      for (const r of results) expect([201, 409]).toContain(r.status);
      expect(await openAtSeocho()).toHaveLength(0);
      const committedBefore = results.filter((r) => r.status === 201).length;
      expect(terminate.body.data.reassignmentTargets).toHaveLength(2 + committedBefore);
    });
  });
  // ADR-STF-08 — 재배치 대기 목록(GET /staff?unassigned=true)과 본사의 계약 종료 지점 직원 퇴사(ADR-AUTH-02 수동 비활성화).
  describe('재배치 대기와 종료 지점 직원 퇴사 (ADR-STF-08)', () => {
    const unassigned = async (auth: string) => {
      const res = await api(auth).get('/staff?unassigned=true');
      expect(res.status).toBe(200);
      return (res.body.data as Array<{ id: string; branchId: string }>).map((s) => s.id);
    };
    const SEED_TERMINATED_STAFF = ['staff-gen-094-1', 'staff-gen-095-1', 'staff-gen-095-2', 'staff-gen-096-1', 'staff-gen-096-2', 'staff-gen-096-3'];

    it('시드의 계약 종료 지점에는 진행 중 파견·담당 회원이 없고, 그 직원들이 재배치 대기로 보인다', async () => {
      const prisma = db(app);
      const terminated = { branch: { contractStatus: 'TERMINATED' as const } };
      expect(await prisma.staffAssignment.count({ where: { endDate: null, ...terminated } })).toBe(0);
      expect(await prisma.member.count({ where: { assignedStaffId: { not: null }, ...terminated } })).toBe(0);
      expect((await unassigned(superAdmin)).sort()).toEqual(SEED_TERMINATED_STAFF);
    });

    it('종료 전이 후 그 지점 직원이 재배치 대기에 더해지고, 다시 발령하면 빠진다', async () => {
      expect(await unassigned(superAdmin)).not.toContain('staff-seoyeon');
      await api(superAdmin).patch(`/branches/${BRANCH.seocho}/contract-status`, { status: 'TERMINATED' });
      const after = await unassigned(superAdmin);
      expect(after).toEqual(expect.arrayContaining(['staff-minsu', 'staff-seoyeon', ...SEED_TERMINATED_STAFF]));
      expect(after).toHaveLength(SEED_TERMINATED_STAFF.length + 2);
      expect((await api(superAdmin).post('/staff/staff-seoyeon/assignments', { branchId: BRANCH.gangnam })).status).toBe(201);
      expect(await unassigned(superAdmin)).not.toContain('staff-seoyeon');
    });

    it('지점 관리자는 자기 지점 재배치 대기만 본다(다른 지점 대기 인원은 안 보인다)', async () => {
      expect(await unassigned(admin)).toEqual([]);
      await api(superAdmin).patch(`/branches/${BRANCH.seocho}/contract-status`, { status: 'TERMINATED' });
      expect((await unassigned(admin)).sort()).toEqual(['staff-minsu', 'staff-seoyeon']);
    });

    it('본사는 운영 중인 지점 직원을 퇴사시킬 수 없다(403, 지점 관리자의 일)', async () => {
      const res = await api(superAdmin).patch('/staff/staff-seoyeon/resign');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('RESIGN_BY_BRANCH_ADMIN');
      expect((await db(app).staff.findUniqueOrThrow({ where: { id: 'staff-seoyeon' } })).status).toBe('ACTIVE');
    });

    it('본사는 계약 종료 지점 직원을 퇴사 처리해 계정을 비활성화한다 — 재배치 대기에서도 빠진다', async () => {
      await api(superAdmin).patch(`/branches/${BRANCH.seocho}/contract-status`, { status: 'TERMINATED' });
      const res = await api(superAdmin).patch('/staff/staff-seoyeon/resign');
      expect(res.status).toBe(200);
      const seoyeon = await db(app).staff.findUniqueOrThrow({ where: { id: 'staff-seoyeon' }, include: { account: true } });
      expect(seoyeon.status).toBe('RESIGNED');
      expect(seoyeon.account.isActive).toBe(false);
      expect(await unassigned(superAdmin)).not.toContain('staff-seoyeon');
      const audit = await db(app).auditLog.findFirst({ where: { action: 'RESIGNED', entityId: 'staff-seoyeon' } });
      expect(audit?.actorId).toBe('account-haneul');
    });
  });
});
