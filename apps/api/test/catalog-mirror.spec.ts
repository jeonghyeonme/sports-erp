import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, BRANCH, createApp, login, mockData } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D31 — 시설·강사·프로그램·회차의 원천은 DB이고, 아직 mock인 예약·회원·지점 건수는 mock "미러"를 읽는다.
 * 미러가 DB 쓰기를 따라가지 못하면 예약이 멈춘 프로그램에 들어가거나(PROGRAM_NOT_RUNNING 누락),
 * 새 회차에 예약을 못 하는 식으로 조용히 틀어지므로, 저장소를 넘나드는 경로를 여기서 잡는다.
 */
describe('카탈로그 원천(DB)과 mock 미러', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = (token: string) => ({
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

  it('앱이 뜨면 미러가 DB의 시설·강사·프로그램·회차 전체와 같다', async () => {
    const [facilities, instructors, programs, slots] = await Promise.all([
      prisma.facility.count(),
      prisma.instructor.count(),
      prisma.program.count(),
      prisma.scheduleSlot.count(),
    ]);
    const m = mockData(app);
    expect(m.facilities).toHaveLength(facilities);
    expect(m.instructors).toHaveLength(instructors);
    expect(m.programs).toHaveLength(programs);
    expect(m.scheduleSlots).toHaveLength(slots);
    expect(facilities).toBe(99);
    // 대표 행은 필드까지 비교(예전 mock 히어로 값 그대로, 겸임 직원 연결 포함)
    expect(m.facilities.find((f) => f.id === 'facility-seocho-pool')).toEqual({
      id: 'facility-seocho-pool',
      branchId: BRANCH.seocho,
      name: '서초점 수영장',
      type: 'POOL',
      capacity: 30,
      currentCount: 26,
      level: 5,
      lastUpdatedAt: '2026-09-01T09:00:00.000Z',
      isActive: true,
    });
    expect(m.instructors.find((i) => i.id === 'instructor-seoyeon')).toMatchObject({ staffId: 'staff-seoyeon' });
    // ADR-PRG-01 — PAID_SESSION은 전부 정원이 있다(D28 CHECK가 시드 단계에서 강제)
    expect(m.programs.filter((p) => p.pricingType === 'PAID_SESSION' && !p.capacity)).toEqual([]);
  });

  it('프로그램을 PAUSED로 바꾸면 미러도 바뀌어, mock 예약이 곧바로 PROGRAM_NOT_RUNNING으로 막힌다', async () => {
    const admin = api(await login(app, ACCOUNTS.seochoAdmin));
    const member = api(await login(app, ACCOUNTS.seochoMember));
    expect((await admin.patch('/programs/program-seocho-yoga/status', { status: 'PAUSED' })).status).toBe(200);

    expect((await prisma.program.findUniqueOrThrow({ where: { id: 'program-seocho-yoga' } })).status).toBe('PAUSED');
    expect(mockData(app).programs.find((p) => p.id === 'program-seocho-yoga')!.status).toBe('PAUSED');
    const res = await member.post('/reservations', { scheduleSlotId: 'slot-seocho-yoga-1' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PROGRAM_NOT_RUNNING');
  });

  it('새 회차는 DB와 미러에 함께 생겨 바로 예약할 수 있다', async () => {
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
    expect(await prisma.scheduleSlot.count({ where: { id: slotId } })).toBe(1);

    expect((await member.post('/reservations', { scheduleSlotId: slotId })).status).toBe(201);
  });

  it('혼잡도 수동 보정은 DB와 미러에 같은 값·단계로 반영된다', async () => {
    const admin = api(await login(app, ACCOUNTS.seochoAdmin));
    const res = await admin.post('/facilities/facility-seocho-gym/congestion/manual', { currentCount: 50 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ currentCount: 50, level: 5, branchName: '서초점' });

    const db = await prisma.facility.findUniqueOrThrow({ where: { id: 'facility-seocho-gym' } });
    expect(db).toMatchObject({ currentCount: 50, level: 5 });
    expect(mockData(app).facilities.find((f) => f.id === 'facility-seocho-gym')).toMatchObject({
      currentCount: 50,
      level: 5,
      lastUpdatedAt: db.lastUpdatedAt!.toISOString(),
    });
  });

  it('직원 파견이 강사 겸임을 풀면 강사 미러도 함께 풀린다(ADR-STF-04)', async () => {
    const hq = api(await login(app, ACCOUNTS.superAdmin));
    expect((await hq.post('/staff/staff-seoyeon/assignments', { branchId: BRANCH.gangnam })).status).toBe(201);

    const db = await prisma.instructor.findUniqueOrThrow({ where: { id: 'instructor-seoyeon' } });
    expect(db).toMatchObject({ staffId: null, isActive: false });
    const mirror = mockData(app).instructors.find((i) => i.id === 'instructor-seoyeon')!;
    expect(mirror.staffId).toBeUndefined();
    expect(mirror.isActive).toBe(false);
  });
});
