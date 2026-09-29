import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D35 — 자산을 DB로 옮기며 단일 스레드 가정 없이 놓인 규칙과, 도메인 문서(자원문서관리 §4 RES-T01~04)에
 * "테스트 없음"으로 남아 있던 규칙들을 확인한다.
 * - RES-T04: 자산번호 동시 채번 — D28 헬퍼(allocateBranchCode ASSET), 시드 다음 번호부터 중복 없이
 * - RES-T01: 100만원 "초과"만 고정자산(정확히 100만원은 소모품), 수동 지정은 자동 판정보다 우선
 * - RES-T03: 고정자산 수량은 항상 1 — 등록 시 강제, 수정 시 400(그리고 부분 수정 없이)
 * - RES-T02: 상태 전이표 + 동시 전이 중 하나만 성공(D35 결정 2), 폐기됨은 종결
 */
describe('자산 규칙 (D35)', () => {
  let app: INestApplication;
  let admin: string; // 서초점 관리자
  const call = (method: 'get' | 'post' | 'patch', path: string, body?: object) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', admin).send(body);
  const asset = (acquisitionCost: number, extra: object = {}) => ({
    name: '테스트 자산',
    category: 'OTHER',
    acquiredAt: '2026-09-01',
    acquisitionCost,
    ...extra,
  });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    admin = await login(app, ACCOUNTS.seochoAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  it('동시 등록 10건 → 전부 201, 자산번호는 시드(A003) 다음부터 중복·누락 없이 A004~A013', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => call('post', '/assets', asset(10000))));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const codes = results.map((r) => r.body.data.assetCode as string).sort();
    expect(codes).toEqual(Array.from({ length: 10 }, (_, i) => `SEOCHO-A${String(i + 4).padStart(3, '0')}`));
    expect(results[0].body.data.branchName).toBe('서초점');
  });

  it('자동 판정: 정확히 100만원은 소모품, 100만원 초과는 고정자산(수량 1 강제, 내용연수 유지) — 수동 지정이 우선', async () => {
    const consumable = await call('post', '/assets', asset(1_000_000, { quantity: 5, usefulLifeYears: 3 }));
    expect(consumable.body.data).toMatchObject({ assetType: 'CONSUMABLE', quantity: 5 });
    expect(consumable.body.data.usefulLifeYears).toBeUndefined(); // 소모품은 내용연수를 쓰지 않는다

    const fixed = await call('post', '/assets', asset(1_000_001, { quantity: 5, usefulLifeYears: 3 }));
    expect(fixed.body.data).toMatchObject({ assetType: 'FIXED_ASSET', quantity: 1, usefulLifeYears: 3 });

    const overridden = await call('post', '/assets', asset(2_000_000, { assetType: 'CONSUMABLE', quantity: 2 }));
    expect(overridden.body.data).toMatchObject({ assetType: 'CONSUMABLE', quantity: 2 });
  });

  it('수정: 고정자산 수량을 1이 아니게 바꾸면 400 — 같은 요청의 다른 필드도 바뀌지 않는다(부분 수정 없음)', async () => {
    const res = await call('patch', '/assets/asset-seocho-treadmill', { name: '바뀌면 안 됨', quantity: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUANTITY');
    const row = await db(app).asset.findUniqueOrThrow({ where: { id: 'asset-seocho-treadmill' } });
    expect(row).toMatchObject({ name: '러닝머신', quantity: 1 });

    // 대조군: 소모품 수량 변경과 위치 지우기(빈 문자열)는 된다
    const ok = await call('patch', '/assets/asset-seocho-sanitizer', { quantity: 30, location: '창고' });
    expect(ok.body.data).toMatchObject({ quantity: 30, location: '창고' });
    const cleared = await call('patch', '/assets/asset-seocho-sanitizer', { location: '' });
    expect(cleared.body.data.location).toBeUndefined();
  });

  it('상태 전이표: 정상→폐기됨 직행은 409, 정상→폐기대상→폐기됨은 되고, 폐기됨에서는 어디로도 못 간다', async () => {
    const path = '/assets/asset-seocho-treadmill/status';
    expect((await call('patch', path, { status: 'DISPOSED' })).body.error.code).toBe('INVALID_STATUS_TRANSITION');
    expect((await call('patch', path, { status: 'DISPOSAL_PENDING' })).status).toBe(200);
    expect((await call('patch', path, { status: 'DISPOSED' })).body.data.status).toBe('DISPOSED');
    for (const next of ['NORMAL', 'REPAIRING', 'DISPOSAL_PENDING']) {
      expect((await call('patch', path, { status: next })).status).toBe(409);
    }
  });

  it('동시 전이: 폐기대상에서 "정상 복귀" 5건과 "폐기" 5건이 동시에 오면 1건만 성공하고, 저장된 상태는 성공한 쪽이다', async () => {
    // 어느 순서로 처리돼도 첫 성공 뒤 상태가 NORMAL 또는 DISPOSED가 되어 나머지 9건은 전이표상 불가(409)다.
    // "읽은 상태 그대로일 때만" 조건이 없으면 같은 이전 상태를 읽은 요청들이 함께 통과해 여러 건이 성공한다.
    await db(app).asset.update({ where: { id: 'asset-seocho-aed' }, data: { status: 'DISPOSAL_PENDING' } });
    const path = '/assets/asset-seocho-aed/status';
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => call('patch', path, { status: i % 2 === 0 ? 'NORMAL' : 'DISPOSED' })),
    );
    const winners = results.filter((r) => r.status === 200);
    expect(winners).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(9);
    const row = await db(app).asset.findUniqueOrThrow({ where: { id: 'asset-seocho-aed' } });
    expect(row.status).toBe(winners[0].body.data.status);
  });
});
