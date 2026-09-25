import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, createApp, login } from './helpers/app';

/**
 * 혼잡도관리 도메인 — ADR-FAC-01(lastUpdatedAt)·ADR-FAC-02(isActive).
 * MockDataService가 인메모리 상태를 가지므로 테스트마다 새 앱을 띄운다.
 */
describe('시설 생애주기 — 신선도 추적·운영중단 표시', () => {
  let app: INestApplication;
  let admin: string; // 서초점 관리자

  const api = (auth: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth),
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
    patch: (p: string, b?: object) => request(app.getHttpServer()).patch(`/api/v1${p}`).set('Authorization', auth).send(b),
  });

  beforeEach(async () => {
    app = await createApp();
    admin = await login(app, ACCOUNTS.seochoAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  describe('ADR-FAC-01: lastUpdatedAt', () => {
    it('신규 등록한 시설은 lastUpdatedAt을 응답에 포함한다', async () => {
      const res = await api(admin).post('/facilities', { name: '테스트 시설', type: 'GYM', capacity: 20 });
      expect(res.status).toBe(201);
      expect(typeof res.body.data.lastUpdatedAt).toBe('string');
      expect(new Date(res.body.data.lastUpdatedAt).toString()).not.toBe('Invalid Date');
    });

    it('수동 보정하면 lastUpdatedAt이 갱신된다', async () => {
      const before = (await api(admin).get('/facilities?branchId=branch-seocho')).body.data.find(
        (f: { id: string }) => f.id === 'facility-seocho-gym',
      );
      await new Promise((r) => setTimeout(r, 5));
      const res = await api(admin).post('/facilities/facility-seocho-gym/congestion/manual', { currentCount: 30 });
      expect(res.status).toBe(201);
      expect(new Date(res.body.data.lastUpdatedAt).getTime()).toBeGreaterThan(new Date(before.lastUpdatedAt).getTime());
    });

    it('정원(capacity)만 수정하는 건 신선도 갱신 대상이 아니다(측정치가 새로 들어온 게 아니므로)', async () => {
      const before = (await api(admin).get('/facilities?branchId=branch-seocho')).body.data.find(
        (f: { id: string }) => f.id === 'facility-seocho-gym',
      );
      const res = await api(admin).patch('/facilities/facility-seocho-gym', { capacity: 80 });
      expect(res.status).toBe(200);
      expect(res.body.data.lastUpdatedAt).toBe(before.lastUpdatedAt);
    });
  });
});
