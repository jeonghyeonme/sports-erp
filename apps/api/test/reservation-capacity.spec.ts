import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MockDataService } from '../src/mock-data/mock-data.service';
import { ACCOUNTS, BRANCH, createApp, login, mockData } from './helpers/app';

/**
 * 예약및결제 도메인의 핵심 불변규칙 — domains/예약및결제.md §11 "검증되지 않음" 항목 해소.
 * 이 도메인은 이 프로젝트에서 가장 정교하게 설계됐지만(1-7문서 §6 "락 대상 정정" 등) 자동 테스트가
 * 0건이었다. `slot-seocho-yoga-2`(capacity=2)는 애초에 SLOT_FULL 케이스를 바로 테스트할 수 있도록
 * 시드돼 있었다(mock-data.service.ts 주석 참고) — 이 테스트가 그 용도를 처음으로 사용한다.
 */

// 레이스 테스트용으로 새 Member+Account를 시드한다. 기존 계정의 passwordHash를 재사용해
// bcrypt를 새로 계산할 필요가 없게 한다(모든 시드 계정이 같은 데모 비밀번호를 공유).
function seedMember(app: INestApplication, opts: { branchId: string; name: string; email: string }): string {
  const data: MockDataService = mockData(app);
  const passwordHash = data.accounts[0].passwordHash;
  const suffix = opts.email.replace(/[^a-z0-9]/gi, '-');
  const memberId = `member-test-${suffix}`;
  const accountId = `account-test-${suffix}`;
  data.members.push({
    id: memberId,
    accountId,
    branchId: opts.branchId,
    memberNo: `TEST-${suffix}`,
    name: opts.name,
    status: 'ACTIVE',
    joinedAt: '2026-01-01',
    guardianConsent: true,
  });
  data.accounts.push({
    id: accountId,
    email: opts.email,
    passwordHash,
    role: 'MEMBER',
    name: opts.name,
    branchId: opts.branchId,
    memberId,
  });
  return opts.email;
}

describe('예약 정원 초과 방지 — 불변규칙 1', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('신규 개설(기존 예약 0건) 회차에 정원(2)보다 많은 동시 예약 요청 → 정확히 정원만큼만 성공', async () => {
    const emails = ['racer1@test.example', 'racer2@test.example', 'racer3@test.example'];
    const tokens = await Promise.all(
      emails.map((email, i) =>
        login(app, seedMember(app, { branchId: BRANCH.seocho, name: `레이서${i + 1}`, email })),
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
  });
});

describe('중복 예약 방지 — 불변규칙 2', () => {
  let app: INestApplication;
  let token: string;

  beforeEach(async () => {
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
    app = await createApp();
    token = await login(app, ACCOUNTS.seochoMember);
  });
  afterEach(async () => {
    await app.close();
  });

  it('마감시간 이내(임박·경과 회차) 취소는 환불되지 않는다(Payment는 APPROVED로 유지)', async () => {
    // slot-seocho-yoga-1은 2026-09-21 — 항상 "24시간 이내"(이미 지난) 조건을 만족한다.
    const resv = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', token)
      .send({ scheduleSlotId: 'slot-seocho-yoga-1' });
    const reservationId = resv.body.data.id;
    await request(app.getHttpServer()).post(`/api/v1/payments/${reservationId}/mock-pay`).set('Authorization', token);

    const cancelRes = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservationId}/cancel`)
      .set('Authorization', token)
      .send({});
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.payment.status).toBe('APPROVED');
    expect(cancelRes.body.data.payment.refundedAt).toBeUndefined();
  });

  it('마감시간(24시간) 이전 취소는 전액 환불된다(Payment REFUNDED)', async () => {
    const data = mockData(app);
    const futureSlotId = 'slot-test-future';
    data.scheduleSlots.push({
      id: futureSlotId,
      programId: 'program-seocho-yoga',
      date: '2099-01-01',
      startTime: '07:00',
      endTime: '08:00',
      capacity: 5,
    });

    const resv = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', token)
      .send({ scheduleSlotId: futureSlotId });
    const reservationId = resv.body.data.id;
    await request(app.getHttpServer()).post(`/api/v1/payments/${reservationId}/mock-pay`).set('Authorization', token);

    const cancelRes = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservationId}/cancel`)
      .set('Authorization', token)
      .send({});
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.payment.status).toBe('REFUNDED');
    expect(cancelRes.body.data.payment.refundedAt).toBeDefined();
  });
});
