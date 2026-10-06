import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, BRANCH, createApp, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * 시설·강사·프로그램·회차(D31)와 예약·회원(D32)이 도메인을 넘나드는 경로.
 * D31 때는 예약이 mock이라 "미러가 DB를 따라가는지"를 봤다. D32로 예약·회원도 DB가 되어 미러는 없어졌고,
 * 같은 경로가 이제 DB 안에서 곧바로 이어지는지를 본다(상태 전이 → 예약 차단, 새 회차 → 예약 가능 등).
 */
describe('카탈로그 × 예약·회원 경로', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = (token: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', token),
    post: (p: string, b: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', token).send(b),
    patch: (p: string, b: object) => request(app.getHttpServer()).patch(`/api/v1${p}`).set('Authorization', token).send(b),
  });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterEach(async () => {
    await app.close();
  });

  it('시드 원천(catalog-fixtures)이 예전 mock 히어로 값 그대로 DB에 있다', async () => {
    expect(await prisma.facility.count()).toBe(84); // 히어로 3 + 생성 지점 81곳 × 1(D40 수도권 83곳)
    const pool = await prisma.facility.findUniqueOrThrow({ where: { id: 'facility-seocho-pool' } });
    expect(pool).toMatchObject({ branchId: BRANCH.seocho, name: '서초점 수영장', capacity: 30, currentCount: 26, level: 5 });
    expect(pool.lastUpdatedAt!.toISOString()).toBe('2026-09-01T09:00:00.000Z');
    expect(await prisma.instructor.findUniqueOrThrow({ where: { id: 'instructor-seoyeon' } })).toMatchObject({
      staffId: 'staff-seoyeon',
    });
    // ADR-PRG-01 — PAID_SESSION은 전부 정원이 있다(D28 CHECK가 시드 단계에서 강제)
    expect(await prisma.program.count({ where: { pricingType: 'PAID_SESSION', capacity: null } })).toBe(0);
  });

  it('프로그램을 PAUSED로 바꾸면 곧바로 예약이 PROGRAM_NOT_RUNNING으로 막힌다', async () => {
    const admin = api(await login(app, ACCOUNTS.seochoAdmin));
    const member = api(await login(app, ACCOUNTS.seochoMember));
    expect((await admin.patch('/programs/program-seocho-yoga/status', { status: 'PAUSED' })).status).toBe(200);

    const res = await member.post('/reservations', { scheduleSlotId: 'slot-seocho-yoga-1' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PROGRAM_NOT_RUNNING');
  });

  it('새 회차는 바로 예약할 수 있고, 회차 목록의 bookedCount가 유효 예약을 센다', async () => {
    const admin = api(await login(app, ACCOUNTS.seochoAdmin));
    const member = api(await login(app, ACCOUNTS.seochoMember));
    const created = await admin.post('/programs/program-seocho-yoga/slots', {
      date: '2099-03-01',
      startTime: '09:00',
      endTime: '10:00',
    });
    expect(created.status).toBe(201);
    const slotId = created.body.data.id as string;
    expect(created.body.data).toMatchObject({ capacity: 15, bookedCount: 0 });

    expect((await member.post('/reservations', { scheduleSlotId: slotId })).status).toBe(201);
    const slots = await admin.get('/programs/program-seocho-yoga/slots?date=2099-03-01');
    expect(slots.body.data).toEqual([expect.objectContaining({ id: slotId, bookedCount: 1 })]);
  });

  it('혼잡도 수동 보정은 값·단계·보정 시각이 함께 저장된다(ADR-FAC-01)', async () => {
    const admin = api(await login(app, ACCOUNTS.seochoAdmin));
    const res = await admin.post('/facilities/facility-seocho-gym/congestion/manual', { currentCount: 50 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ currentCount: 50, level: 5, branchName: '서초점' });

    const row = await prisma.facility.findUniqueOrThrow({ where: { id: 'facility-seocho-gym' } });
    expect(row).toMatchObject({ currentCount: 50, level: 5 });
    expect(res.body.data.lastUpdatedAt).toBe(row.lastUpdatedAt!.toISOString());
  });

  it('직원 파견이 강사 겸임과 회원 담당을 같은 트랜잭션에서 푼다(ADR-STF-04)', async () => {
    const hq = api(await login(app, ACCOUNTS.superAdmin));
    const res = await hq.post('/staff/staff-seoyeon/assignments', { branchId: BRANCH.gangnam });
    expect(res.status).toBe(201);
    expect(res.body.data.unassignedMembers).toEqual([{ id: 'member-sujin', name: '이수진' }]);

    expect(await prisma.instructor.findUniqueOrThrow({ where: { id: 'instructor-seoyeon' } })).toMatchObject({
      staffId: null,
      isActive: false,
    });
    expect((await prisma.member.findUniqueOrThrow({ where: { id: 'member-sujin' } })).assignedStaffId).toBeNull();
  });

  it('지점 목록 건수는 DB 집계다(회원·직원 전부, 프로그램은 RUNNING만)', async () => {
    const hq = api(await login(app, ACCOUNTS.superAdmin));
    const res = await hq.get('/branches');
    const seocho = (res.body.data as Array<{ id: string }>).find((b) => b.id === BRANCH.seocho);
    expect(seocho).toMatchObject({
      memberCount: await prisma.member.count({ where: { branchId: BRANCH.seocho } }),
      staffCount: await prisma.staff.count({ where: { branchId: BRANCH.seocho } }),
      runningProgramCount: await prisma.program.count({ where: { branchId: BRANCH.seocho, status: 'RUNNING' } }),
    });
    expect(seocho).toMatchObject({ memberCount: 2, runningProgramCount: 3 });
  });
});
