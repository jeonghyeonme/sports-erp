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
});
