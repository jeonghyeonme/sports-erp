import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, createApp, login } from './helpers/app';

/**
 * 혼잡도관리 도메인 — ADR-FAC-01(lastUpdatedAt)·ADR-FAC-02(isActive).
 * 테스트마다 워커 DB를 새로 만들고 앱을 새로 띄운다(test/helpers/app.ts).
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

  describe('ADR-FAC-02: isActive', () => {
    it('신규 등록한 시설은 isActive=true다', async () => {
      const res = await api(admin).post('/facilities', { name: '테스트 시설', type: 'GYM', capacity: 20 });
      expect(res.body.data.isActive).toBe(true);
    });

    it('비활성화(PATCH isActive=false)하면 기본 목록에서 빠진다', async () => {
      const before = await api(admin).get('/facilities?branchId=branch-seocho');
      expect(before.body.data.map((f: { id: string }) => f.id)).toContain('facility-seocho-gym');

      const patchRes = await api(admin).patch('/facilities/facility-seocho-gym', { isActive: false });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.isActive).toBe(false);

      const after = await api(admin).get('/facilities?branchId=branch-seocho');
      expect(after.body.data.map((f: { id: string }) => f.id)).not.toContain('facility-seocho-gym');
    });

    it('비활성화 후 isActive=true로 되돌리면 목록에 다시 나타난다', async () => {
      await api(admin).patch('/facilities/facility-seocho-gym', { isActive: false });
      await api(admin).patch('/facilities/facility-seocho-gym', { isActive: true });
      const after = await api(admin).get('/facilities?branchId=branch-seocho');
      expect(after.body.data.map((f: { id: string }) => f.id)).toContain('facility-seocho-gym');
    });

    // 재활성화 화면(admin-web)이 목록을 채우는 경로 — 이월 항목으로 남겨뒀다가 이번에 추가.
    it('?isActive=false로 조회하면 비활성 시설만, 기본 조회에서는 반대로 빠진다', async () => {
      await api(admin).patch('/facilities/facility-seocho-gym', { isActive: false });

      const inactiveList = await api(admin).get('/facilities?branchId=branch-seocho&isActive=false');
      expect(inactiveList.status).toBe(200);
      expect(inactiveList.body.data.map((f: { id: string }) => f.id)).toEqual(['facility-seocho-gym']);

      const activeList = await api(admin).get('/facilities?branchId=branch-seocho');
      expect(activeList.body.data.map((f: { id: string }) => f.id)).not.toContain('facility-seocho-gym');
    });

    it('비활성 목록에서 재활성화(PATCH isActive=true)하면 다시 활성 목록에만 나타난다', async () => {
      await api(admin).patch('/facilities/facility-seocho-gym', { isActive: false });
      const res = await api(admin).patch('/facilities/facility-seocho-gym', { isActive: true });
      expect(res.status).toBe(200);

      const inactiveList = await api(admin).get('/facilities?branchId=branch-seocho&isActive=false');
      expect(inactiveList.body.data.map((f: { id: string }) => f.id)).not.toContain('facility-seocho-gym');
      const activeList = await api(admin).get('/facilities?branchId=branch-seocho');
      expect(activeList.body.data.map((f: { id: string }) => f.id)).toContain('facility-seocho-gym');
    });
  });

  // 혼잡도관리 A-6 — 정원 1 미만은 나눗셈이 안 돼 거부, 단계는 (예약 + 현장) / 정원 비율 20%씩: ≤20 → 1, ≤40 → 2, ≤60 → 3, ≤80 → 4, 그 위 5.
  describe('정원·5단계 경계(혼잡도관리 A-6)', () => {
    it.each([0, -1])('정원 %d 으로 등록하면 400', async (capacity) => {
      expect((await api(admin).post('/facilities', { name: '정원 검사', type: 'GYM', capacity })).status).toBe(400);
    });

    it('정원을 0으로 고치면 400, 정원은 그대로', async () => {
      expect((await api(admin).patch('/facilities/facility-seocho-gym', { capacity: 0 })).status).toBe(400);
      const gym = (await api(admin).get('/facilities?branchId=branch-seocho')).body.data.find((f: { id: string }) => f.id === 'facility-seocho-gym');
      expect(gym.capacity).toBeGreaterThan(0);
    });

    it('현장 인원 음수는 400', async () => {
      expect((await api(admin).post('/facilities/facility-seocho-gym/congestion/manual', { currentCount: -1 })).status).toBe(400);
    });

    // 예약이 붙지 않는 새 시설(정원 10)이라 단계는 현장 인원만으로 정해진다 — 경계 바로 위·아래를 모두 본다.
    it('정원 10에서 0~11명 → 1·1·1·2·2·3·3·4·4·5·5·5단계(정원 초과도 5단계)', async () => {
      const created = await api(admin).post('/facilities', { name: '경계 검사', type: 'GYM', capacity: 10 });
      expect(created.status).toBe(201);
      const id = created.body.data.id as string;
      const levels: number[] = [];
      for (let n = 0; n <= 11; n++) {
        const res = await api(admin).post(`/facilities/${id}/congestion/manual`, { currentCount: n });
        expect(res.status).toBe(201);
        levels.push(res.body.data.level);
      }
      expect(levels).toEqual([1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5]);
    });

    it('정원을 바꾸면 같은 인원으로 단계를 다시 매긴다(8/10 = 4단계 → 8/40 = 1단계)', async () => {
      const id = (await api(admin).post('/facilities', { name: '정원 변경', type: 'GYM', capacity: 10 })).body.data.id as string;
      expect((await api(admin).post(`/facilities/${id}/congestion/manual`, { currentCount: 8 })).body.data.level).toBe(4);
      const res = await api(admin).patch(`/facilities/${id}`, { capacity: 40 });
      expect(res.status).toBe(200);
      expect(res.body.data.level).toBe(1);
    });
  });
});
