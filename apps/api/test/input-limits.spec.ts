import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { INPUT_LIMITS } from '../src/common/validation/input-limits';
import { ACCOUNTS, createApp, login } from './helpers/app';

/**
 * 개발보안 점검표 입력-14(정수형 오버플로우, log/164) — DB 정수(int4) 범위를 넘는 값이 500이 아니라 400으로 거절된다.
 * 상한 값 자체(경계)는 통과하는지 대조군으로 함께 본다.
 */
describe('정수 입력 상한 (입력-14)', () => {
  let app: INestApplication;
  let admin: string; // 서초점 관리자
  const call = (method: 'post' | 'patch', path: string, body: object) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', admin).send(body);
  const asset = (acquisitionCost: number) => ({ name: '상한 시험', category: 'OTHER', acquiredAt: '2026-09-01', acquisitionCost });

  beforeAll(async () => {
    app = await createApp();
    admin = await login(app, ACCOUNTS.seochoAdmin);
  });
  afterAll(async () => {
    await app.close();
  });

  it('자산 취득가액이 int4를 넘으면(2^31) 400 — 상한 그대로는 201', async () => {
    const over = await call('post', '/assets', asset(2 ** 31));
    expect(over.status).toBe(400);
    expect((await call('post', '/assets', asset(INPUT_LIMITS.ACQUISITION_COST_WON))).status).toBe(201);
  });

  it('시설 정원·현재 인원은 상한을 넘으면 400', async () => {
    expect((await call('post', '/facilities', { name: '큰 시설', type: 'GYM', capacity: INPUT_LIMITS.HEADCOUNT + 1 })).status).toBe(400);
    expect((await call('patch', '/facilities/facility-seocho-gym', { capacity: 2 ** 31 })).status).toBe(400);
    expect(
      (await call('post', '/facilities/facility-seocho-gym/congestion/manual', { currentCount: 2 ** 31 })).status,
    ).toBe(400);
    expect((await call('post', '/facilities', { name: '상한 시설', type: 'GYM', capacity: INPUT_LIMITS.HEADCOUNT })).status).toBe(201);
  });

  it('프로그램 가격·정원은 상한을 넘으면 400', async () => {
    const program = { name: '상한 시험 프로그램', category: '요가', ageGroup: 'ALL', pricingType: 'PAID_SESSION', startDate: '2026-10-01' };
    expect((await call('post', '/programs', { ...program, price: 2 ** 31, capacity: 10 })).status).toBe(400);
    expect((await call('post', '/programs', { ...program, price: 10000, capacity: 2 ** 31 })).status).toBe(400);
    const ok = await call('post', '/programs', { ...program, price: INPUT_LIMITS.PRICE_WON, capacity: INPUT_LIMITS.HEADCOUNT });
    expect(ok.status).toBe(201);
  });
});
