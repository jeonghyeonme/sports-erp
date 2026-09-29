import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, BRANCH, createApp, login, mockData } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D30 — 직원·파견·관리자 계정의 원천은 DB이고, 아직 mock인 도메인은 mock "미러"를 읽는다.
 * D33(근태)·D34(문서)로 파견 이력·직원 미러의 독자가 사라져, 남은 미러는 게시판이 작성자 이름을 읽는
 * 관리자·직원 계정뿐이다. 미러가 DB와 어긋나면 작성자 이름이 조용히 틀어지므로 여기서 잡는다.
 */
describe('계정 원천(DB)과 mock 계정 미러', () => {
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

  it('앱이 뜨면 미러가 DB의 관리자·직원 계정 전체와 같다(회원 계정·직원 배열은 없다)', async () => {
    const accounts = await prisma.account.count({ where: { role: { not: 'MEMBER' } } });
    const m = mockData(app);
    expect(m.accounts).toHaveLength(accounts);
    expect(m.accounts.some((a) => a.role === 'MEMBER')).toBe(false);
    expect('staff' in m).toBe(false); // D34 — 직원 미러 제거
    // 대표 행 하나는 필드까지 비교(지점·직원 id는 연결된 직원 행에서 온다)
    expect(m.accounts.find((a) => a.id === 'account-seoyeon')).toMatchObject({
      email: ACCOUNTS.seochoStaff,
      role: 'STAFF',
      name: '박서연',
      isActive: true,
      branchId: BRANCH.seocho,
      staffId: 'staff-seoyeon',
    });
  });

  it('채용: DB 시퀀스로 직원번호가 나오고(시드 다음 번호) DB에 직원·최초 파견이, 미러에 계정이 들어간다', async () => {
    const res = await api(await login(app, ACCOUNTS.superAdmin)).post('/staff', {
      branchId: BRANCH.seocho,
      name: '신규채용',
      email: 'new.hire@spoism.example',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ staffCode: 'SEOCHO-003', branchId: BRANCH.seocho, branchName: '서초점' });

    const id = res.body.data.id as string;
    const m = mockData(app);
    expect(await prisma.staff.findUniqueOrThrow({ where: { id } })).toMatchObject({ staffCode: 'SEOCHO-003' });
    expect(await prisma.staffAssignment.count({ where: { staffId: id } })).toBe(1);
    expect(m.accounts.find((a) => a.email === 'new.hire@spoism.example')).toMatchObject({ role: 'STAFF', staffId: id });
    // 새 직원은 바로 로그인된다(계정이 DB에 있음)
    expect((await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'new.hire@spoism.example',
      password: 'demo-password-1234',
    })).status).toBe(200);
  });

  it('채용: 이메일은 직원 계정과도, 회원 계정과도 겹치면 409(D32부터 둘 다 DB)', async () => {
    const hq = api(await login(app, ACCOUNTS.superAdmin));
    const staffEmail = await hq.post('/staff', { branchId: BRANCH.seocho, name: 'x', email: ACCOUNTS.seochoStaff });
    const memberEmail = await hq.post('/staff', { branchId: BRANCH.seocho, name: 'x', email: ACCOUNTS.seochoMember });
    expect(staffEmail.status).toBe(409);
    expect(memberEmail.status).toBe(409);
    expect(memberEmail.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('파견: DB의 지점·파견 이력과 미러 계정의 지점이 함께 바뀌고, 회원의 담당도 같은 트랜잭션에서 풀린다', async () => {
    const res = await api(await login(app, ACCOUNTS.superAdmin)).post('/staff/staff-seoyeon/assignments', {
      branchId: BRANCH.gangnam,
    });
    expect(res.status).toBe(201);

    const db = await prisma.staff.findUniqueOrThrow({ where: { id: 'staff-seoyeon' } });
    const m = mockData(app);
    expect(db.branchId).toBe(BRANCH.gangnam);
    expect(m.accounts.find((a) => a.id === 'account-seoyeon')!.branchId).toBe(BRANCH.gangnam);
    expect(await prisma.staffAssignment.findMany({ where: { staffId: 'staff-seoyeon', endDate: null } })).toEqual([
      expect.objectContaining({ branchId: BRANCH.gangnam }),
    ]);
    // 회원(시드의 이수진)도 같은 트랜잭션에서 담당이 풀렸다 — 안 풀렸으면 D28 트리거가 파견 자체를 거부했을 것
    expect((await prisma.member.findUniqueOrThrow({ where: { id: 'member-sujin' } })).assignedStaffId).toBeNull();
    expect(await prisma.member.count({ where: { assignedStaffId: 'staff-seoyeon', branchId: { not: BRANCH.gangnam } } })).toBe(0);
  });
});
