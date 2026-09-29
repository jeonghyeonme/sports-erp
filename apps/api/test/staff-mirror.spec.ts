import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, BRANCH, createApp, login, mockData } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D30 — 직원·파견·관리자 계정의 원천은 DB이고, 아직 mock인 근태·문서·회원 등은 mock "미러"를 읽는다.
 * 미러가 DB와 어긋나면 근태 결근 판정·문서 대상 직원 검사·회원 담당 직원 검사가 조용히 틀어지므로 여기서 잡는다.
 */
describe('직원 원천(DB)과 mock 미러', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = (token: string) => ({
    post: (p: string, b: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', token).send(b),
  });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterEach(async () => {
    await app.close();
  });

  it('앱이 뜨면 미러가 DB의 직원·파견·관리자 계정 전체와 같다', async () => {
    const [staff, assignments, accounts] = await Promise.all([
      prisma.staff.count(),
      prisma.staffAssignment.count(),
      prisma.account.count({ where: { role: { not: 'MEMBER' } } }),
    ]);
    const m = mockData(app);
    expect(m.staff).toHaveLength(staff);
    expect(m.staffAssignments).toHaveLength(assignments);
    expect(m.accounts.filter((a) => a.role !== 'MEMBER')).toHaveLength(accounts);
    expect(staff).toBe(195);
    // 대표 행 하나는 필드까지 비교(날짜는 KST YYYY-MM-DD, 빈 휴무 요일은 생략)
    expect(m.staff.find((s) => s.id === 'staff-seoyeon')).toEqual({
      id: 'staff-seoyeon',
      accountId: 'account-seoyeon',
      branchId: BRANCH.seocho,
      staffCode: 'SEOCHO-002',
      name: '박서연',
      phone: '010-2222-3333',
      position: '트레이너',
      employmentType: '정규직',
      hireDate: '2022-07-11',
      status: 'ACTIVE',
    });
  });

  it('채용: DB 시퀀스로 직원번호가 나오고(시드 다음 번호) 미러에도 직원·계정·최초 파견이 들어간다', async () => {
    const res = await api(await login(app, ACCOUNTS.superAdmin)).post('/staff', {
      branchId: BRANCH.seocho,
      name: '신규채용',
      email: 'new.hire@spoism.example',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ staffCode: 'SEOCHO-003', branchId: BRANCH.seocho, branchName: '서초점' });

    const id = res.body.data.id as string;
    const m = mockData(app);
    expect(m.staff.find((s) => s.id === id)).toMatchObject({ staffCode: 'SEOCHO-003' });
    expect(m.staffAssignments.filter((a) => a.staffId === id)).toHaveLength(1);
    expect(m.accounts.find((a) => a.email === 'new.hire@spoism.example')).toMatchObject({ role: 'STAFF', staffId: id });
    // 새 직원은 바로 로그인된다(계정이 DB에 있음)
    expect((await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'new.hire@spoism.example',
      password: 'demo-password-1234',
    })).status).toBe(200);
  });

  it('채용: 이메일은 DB 직원 계정과도, 아직 mock에 있는 회원 계정과도 겹치면 409', async () => {
    const hq = api(await login(app, ACCOUNTS.superAdmin));
    const staffEmail = await hq.post('/staff', { branchId: BRANCH.seocho, name: 'x', email: ACCOUNTS.seochoStaff });
    const memberEmail = await hq.post('/staff', { branchId: BRANCH.seocho, name: 'x', email: ACCOUNTS.seochoMember });
    expect(staffEmail.status).toBe(409);
    expect(memberEmail.status).toBe(409);
    expect(memberEmail.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('파견: DB와 미러의 지점·파견 이력이 함께 바뀌고, mock 회원의 담당도 풀린다', async () => {
    const res = await api(await login(app, ACCOUNTS.superAdmin)).post('/staff/staff-seoyeon/assignments', {
      branchId: BRANCH.gangnam,
    });
    expect(res.status).toBe(201);

    const db = await prisma.staff.findUniqueOrThrow({ where: { id: 'staff-seoyeon' } });
    const m = mockData(app);
    expect(db.branchId).toBe(BRANCH.gangnam);
    expect(m.staff.find((s) => s.id === 'staff-seoyeon')!.branchId).toBe(BRANCH.gangnam);
    expect(m.staffAssignments.filter((a) => a.staffId === 'staff-seoyeon' && !a.endDate)).toEqual([
      expect.objectContaining({ branchId: BRANCH.gangnam }),
    ]);
    expect(m.members.filter((x) => x.assignedStaffId === 'staff-seoyeon' && x.branchId !== BRANCH.gangnam)).toEqual([]);
    // DB 쪽 회원(시드의 이수진)도 같은 트랜잭션에서 담당이 풀렸다 — 안 풀렸으면 D28 트리거가 파견 자체를 거부했을 것
    expect((await prisma.member.findUniqueOrThrow({ where: { id: 'member-sujin' } })).assignedStaffId).toBeNull();
  });
});
