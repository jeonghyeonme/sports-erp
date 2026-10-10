import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';

/**
 * 지점 데이터 격리 — 원본 RFP 핵심 요구사항("타 지점 조회 불가", CLAUDE.md 프로젝트 가드레일).
 *
 * 격리는 전역 BranchScopeGuard 한 곳이 본다(D46) — branchId 파라미터·쿼리 + @ScopedResource로 선언한 리소스의
 * 소유 지점. 선언이 빠진 라우트는 branch-scope-coverage.spec.ts가 잡고, 여기서는 실제 요청으로 거부되는지 확인한다.
 * 이 테스트는 "의도된 규칙"(타 지점 접근 불가)을 검증한다. 현재 동작에 맞추려고 기대값을 바꾸지 말 것.
 */

type Method = 'get' | 'post' | 'patch' | 'delete';
interface Ctx {
  seocho: {
    memberId: string;
    staffId: string;
    programId: string;
    slotId: string;
    facilityId: string;
    instructorId: string;
    assetId: string;
    documentId: string;
    postId: string;
    reservationId: string;
    leaveId: string;
    ids: string[]; // 서초점 소유 리소스 id 전체 (목록 누수 스캔용)
  };
  gangnam: { memberId: string; staffId: string; programId: string; facilityId: string; ids: string[] };
}
interface Attack {
  name: string;
  method: Method;
  path: (c: Ctx) => string;
  body?: (c: Ctx) => Record<string, unknown>;
}

const FOREIGN = [403, 404]; // 타 지점 리소스: 거부(403) 또는 존재 은닉(404). 200/400/409 등은 실패.

describe('지점 데이터 격리', () => {
  let app: INestApplication;
  let ctx: Ctx;
  const tok: Record<string, string> = {};

  const call = (auth: string, method: Method, path: string, body?: Record<string, unknown>) => {
    const r = request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', auth);
    return body ? r.send(body) : r;
  };

  beforeAll(async () => {
    app = await createApp();
    // 모든 픽스처의 원천은 DB다(D32 회원·카탈로그, D34 직원·문서, D35 자산, D36 게시글).
    const prisma = db(app);
    const [members, programs, facilities, instructors, staff, documents, assets, posts] = await Promise.all([
      prisma.member.findMany({ orderBy: { memberNo: 'asc' } }),
      prisma.program.findMany({ orderBy: { id: 'asc' } }),
      prisma.facility.findMany({ orderBy: { id: 'asc' } }),
      prisma.instructor.findMany({ orderBy: { id: 'asc' } }),
      prisma.staff.findMany(), // 예전 직원 미러와 같은 순서(미러는 이 조회로 채워졌다)
      prisma.document.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } }),
      prisma.asset.findMany({ orderBy: { assetCode: 'asc' } }), // 예전 mock 배열 순서(시드 A001→)와 같다
      prisma.post.findMany({ where: { deletedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }), // mock 배열 순서(등록순)
    ]);
    for (const [k, email] of Object.entries(ACCOUNTS)) tok[k] = await login(app, email);

    const first = <T extends { branchId?: string | null }>(arr: T[], branchId: string, what: string): T => {
      const found = arr.find((x) => x.branchId === branchId);
      if (!found) throw new Error(`테스트 전제 위반: ${branchId}에 ${what} 시드 데이터가 없다`);
      return found;
    };
    const seochoProgramIds = programs.filter((p) => p.branchId === BRANCH.seocho).map((p) => p.id);
    const seochoSlots = await prisma.scheduleSlot.findMany({
      where: { programId: { in: seochoProgramIds } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
    });
    const slot = seochoSlots[0];
    if (!slot) throw new Error('테스트 전제 위반: 서초점 회차(slot) 시드 데이터가 없다');
    const runningSeochoProgram = programs.find((p) => p.id === slot.programId)!;

    // 예약·휴가·근태·업무일지는 시드에 없어 실제 API로 만든다(서초점 소속 계정으로).
    const resv = await call(tok.seochoMember, 'post', '/reservations', { scheduleSlotId: slot.id });
    if (resv.status !== 201) throw new Error(`픽스처 실패(예약 생성): ${resv.status} ${JSON.stringify(resv.body)}`);
    const leave = await call(tok.seochoStaff, 'post', '/leave-requests', {
      type: 'ANNUAL',
      startDate: '2026-12-01',
      endDate: '2026-12-02',
    });
    if (leave.status !== 201) throw new Error(`픽스처 실패(휴가 신청): ${leave.status} ${JSON.stringify(leave.body)}`);
    await call(tok.seochoStaff, 'post', '/attendance/check-in');
    await call(tok.seochoStaff, 'post', '/work-logs', { date: '2026-09-20', content: '격리 테스트 업무일지' });

    const seochoStaff = first(staff, BRANCH.seocho, '직원');
    const seochoMember = first(members, BRANCH.seocho, '회원');
    const seochoFacility = first(facilities, BRANCH.seocho, '시설');
    const seochoInstructor = first(instructors, BRANCH.seocho, '강사');
    const seochoAsset = first(assets, BRANCH.seocho, '자산');
    const seochoDoc = first(documents, BRANCH.seocho, '문서');
    const seochoPost = first(posts, BRANCH.seocho, '게시글');

    const gm = first(members, BRANCH.gangnam, '회원');
    const gs = first(staff, BRANCH.gangnam, '직원');
    const gp = first(programs, BRANCH.gangnam, '프로그램');
    const gf = first(facilities, BRANCH.gangnam, '시설');

    const ownedBy = (branchId: string) =>
      [
        ...members, ...staff, ...programs, ...facilities, ...instructors,
        ...assets, ...documents, ...posts,
      ]
        .filter((x) => (x.branchId ?? undefined) === branchId)
        .map((x) => x.id);

    ctx = {
      seocho: {
        memberId: seochoMember.id,
        staffId: seochoStaff.id,
        programId: runningSeochoProgram.id,
        slotId: slot.id,
        facilityId: seochoFacility.id,
        instructorId: seochoInstructor.id,
        assetId: seochoAsset.id,
        documentId: seochoDoc.id,
        postId: seochoPost.id,
        reservationId: resv.body.data.reservation?.id ?? resv.body.data.id,
        leaveId: leave.body.data.id,
        ids: [...ownedBy(BRANCH.seocho), ...seochoSlots.map((s) => s.id)],
      },
      gangnam: { memberId: gm.id, staffId: gs.id, programId: gp.id, facilityId: gf.id, ids: ownedBy(BRANCH.gangnam) },
    };
    ctx.seocho.ids.push(ctx.seocho.reservationId, ctx.seocho.leaveId);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 양성 대조군: 자기 지점은 접근된다(이게 깨지면 아래 403 테스트가 공허하게 통과할 수 있다) ─────────
  describe('대조군: 자기 지점 리소스는 접근 가능', () => {
    it('서초 관리자는 서초 회원 상세를 조회한다', async () => {
      const res = await call(tok.seochoAdmin, 'get', `/members/${ctx.seocho.memberId}`);
      expect(res.status).toBe(200);
    });
    it('강남 관리자는 강남 회원 상세를 조회한다', async () => {
      const res = await call(tok.gangnamAdmin, 'get', `/members/${ctx.gangnam.memberId}`);
      expect(res.status).toBe(200);
    });
    it('본사 관리자는 두 지점 회원을 모두 조회한다', async () => {
      expect((await call(tok.superAdmin, 'get', `/members/${ctx.seocho.memberId}`)).status).toBe(200);
      expect((await call(tok.superAdmin, 'get', `/members/${ctx.gangnam.memberId}`)).status).toBe(200);
    });
    // 프로그램 회차 조회(강사프로그램게시 A-7 "본인 지점만 노출")의 대조군 — 자기 지점·본사는 조회되고 회원도 본인 지점은 조회된다.
    it('서초 관리자·서초 회원은 서초점 프로그램 회차를 조회한다', async () => {
      const path = `/programs/${ctx.seocho.programId}/slots`;
      expect((await call(tok.seochoAdmin, 'get', path)).status).toBe(200);
      expect((await call(tok.seochoMember, 'get', path)).status).toBe(200);
    });
    it('본사 관리자는 어느 지점의 프로그램 회차든 조회한다', async () => {
      expect((await call(tok.superAdmin, 'get', `/programs/${ctx.seocho.programId}/slots`)).status).toBe(200);
      expect((await call(tok.superAdmin, 'get', `/programs/${ctx.gangnam.programId}/slots`)).status).toBe(200);
    });
  });

  // ── 강남 관리자 → 서초 리소스 (서초점이 전 도메인 데이터를 가지고 있어 주력 시나리오) ──────────────
  const attacksOnSeocho: Attack[] = [
    { name: '회원 상세 조회', method: 'get', path: (c) => `/members/${c.seocho.memberId}` },
    { name: '회원 수정', method: 'patch', path: (c) => `/members/${c.seocho.memberId}`, body: () => ({ memo: 'x' }) },
    { name: '회원 상태 변경', method: 'patch', path: (c) => `/members/${c.seocho.memberId}/status`, body: () => ({ status: 'ACTIVE' }) },
    { name: '직원 상세 조회', method: 'get', path: (c) => `/staff/${c.seocho.staffId}` },
    { name: '직원 수정', method: 'patch', path: (c) => `/staff/${c.seocho.staffId}`, body: () => ({ position: 'x' }) },
    { name: '직원 퇴사 처리', method: 'patch', path: (c) => `/staff/${c.seocho.staffId}/resign` },
    { name: '직원 파견 이력 조회', method: 'get', path: (c) => `/staff/${c.seocho.staffId}/assignments` },
    { name: '프로그램 수정', method: 'patch', path: (c) => `/programs/${c.seocho.programId}`, body: () => ({ description: 'x' }) },
    { name: '프로그램 상태 변경', method: 'patch', path: (c) => `/programs/${c.seocho.programId}/status`, body: () => ({ status: 'RUNNING' }) },
    { name: '프로그램 종료(삭제)', method: 'delete', path: (c) => `/programs/${c.seocho.programId}` },
    { name: '프로그램 회차 조회', method: 'get', path: (c) => `/programs/${c.seocho.programId}/slots` },
    {
      name: '프로그램 회차 등록',
      method: 'post',
      path: (c) => `/programs/${c.seocho.programId}/slots`,
      body: () => ({ date: '2026-12-01', startTime: '10:00', endTime: '11:00' }),
    },
    { name: '시설 수정', method: 'patch', path: (c) => `/facilities/${c.seocho.facilityId}`, body: () => ({ capacity: 10 }) },
    { name: '혼잡도 수동 보정', method: 'post', path: (c) => `/facilities/${c.seocho.facilityId}/congestion/manual`, body: () => ({ currentCount: 1 }) },
    { name: '강사 수정', method: 'patch', path: (c) => `/instructors/${c.seocho.instructorId}`, body: () => ({ bio: 'x' }) },
    { name: '강사 삭제', method: 'delete', path: (c) => `/instructors/${c.seocho.instructorId}` },
    { name: '자산 수정', method: 'patch', path: (c) => `/assets/${c.seocho.assetId}`, body: () => ({ note: 'x' }) },
    { name: '자산 상태 변경', method: 'patch', path: (c) => `/assets/${c.seocho.assetId}/status`, body: () => ({ status: 'NORMAL' }) },
    { name: '문서 상세 조회', method: 'get', path: (c) => `/documents/${c.seocho.documentId}` },
    { name: '예약 취소', method: 'patch', path: (c) => `/reservations/${c.seocho.reservationId}/cancel`, body: () => ({}) },
    { name: '예약 체크인', method: 'patch', path: (c) => `/reservations/${c.seocho.reservationId}/check-in` },
    { name: '직원 근태 조회', method: 'get', path: (c) => `/attendance?staffId=${c.seocho.staffId}` },
    { name: '직원 휴가 잔여 조회', method: 'get', path: (c) => `/leave-balance/${c.seocho.staffId}` },
    { name: '직원 휴가 신청 목록 조회', method: 'get', path: (c) => `/leave-requests?staffId=${c.seocho.staffId}` },
    { name: '휴가 승인', method: 'patch', path: (c) => `/leave-requests/${c.seocho.leaveId}/approve` },
    { name: '휴가 반려', method: 'patch', path: (c) => `/leave-requests/${c.seocho.leaveId}/reject`, body: () => ({ reason: 'x' }) },
    { name: '직원 업무일지 조회', method: 'get', path: (c) => `/work-logs?staffId=${c.seocho.staffId}` },
    { name: '게시글 상세 조회', method: 'get', path: (c) => `/posts/${c.seocho.postId}` },
    { name: '게시글 수정', method: 'patch', path: (c) => `/posts/${c.seocho.postId}`, body: () => ({ title: 'x' }) },
    { name: '게시글 삭제', method: 'delete', path: (c) => `/posts/${c.seocho.postId}` },
    { name: '서초점 프로그램 요약 조회', method: 'get', path: () => `/branches/${BRANCH.seocho}/programs/summary` },
    // D44 — 변경 이력은 본사 감사 기록이라 지점 관리자는 자기 지점 직원 것도 볼 수 없다(403).
    { name: '서초 직원 변경 이력 조회', method: 'get', path: (c) => `/audit-logs?entity=Staff&entityId=${c.seocho.staffId}` },
    // 목록 API에 타 지점 branchId를 직접 지정하는 시도
    { name: '회원 목록(branchId=서초)', method: 'get', path: () => `/members?branchId=${BRANCH.seocho}` },
    { name: '직원 목록(branchId=서초)', method: 'get', path: () => `/staff?branchId=${BRANCH.seocho}` },
    { name: '프로그램 목록(branchId=서초)', method: 'get', path: () => `/programs?branchId=${BRANCH.seocho}` },
    { name: '시설 목록(branchId=서초)', method: 'get', path: () => `/facilities?branchId=${BRANCH.seocho}` },
    { name: '강사 목록(branchId=서초)', method: 'get', path: () => `/instructors?branchId=${BRANCH.seocho}` },
    // D46 — 전역 가드 전에는 이 라우트들이 남의 branchId를 조용히 본인 지점으로 바꿨다. 이제는 명시적으로 거부한다.
    { name: '자산 목록(branchId=서초)', method: 'get', path: () => `/assets?branchId=${BRANCH.seocho}` },
    { name: '문서 목록(branchId=서초)', method: 'get', path: () => `/documents?branchId=${BRANCH.seocho}` },
    { name: '결제 목록(branchId=서초)', method: 'get', path: () => `/payments?branchId=${BRANCH.seocho}` },
    { name: '근태 요약(branchId=서초)', method: 'get', path: () => `/attendance/summary?branchId=${BRANCH.seocho}&month=2026-09` },
    { name: '결근 미리보기(branchId=서초)', method: 'get', path: () => `/attendance/absence-preview?branchId=${BRANCH.seocho}&month=2026-09` },
    { name: '회원 예약 내역(memberId=서초 회원)', method: 'get', path: (c) => `/reservations?memberId=${c.seocho.memberId}` },
  ];

  describe('강남 관리자가 서초점 리소스에 접근하면 거부된다', () => {
    it.each(attacksOnSeocho)('$name', async (a) => {
      const res = await call(tok.gangnamAdmin, a.method, a.path(ctx), a.body?.(ctx));
      expect(FOREIGN).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  // ── 서초 관리자 → 강남 리소스 (강남점은 4개 도메인만 시드가 있다) ─────────────────────────────────
  const attacksOnGangnam: Attack[] = [
    { name: '회원 상세 조회', method: 'get', path: (c) => `/members/${c.gangnam.memberId}` },
    { name: '회원 수정', method: 'patch', path: (c) => `/members/${c.gangnam.memberId}`, body: () => ({ memo: 'x' }) },
    { name: '직원 상세 조회', method: 'get', path: (c) => `/staff/${c.gangnam.staffId}` },
    { name: '직원 수정', method: 'patch', path: (c) => `/staff/${c.gangnam.staffId}`, body: () => ({ position: 'x' }) },
    { name: '프로그램 수정', method: 'patch', path: (c) => `/programs/${c.gangnam.programId}`, body: () => ({ description: 'x' }) },
    { name: '시설 수정', method: 'patch', path: (c) => `/facilities/${c.gangnam.facilityId}`, body: () => ({ capacity: 10 }) },
    { name: '직원 근태 조회', method: 'get', path: (c) => `/attendance?staffId=${c.gangnam.staffId}` },
    { name: '회원 목록(branchId=강남)', method: 'get', path: () => `/members?branchId=${BRANCH.gangnam}` },
  ];

  describe('서초 관리자가 강남점 리소스에 접근하면 거부된다', () => {
    it.each(attacksOnGangnam)('$name', async (a) => {
      const res = await call(tok.seochoAdmin, a.method, a.path(ctx), a.body?.(ctx));
      expect(FOREIGN).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  // ── 타 지점에 쓰기(생성) 시도: 본문에 남의 지점 ID를 실어 보낸다 ────────────────────────────────────
  // 서버는 거부(403/404)하거나, 본문 branchId를 무시하고 요청자 본인 지점으로 만들 수 있다(현재 구현).
  // 어느 쪽이든 "서초점(피해 지점)에는 아무것도 생성되지 않는다"가 불변식이므로 저장소를 직접 확인한다.
  describe('본문에 타 지점 ID를 지정해도 타 지점에는 생성되지 않는다', () => {
    // 모두 DB가 원천이다(D34 문서, D35 자산, D36 게시글).
    const seochoCount = async (kind: 'documents' | 'assets' | 'posts') =>
      kind === 'documents'
        ? db(app).document.count({ where: { branchId: BRANCH.seocho, deletedAt: null } })
        : kind === 'assets'
          ? db(app).asset.count({ where: { branchId: BRANCH.seocho } })
          : db(app).post.count({ where: { branchId: BRANCH.seocho, deletedAt: null } });

    it('강남 관리자가 서초점 소속으로 문서를 등록해도 서초점에 문서가 늘지 않는다', async () => {
      const before = await seochoCount('documents');
      const res = await call(tok.gangnamAdmin, 'post', '/documents', {
        category: 'MANUAL',
        branchId: BRANCH.seocho,
        title: '침입 문서',
        fileUrl: 'https://files.example/x.pdf',
      });
      expect(res.status).toBeLessThan(500);
      if (res.status < 300) expect(res.body.data.branchId).not.toBe(BRANCH.seocho);
      expect(await seochoCount('documents')).toBe(before);
    });
    // 자원문서관리 §11 "타 지점 branchId로 자산 생성 시도해도 서버가 무시"(D35에서 추가) — 문서와 같은 패턴.
    it('강남 관리자가 서초점 소속으로 자산을 등록해도 서초점에 자산이 늘지 않는다', async () => {
      const before = await seochoCount('assets');
      const res = await call(tok.gangnamAdmin, 'post', '/assets', {
        branchId: BRANCH.seocho,
        name: '침입 자산',
        category: 'OTHER',
        acquiredAt: '2026-09-01',
        acquisitionCost: 1000,
      });
      expect(res.status).toBeLessThan(500);
      if (res.status < 300) expect(res.body.data.branchId).not.toBe(BRANCH.seocho);
      expect(await seochoCount('assets')).toBe(before);
    });
    it('강남 관리자가 서초점 소속으로 공지를 작성해도 서초점에 게시글이 늘지 않는다', async () => {
      const before = await seochoCount('posts');
      const res = await call(tok.gangnamAdmin, 'post', '/posts', {
        title: '침입 공지',
        content: 'x',
        category: 'NOTICE',
        branchId: BRANCH.seocho,
      });
      expect(res.status).toBeLessThan(500);
      if (res.status < 300) expect(res.body.data.branchId).not.toBe(BRANCH.seocho);
      expect(await seochoCount('posts')).toBe(before);
    });
  });

  // ── 역할 내 격리: 같은 지점 안에서도 본인 것만 ────────────────────────────────────────────────────
  describe('회원·직원은 본인 범위를 벗어나지 못한다', () => {
    it('회원 수진은 다른 지점 회원(영희)의 상세를 조회할 수 없다', async () => {
      const res = await call(tok.seochoMember, 'get', `/members/${ctx.gangnam.memberId}`);
      expect(FOREIGN).toContain(res.status);
    });
    it('회원 수진은 다른 지점 회원(영희)을 수정할 수 없다', async () => {
      const res = await call(tok.seochoMember, 'patch', `/members/${ctx.gangnam.memberId}`, { name: '변조' });
      expect(FOREIGN).toContain(res.status);
    });
    it('회원 수진은 다른 지점 프로그램의 회차를 조회할 수 없다', async () => {
      const res = await call(tok.seochoMember, 'get', `/programs/${ctx.gangnam.programId}/slots`);
      expect(FOREIGN).toContain(res.status);
    });
    // DI-02(data-integrity.md §3) — 회차 조회는 막혀 있어도 회차 id만 알면 타 지점 예약이 되던 공백.
    // 대조군은 beforeAll의 픽스처(서초 회원이 서초 회차 예약 → 201)다.
    it('회원 수진은 다른 지점 프로그램 회차를 예약할 수 없다', async () => {
      const slot = await call(tok.gangnamAdmin, 'post', '/programs/program-gangnam-pilates/slots', {
        date: '2026-12-01',
        startTime: '10:00',
        endTime: '11:00',
      });
      expect(slot.status).toBe(201);
      const res = await call(tok.seochoMember, 'post', '/reservations', { scheduleSlotId: slot.body.data.id });
      expect(FOREIGN).toContain(res.status);
      expect(await db(app).reservation.count({ where: { scheduleSlotId: slot.body.data.id } })).toBe(0);
    });
    it('회원은 회원 목록 API를 쓸 수 없다', async () => {
      expect((await call(tok.seochoMember, 'get', '/members')).status).toBe(403);
    });
    it('직원 서연은 다른 지점 직원의 근태를 조회할 수 없다', async () => {
      const res = await call(tok.seochoStaff, 'get', `/attendance?staffId=${ctx.gangnam.staffId}`);
      expect(FOREIGN).toContain(res.status);
    });
    it('직원 서연은 다른 지점 직원의 상세를 조회할 수 없다', async () => {
      const res = await call(tok.seochoStaff, 'get', `/staff/${ctx.gangnam.staffId}`);
      expect(FOREIGN).toContain(res.status);
    });
  });

  // ── 목록 누수 스캔: 어떤 목록 API도 타 지점 소유 리소스를 응답에 실어서는 안 된다 ─────────────────────
  describe('목록 응답에 타 지점 리소스가 섞이지 않는다', () => {
    const lists = [
      '/members', '/staff', '/programs', '/facilities', '/instructors', '/assets', '/documents',
      '/reservations', '/payments', '/attendance', '/leave-requests', '/work-logs', '/posts',
    ];
    // 쿼리 없이 + 타 지점 branchId를 붙여서 둘 다 확인한다(가드 없는 컨트롤러도 있으므로).
    const variants = lists.flatMap((p) => [p, `${p}?branchId=${BRANCH.seocho}`]);

    it.each(variants)('강남 관리자의 GET %s 에 서초점 리소스 id가 없다', async (path) => {
      const res = await call(tok.gangnamAdmin, 'get', path);
      if (res.status === 403) return; // 명시적 거부는 안전
      expect(res.status).toBeLessThan(500);
      const text = JSON.stringify(res.body);
      const leaked = ctx.seocho.ids.filter((id) => text.includes(`"${id}"`));
      expect(leaked).toEqual([]);
    });

    it('강남 관리자의 GET /branches 에 서초점이 노출되지 않는다', async () => {
      const res = await call(tok.gangnamAdmin, 'get', '/branches');
      expect(res.status).toBe(200);
      const branchIds: string[] = (res.body.data as { id: string }[]).map((b) => b.id);
      expect(branchIds).not.toContain(BRANCH.seocho);
    });
  });
});
