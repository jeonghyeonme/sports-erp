import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';
import { setBranchStatus } from './helpers/branch-status';

/**
 * 예약및결제 ADR-RSV-09 — 회원 앱 PT 패키지 구매(모의 결제)와 PT 회차 예약.
 * 예약은 패키지 횟수를 1회 "잡고"(총 − 사용 − 잡힌 것), 체크인 때 실제로 차감한다. 현장 판매(관리자 등록)와
 * "세션 사용"은 그대로 있고, 잡힌 횟수는 "세션 사용"이 쓰지 못한다. 테스트마다 워커 DB를 새로 만든다.
 */
const PT = 'program-seocho-pt'; // 시드: 10회 600,000원(ptPackageSessions 10)
const api = '/api/v1';

async function seedMember(app: INestApplication, suffix: string, branchId: string = BRANCH.seocho): Promise<{ id: string; token: string }> {
  const prisma = db(app);
  const { passwordHash } = await prisma.account.findUniqueOrThrow({ where: { id: 'account-sujin' } });
  const email = `pt-${suffix}@test.example`;
  const account = await prisma.account.create({ data: { id: `account-pt-${suffix}`, email, passwordHash, role: 'MEMBER', name: `피티${suffix}` } });
  const member = await prisma.member.create({
    data: {
      id: `member-pt-${suffix}`,
      accountId: account.id,
      branchId,
      memberNo: `PT-${suffix}`,
      name: `피티${suffix}`,
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      guardianConsent: true,
    },
  });
  return { id: member.id, token: await login(app, email) };
}

/** 지금부터 hours시간 뒤의 KST 날짜·시각. */
function kstAfterHours(hours: number): { date: string; time: string } {
  const kst = new Date(Date.now() + hours * 3600_000 + 9 * 3600_000).toISOString();
  return { date: kst.slice(0, 10), time: kst.slice(11, 16) };
}
const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

async function ptSlot(app: INestApplication, hoursAhead: number, date?: string): Promise<string> {
  const at = kstAfterHours(hoursAhead);
  const row = await db(app).scheduleSlot.create({
    data: { programId: PT, date: new Date(`${date ?? at.date}T00:00:00Z`), startTime: date ? '00:00' : at.time, endTime: '23:59', capacity: 1 },
  });
  return row.id;
}

async function givePackage(app: INestApplication, memberId: string, total: number): Promise<string> {
  const row = await db(app).pTSession.create({
    data: { memberId, programId: PT, totalSessions: total, usedSessions: 0, purchasedAt: new Date('2026-11-01T00:00:00Z') },
  });
  return row.id;
}

const reserve = (app: INestApplication, token: string, scheduleSlotId: string) =>
  request(app.getHttpServer()).post(`${api}/reservations`).set('Authorization', token).send({ scheduleSlotId });

describe('회원 앱 PT 패키지 구매 — ADR-RSV-09', () => {
  let app: INestApplication;
  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('구매하면 PT 횟수(10회)와 승인된 모의 결제가 함께 생기고, 금액은 서버가 프로그램에서 정한다', async () => {
    const m = await seedMember(app, 'buy');
    const res = await request(app.getHttpServer()).post(`${api}/payments/pt-packages`).set('Authorization', m.token).send({ programId: PT });
    expect(res.status).toBe(201);
    expect(res.body.data.ptSession).toMatchObject({ programId: PT, totalSessions: 10, usedSessions: 0, remainingSessions: 10 });
    expect(res.body.data.payment).toMatchObject({ amount: 600000, status: 'APPROVED', method: 'MOCK_CARD' });
    expect(res.body.data.payment.reservationId).toBeUndefined();

    const payment = await db(app).payment.findUniqueOrThrow({ where: { id: res.body.data.payment.id } });
    expect(payment.ptSessionId).toBe(res.body.data.ptSession.id);
    expect(payment.supplyAmount + payment.vat).toBe(600000);
  });

  it('패키지가 정해지지 않은 프로그램·회차 강습은 400, 다른 지점 PT는 403, 계약 종료 지점은 409', async () => {
    const m = await seedMember(app, 'reject');
    const buy = (programId: string) =>
      request(app.getHttpServer()).post(`${api}/payments/pt-packages`).set('Authorization', m.token).send({ programId });

    const yoga = await db(app).program.findFirstOrThrow({ where: { branchId: BRANCH.seocho, pricingType: 'PAID_SESSION' } });
    expect((await buy(yoga.id)).body.error.code).toBe('PT_PACKAGE_NOT_PURCHASABLE');
    await db(app).program.update({ where: { id: PT }, data: { ptPackageSessions: null } });
    const noPackage = await buy(PT);
    expect([noPackage.status, noPackage.body.error.code]).toEqual([400, 'PT_PACKAGE_NOT_PURCHASABLE']);
    await db(app).program.update({ where: { id: PT }, data: { ptPackageSessions: 10 } });

    const gangnamPt = await db(app).program.create({
      data: { branchId: BRANCH.gangnam, name: '강남 PT', category: 'PT', pricingType: 'PT_PACKAGE', price: 500000, ptPackageSessions: 10, status: 'RUNNING', startDate: new Date('2026-01-01T00:00:00Z') },
    });
    const other = await buy(gangnamPt.id);
    expect([other.status, other.body.error.code]).toEqual([403, 'MEMBER_BRANCH_MISMATCH']);

    await setBranchStatus(BRANCH.seocho, 'TERMINATED');
    const terminated = await buy(PT);
    expect([terminated.status, terminated.body.error.code]).toEqual([409, 'BRANCH_TERMINATED']);
    expect(await db(app).payment.count({ where: { memberId: m.id } })).toBe(0); // 실패한 구매는 아무것도 남기지 않는다
  });

  it('결제는 회차 예약·PT 구매 중 정확히 하나에 붙는다(DB CHECK Payment_target_ck)', async () => {
    const m = await seedMember(app, 'ck');
    await expect(
      db(app).payment.create({ data: { memberId: m.id, amount: 1100, supplyAmount: 1000, vat: 100, method: 'MOCK_CARD', status: 'APPROVED' } }),
    ).rejects.toThrow(/Payment_target_ck/);
  });
});

describe('PT 회차 예약 — 예약 때 잡고 체크인 때 차감(ADR-RSV-09)', () => {
  let app: INestApplication;
  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('지점 관리자는 PT 프로그램에 회차를 열 수 있고 정원을 비우면 1명이다', async () => {
    const admin = await login(app, ACCOUNTS.seochoAdmin);
    const at = kstAfterHours(48);
    const res = await request(app.getHttpServer())
      .post(`${api}/programs/${PT}/slots`)
      .set('Authorization', admin)
      .send({ date: at.date, startTime: '10:00', endTime: '10:50' });
    expect(res.status).toBe(201);
    expect(res.body.data.capacity).toBe(1);
  });

  it('남은 횟수가 없으면 409, 있으면 결제 없이 확정되고 1회가 잡힌다', async () => {
    const m = await seedMember(app, 'hold');
    const slotA = await ptSlot(app, 48);
    const slotB = await ptSlot(app, 72);

    const none = await reserve(app, m.token, slotA);
    expect([none.status, none.body.error.code]).toEqual([409, 'PT_SESSIONS_EXHAUSTED']);

    const pkg = await givePackage(app, m.id, 1);
    const ok = await reserve(app, m.token, slotA);
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ status: 'CONFIRMED', ptSessionId: pkg });
    expect(ok.body.data.payment).toBeUndefined();

    // 1회짜리 패키지는 이미 잡혔다 — 두 번째 예약도, 관리자의 "세션 사용"도 쓰지 못한다.
    const second = await reserve(app, m.token, slotB);
    expect([second.status, second.body.error.code]).toEqual([409, 'PT_SESSIONS_EXHAUSTED']);
    const admin = await login(app, ACCOUNTS.seochoAdmin);
    const manual = await request(app.getHttpServer()).post(`${api}/members/${m.id}/pt-sessions/${pkg}/use`).set('Authorization', admin).send({});
    expect([manual.status, manual.body.error.code]).toEqual([409, 'PT_SESSION_RESERVED']);

    // 관리자 PT 탭은 잡힌 횟수를 보여 준다(남은 1회 중 예약 1회).
    const list = await request(app.getHttpServer()).get(`${api}/members/${m.id}/pt-sessions`).set('Authorization', admin);
    expect(list.body.data[0]).toMatchObject({ remainingSessions: 1, reservedSessions: 1 });

    // 취소하면 잡힌 횟수가 돌아온다.
    const cancel = await request(app.getHttpServer()).patch(`${api}/reservations/${ok.body.data.id}/cancel`).set('Authorization', m.token).send({});
    expect(cancel.status).toBe(200);
    expect((await reserve(app, m.token, slotB)).status).toBe(201);
    expect((await db(app).pTSession.findUniqueOrThrow({ where: { id: pkg } })).usedSessions).toBe(0);
  });

  it('체크인하면 그 패키지에서 1회 차감되고, 사용 기록에 그 예약이 남는다', async () => {
    const m = await seedMember(app, 'checkin');
    const pkg = await givePackage(app, m.id, 3);
    const slot = await ptSlot(app, 0, todayKst()); // 오늘 회차(체크인은 회차 당일만, ADR-RSV-08)
    const r = await db(app).reservation.create({ data: { memberId: m.id, scheduleSlotId: slot, status: 'CONFIRMED', ptSessionId: pkg } });

    const admin = await login(app, ACCOUNTS.seochoAdmin);
    const res = await request(app.getHttpServer()).patch(`${api}/reservations/${r.id}/check-in`).set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
    expect((await db(app).pTSession.findUniqueOrThrow({ where: { id: pkg } })).usedSessions).toBe(1);
    const log = await db(app).pTSessionLog.findUniqueOrThrow({ where: { reservationId: r.id } });
    expect(log.ptSessionId).toBe(pkg);

    // 다른 지점 관리자는 이 예약을 체크인하지 못한다(지점 격리).
    const gangnam = await login(app, ACCOUNTS.gangnamAdmin);
    const cross = await request(app.getHttpServer()).patch(`${api}/reservations/${r.id}/check-in`).set('Authorization', gangnam);
    expect([403, 404]).toContain(cross.status);
  });

  it('남은 1회로 두 회차를 동시에 예약해도 정확히 하나만 성공한다(패키지 행 락)', async () => {
    const m = await seedMember(app, 'race');
    await givePackage(app, m.id, 1);
    const [a, b] = [await ptSlot(app, 48), await ptSlot(app, 72)];
    const results = await Promise.all([reserve(app, m.token, a), reserve(app, m.token, b)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await db(app).reservation.count({ where: { memberId: m.id, status: 'CONFIRMED' } })).toBe(1);
  });
});

describe('결제 목록 — PT 구매 결제도 지점별로(ADR-RSV-09)', () => {
  let app: INestApplication;
  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('서초 관리자 목록에 PT 구매가 보이고, 강남 관리자 목록에는 없다', async () => {
    const m = await seedMember(app, 'list');
    const bought = await request(app.getHttpServer()).post(`${api}/payments/pt-packages`).set('Authorization', m.token).send({ programId: PT });
    const paymentId = bought.body.data.payment.id;

    const seocho = await request(app.getHttpServer()).get(`${api}/payments?limit=100`).set('Authorization', await login(app, ACCOUNTS.seochoAdmin));
    expect(seocho.status).toBe(200);
    expect(seocho.body.data.find((p: { id: string }) => p.id === paymentId)).toMatchObject({ kind: 'PT_PACKAGE', programName: '퍼스널 트레이닝', amount: 600000 });

    const gangnam = await request(app.getHttpServer()).get(`${api}/payments?limit=100`).set('Authorization', await login(app, ACCOUNTS.gangnamAdmin));
    expect(gangnam.body.data.some((p: { id: string }) => p.id === paymentId)).toBe(false);
  });
});
