import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, createApp, login } from './helpers/app';

/**
 * 강사프로그램게시 도메인 — ADR-PRG-03(facilityId 지점 일치 검증).
 * MockDataService가 인메모리 상태를 가지므로 테스트마다 새 앱을 띄운다.
 */
describe('프로그램 무결성 — facilityId 지점 일치', () => {
  let app: INestApplication;
  let seochoAdmin: string;

  const api = (auth: string) => ({
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
    patch: (p: string, b?: object) => request(app.getHttpServer()).patch(`/api/v1${p}`).set('Authorization', auth).send(b),
  });

  const baseProgram = {
    name: '테스트 프로그램',
    category: '요가',
    ageGroup: 'ALL',
    pricingType: 'FREE_ACCESS',
    price: 0,
    startDate: '2026-10-01',
  };

  beforeEach(async () => {
    app = await createApp();
    seochoAdmin = await login(app, ACCOUNTS.seochoAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  describe('ADR-PRG-03', () => {
    it('다른 지점 시설로 프로그램을 등록하면 400 FACILITY_BRANCH_MISMATCH', async () => {
      const res = await api(seochoAdmin).post('/programs', { ...baseProgram, facilityId: 'facility-gangnam-gym' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FACILITY_BRANCH_MISMATCH');
    });

    it('대조군: 본인 지점 시설로 등록하면 성공한다', async () => {
      const res = await api(seochoAdmin).post('/programs', { ...baseProgram, facilityId: 'facility-seocho-gym' });
      expect(res.status).toBe(201);
      expect(res.body.data.facilityId).toBe('facility-seocho-gym');
    });

    it('수정으로 다른 지점 시설을 지정해도 400 FACILITY_BRANCH_MISMATCH', async () => {
      const created = await api(seochoAdmin).post('/programs', baseProgram);
      const res = await api(seochoAdmin).patch(`/programs/${created.body.data.id}`, {
        facilityId: 'facility-gangnam-gym',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FACILITY_BRANCH_MISMATCH');
    });

    it('존재하지 않는 facilityId도 같은 이유로 거부된다', async () => {
      const res = await api(seochoAdmin).post('/programs', { ...baseProgram, facilityId: 'facility-not-exist' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FACILITY_BRANCH_MISMATCH');
    });
  });

  describe('ADR-PRG-01: PAID_SESSION capacity 필수', () => {
    const paidSession = { ...baseProgram, pricingType: 'PAID_SESSION', price: 30000 };

    it('capacity 없이 PAID_SESSION 프로그램을 등록하면 400 PROGRAM_CAPACITY_REQUIRED', async () => {
      const res = await api(seochoAdmin).post('/programs', paidSession);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PROGRAM_CAPACITY_REQUIRED');
    });

    it('capacity=0으로 PAID_SESSION 프로그램을 등록해도 거부된다', async () => {
      const res = await api(seochoAdmin).post('/programs', { ...paidSession, capacity: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PROGRAM_CAPACITY_REQUIRED');
    });

    it('대조군: capacity를 지정하면 PAID_SESSION 프로그램 등록이 성공한다', async () => {
      const res = await api(seochoAdmin).post('/programs', { ...paidSession, capacity: 10 });
      expect(res.status).toBe(201);
      expect(res.body.data.capacity).toBe(10);
    });

    it('대조군: FREE_ACCESS는 capacity 없이도 등록된다(정규화로 undefined)', async () => {
      const res = await api(seochoAdmin).post('/programs', baseProgram);
      expect(res.status).toBe(201);
      expect(res.body.data.capacity).toBeUndefined();
    });

    it('FREE_ACCESS로 만든 프로그램을 PAID_SESSION으로 수정할 때도 capacity가 없으면 거부된다', async () => {
      const created = await api(seochoAdmin).post('/programs', baseProgram);
      const res = await api(seochoAdmin).patch(`/programs/${created.body.data.id}`, { pricingType: 'PAID_SESSION' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PROGRAM_CAPACITY_REQUIRED');
    });

    it('같은 수정 요청에 capacity를 함께 보내면 성공한다', async () => {
      const created = await api(seochoAdmin).post('/programs', baseProgram);
      const res = await api(seochoAdmin).patch(`/programs/${created.body.data.id}`, {
        pricingType: 'PAID_SESSION',
        capacity: 15,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.capacity).toBe(15);
    });

    it('검증 실패 시 다른 필드도 함께 반영되지 않는다(부분 수정 방지)', async () => {
      const created = await api(seochoAdmin).post('/programs', baseProgram);
      const res = await api(seochoAdmin).patch(`/programs/${created.body.data.id}`, {
        name: '이름이 바뀌면 안 됨',
        pricingType: 'PAID_SESSION',
      });
      expect(res.status).toBe(400);
      const afterList = await request(app.getHttpServer())
        .get(`/api/v1/programs?branchId=branch-seocho`)
        .set('Authorization', seochoAdmin);
      const unchanged = afterList.body.data.find((p: { id: string }) => p.id === created.body.data.id);
      expect(unchanged.name).toBe(baseProgram.name);
      expect(unchanged.pricingType).toBe('FREE_ACCESS');
    });
  });
});
