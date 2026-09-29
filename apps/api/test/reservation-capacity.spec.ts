import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * 예약및결제 도메인의 핵심 불변규칙 — domains/예약및결제.md §11 "검증되지 않음" 항목 해소.
 * `slot-seocho-yoga-2`(capacity=2)는 SLOT_FULL 케이스를 바로 테스트할 수 있도록 시드돼 있다(catalog-fixtures.ts).
 *
 * D32 — 예약·결제·회원이 DB로 옮겨져 동시성 테스트가 처음으로 "진짜" 동시성을 본다. mock 시절엔 단일 스레드라
 * 락 없이도 통과했지만, 이제는 회차 행 락(ADR-RSV-01)과 부분 unique(ADR-RSV-02)가 있어야 통과한다.
 * 모든 테스트가 DB에 예약을 남기므로 테스트마다 워커 DB를 새로 만든다.
 */

// 레이스 테스트용 회원+계정. 시드 계정의 passwordHash를 재사용해 bcrypt를 새로 계산하지 않는다
// (모든 시드 계정이 같은 데모 비밀번호를 공유).
async function seedMember(app: INestApplication, opts: { branchId: string; name: string; email: string }): Promise<string> {
  const prisma = db(app);
  const { passwordHash } = await prisma.account.findUniqueOrThrow({ where: { id: 'account-sujin' } });
  const suffix = opts.email.replace(/[^a-z0-9]/gi, '-');
  const account = await prisma.account.create({
    data: { id: `account-test-${suffix}`, email: opts.email, passwordHash, role: 'MEMBER', name: opts.name },
  });
  await prisma.member.create({
    data: {
      id: `member-test-${suffix}`,
      accountId: account.id,
      branchId: opts.branchId,
      memberNo: `TEST-${suffix}`,
      name: opts.name,
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      guardianConsent: true,
    },
  });
  return opts.email;
}

/** 지금부터 hours시간 뒤의 KST 날짜·시각(회차 date/startTime은 KST 기준으로 저장된다). */
function kstAfterHours(hours: number): { date: string; time: string } {
  const kst = new Date(Date.now() + hours * 3600_000 + 9 * 3600_000).toISOString();
  return { date: kst.slice(0, 10), time: kst.slice(11, 16) };
}

describe('예약 정원 초과 방지 — 불변규칙 1', () => {
  let app: INestApplication;

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('신규 개설(기존 예약 0건) 회차에 정원(2)보다 많은 동시 예약 요청 → 정확히 정원만큼만 성공', async () => {
    const emails = ['racer1@test.example', 'racer2@test.example', 'racer3@test.example'];
    const tokens = await Promise.all(
      emails.map(async (email, i) =>
        login(app, await seedMember(app, { branchId: BRANCH.seocho, name: `레이서${i + 1}`, email })),
      ),
    );

    const results = await Promise.all(
      tokens.map((tok) =>
        request(app.getHttpServer())
          .post('/api/v1/reservations')
          .set('Authorization', tok)
          .send({ scheduleSlotId: 'slot-seocho-yoga-2' }), // capacity: 2
      ),
    );

    const succeeded = results.filter((r) => r.status === 201);
    const full = results.filter((r) => r.status === 409 && r.body.error.code === 'SLOT_FULL');
    expect(succeeded).toHaveLength(2);
    expect(full).toHaveLength(1);
    expect(
      await db(app).reservation.count({ where: { scheduleSlotId: 'slot-seocho-yoga-2', status: { in: ['REQUESTED', 'CONFIRMED'] } } }),
    ).toBe(2);
  });
});

describe('중복 예약 방지 — 불변규칙 2', () => {
  let app: INestApplication;
  let token: string;

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    token = await login(app, ACCOUNTS.seochoMember);
  });
  afterEach(async () => {
    await app.close();
  });

  const reserve = (slotId: string) =>
    request(app.getHttpServer()).post('/api/v1/reservations').set('Authorization', token).send({ scheduleSlotId: slotId });

  it('동일 회원이 같은 회차에 중복 예약 시도 시 차단(409 ALREADY_RESERVED)', async () => {
    const first = await reserve('slot-seocho-yoga-1');
    expect(first.status).toBe(201);

    const second = await reserve('slot-seocho-yoga-1');
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_RESERVED');
  });

  it('동일 회원의 동시 중복 예약도 하나만 성공한다(ADR-RSV-02 — 락·부분 unique 이중화)', async () => {
    const results = await Promise.all([reserve('slot-seocho-yoga-1'), reserve('slot-seocho-yoga-1'), reserve('slot-seocho-yoga-1')]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.error.code === 'ALREADY_RESERVED')).toBe(true);
  });

  it('취소한 뒤에는 같은 회차를 다시 예약할 수 있다(취소 이력은 막지 않는다)', async () => {
    const first = await reserve('slot-seocho-yoga-1');
    const reservationId = first.body.data.id;

    const cancelRes = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservationId}/cancel`)
      .set('Authorization', token)
      .send({});
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    const second = await reserve('slot-seocho-yoga-1');
    expect(second.status).toBe(201);
  });
});

describe('모의결제 흐름', () => {
  let app: INestApplication;
  let token: string;

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    token = await login(app, ACCOUNTS.seochoMember);
  });
  afterEach(async () => {
    await app.close();
  });

  it('결제 승인 시 APPROVED + 예약 CONFIRMED + 부가세가 정확히 분리된다', async () => {
    const resv = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', token)
      .send({ scheduleSlotId: 'slot-seocho-yoga-1' }); // program-seocho-yoga, price 30000
    expect(resv.body.data.payment.status).toBe('PENDING');
    const reservationId = resv.body.data.id;

    const payRes = await request(app.getHttpServer())
      .post(`/api/v1/payments/${reservationId}/mock-pay`)
      .set('Authorization', token);
    expect(payRes.status).toBe(201);
    expect(payRes.body.data.payment.status).toBe('APPROVED');
    expect(payRes.body.data.payment.supplyAmount).toBe(27273); // round(30000/1.1)
    expect(payRes.body.data.payment.vat).toBe(2727); // 30000 - 27273
    expect(payRes.body.data.reservation.status).toBe('CONFIRMED');
  });

  it('같은 결제를 동시에 두 번 승인해도 한 번만 승인된다', async () => {
    const resv = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', token)
      .send({ scheduleSlotId: 'slot-seocho-yoga-1' });
    const pay = () =>
      request(app.getHttpServer()).post(`/api/v1/payments/${resv.body.data.id}/mock-pay`).set('Authorization', token);
    const results = await Promise.all([pay(), pay()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it('결제 대기(PENDING) 상태에서 취소하면 결제는 FAILED로, 예약은 CANCELLED로 정상 롤백된다', async () => {
    const resv = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', token)
      .send({ scheduleSlotId: 'slot-seocho-yoga-1' });
    const reservationId = resv.body.data.id;

    const cancelRes = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservationId}/cancel`)
      .set('Authorization', token)
      .send({});
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');
    expect(cancelRes.body.data.payment.status).toBe('FAILED');
  });
});

describe('취소 정책 — 마감시간(24시간) 기준 환불 분기', () => {
  let app: INestApplication;
  let token: string;

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    token = await login(app, ACCOUNTS.seochoMember);
  });
  afterEach(async () => {
    await app.close();
  });

  const reserveAndPay = async (slotId: string) => {
    const resv = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', token)
      .send({ scheduleSlotId: slotId });
    expect(resv.status).toBe(201);
    const reservationId = resv.body.data.id;
    await request(app.getHttpServer()).post(`/api/v1/payments/${reservationId}/mock-pay`).set('Authorization', token);
    return reservationId as string;
  };
  const cancel = (reservationId: string) =>
    request(app.getHttpServer()).patch(`/api/v1/reservations/${reservationId}/cancel`).set('Authorization', token).send({});
  const createSlot = (id: string, at: { date: string; time: string }) =>
    db(app).scheduleSlot.create({
      data: {
        id,
        programId: 'program-seocho-yoga',
        date: new Date(`${at.date}T00:00:00Z`),
        startTime: at.time,
        endTime: '23:59',
        capacity: 5,
      },
    });

  it('마감시간 이내(임박·경과 회차) 취소는 환불되지 않는다(Payment는 APPROVED로 유지)', async () => {
    // slot-seocho-yoga-1은 2026-09-21 — 항상 "24시간 이내"(이미 지난) 조건을 만족한다.
    const cancelRes = await cancel(await reserveAndPay('slot-seocho-yoga-1'));
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.payment.status).toBe('APPROVED');
    expect(cancelRes.body.data.payment.refundedAt).toBeUndefined();
  });

  it('마감시간(24시간) 이전 취소는 전액 환불된다(Payment REFUNDED)', async () => {
    await createSlot('slot-test-future', { date: '2099-01-01', time: '07:00' });
    const cancelRes = await cancel(await reserveAndPay('slot-test-future'));
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.payment.status).toBe('REFUNDED');
    expect(cancelRes.body.data.payment.refundedAt).toBeDefined();
  });

  // D32 결정 5 — 회차 시각은 KST다. 예전 mock은 호스트 시간대(UTC 서버)로 해석해 9시간 늦게 봤고,
  // 20시간 뒤 회차를 29시간 뒤로 착각해 마감 이내인데도 환불했다.
  it('20시간 뒤(KST) 회차는 마감 이내라 환불되지 않는다 — 시간대 해석 회귀 방지', async () => {
    await createSlot('slot-test-in-20h', kstAfterHours(20));
    const cancelRes = await cancel(await reserveAndPay('slot-test-in-20h'));
    expect(cancelRes.body.data.payment.status).toBe('APPROVED');
  });

  it('대조군: 30시간 뒤(KST) 회차는 마감 전이라 환불된다', async () => {
    await createSlot('slot-test-in-30h', kstAfterHours(30));
    const cancelRes = await cancel(await reserveAndPay('slot-test-in-30h'));
    expect(cancelRes.body.data.payment.status).toBe('REFUNDED');
  });
});
