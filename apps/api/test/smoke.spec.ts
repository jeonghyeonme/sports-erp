import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, createApp, login } from './helpers/app';

describe('스모크: 앱 부팅과 인증', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('토큰 없이 보호된 API를 호출하면 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/members');
    expect(res.status).toBe(401);
  });

  it('로그인하면 자기 정보를 조회할 수 있다', async () => {
    const auth = await login(app, ACCOUNTS.seochoAdmin);
    const res = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ role: 'BRANCH_ADMIN', branchId: 'branch-seocho' });
  });

  it('잘못된 비밀번호는 로그인 실패', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ACCOUNTS.seochoAdmin, password: 'wrong-password' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
