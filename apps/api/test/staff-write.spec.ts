import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, BRANCH, createApp, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * 직원 쓰기(채용·파견)가 DB에 실제로 반영되는지 — D30(직원·파견 DB 이관) 검증.
 * D30~D35 동안은 mock 미러와 DB의 일치도 여기서 봤지만(account-mirror.spec.ts), D36으로 미러와
 * MockDataService가 사라져 DB 쪽 검증만 남겼다.
 */
describe('직원 쓰기의 DB 반영', () => {
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

  it('채용: DB 시퀀스로 직원번호가 나오고(시드 다음 번호) 직원·계정·최초 파견이 한 번에 생긴다', async () => {
    const res = await api(await login(app, ACCOUNTS.superAdmin)).post('/staff', {
      branchId: BRANCH.seocho,
      name: '신규채용',
      email: 'new.hire@spoism.example',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ staffCode: 'SEOCHO-003', branchId: BRANCH.seocho, branchName: '서초점' });

    const id = res.body.data.id as string;
    const staff = await prisma.staff.findUniqueOrThrow({ where: { id }, include: { account: true } });
    expect(staff).toMatchObject({ staffCode: 'SEOCHO-003' });
    expect(await prisma.staffAssignment.count({ where: { staffId: id } })).toBe(1);
    expect(staff.account).toMatchObject({ email: 'new.hire@spoism.example', role: 'STAFF', isActive: true });
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

  it('파견: DB의 지점·파견 이력이 함께 바뀌고, 회원의 담당도 같은 트랜잭션에서 풀린다', async () => {
    const res = await api(await login(app, ACCOUNTS.superAdmin)).post('/staff/staff-seoyeon/assignments', {
      branchId: BRANCH.gangnam,
    });
    expect(res.status).toBe(201);

    const db = await prisma.staff.findUniqueOrThrow({ where: { id: 'staff-seoyeon' } });
    expect(db.branchId).toBe(BRANCH.gangnam);
    expect(await prisma.staffAssignment.findMany({ where: { staffId: 'staff-seoyeon', endDate: null } })).toEqual([
      expect.objectContaining({ branchId: BRANCH.gangnam }),
    ]);
    // 회원(시드의 이수진)도 같은 트랜잭션에서 담당이 풀렸다 — 안 풀렸으면 D28 트리거가 파견 자체를 거부했을 것
    expect((await prisma.member.findUniqueOrThrow({ where: { id: 'member-sujin' } })).assignedStaffId).toBeNull();
    expect(await prisma.member.count({ where: { assignedStaffId: 'staff-seoyeon', branchId: { not: BRANCH.gangnam } } })).toBe(0);
  });
});
