import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BRANCH, createApp, db } from './helpers/app';
import { setBranchStatus } from './helpers/branch-status';

/**
 * 회원관리 ADR-MEM-05 — 회원 웹 가입 화면의 지점 선택용 공개 목록(log/092).
 * 로그인 없이 부르고, 이름·지역만 주며, 가입이 막힌 계약 종료 지점은 빠진다.
 */
describe('공개 지점 목록 GET /branches/public', () => {
  let app: INestApplication;
  const get = () => request(app.getHttpServer()).get('/api/v1/branches/public');

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('로그인 없이 200이고, 항목은 id·name·region뿐이다(계약 정보·인원 없음)', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const b of res.body.data) expect(Object.keys(b).sort()).toEqual(['id', 'name', 'region']);
  });

  it('계약 종료(TERMINATED) 지점은 빠지고, 나머지 지점은 모두 있다', async () => {
    await setBranchStatus(BRANCH.seocho, 'TERMINATED');
    const res = await get();
    const ids = res.body.data.map((b: { id: string }) => b.id);
    expect(ids).not.toContain(BRANCH.seocho);
    expect(ids).toContain(BRANCH.gangnam);
    expect(ids).toHaveLength(await db(app).branch.count({ where: { contractStatus: { not: 'TERMINATED' } } }));
  });

  it('인증이 필요한 GET /branches는 그대로 401이다(대조군)', async () => {
    expect((await request(app.getHttpServer()).get('/api/v1/branches')).status).toBe(401);
  });
});
