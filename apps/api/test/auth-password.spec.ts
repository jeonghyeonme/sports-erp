import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MOCK_DEMO_PASSWORD } from '../src/fixtures/demo-password';
import { ACCOUNTS, BRANCH, createApp, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * 권한관리 A-5 PATCH /auth/password — 사용자 결정(log/091):
 * 데모 계정 5개는 403, 현재 비밀번호 불일치는 400(401이면 클라이언트가 세션 만료로 처리한다), 바꾸면 refresh token 전부 폐기.
 * 데모 계정이 아닌 계정은 본사 채용(POST /staff)으로 만든다 — 채용 계정도 같은 임시 비밀번호로 시작한다.
 */
describe('비밀번호 변경 PATCH /auth/password', () => {
  let app: INestApplication;
  const EMAIL = 'pw.change@spoism.example';
  const NEW_PASSWORD = 'new-secret-5678';

  const http = () => request(app.getHttpServer());
  const rawLogin = (email: string, password: string) => http().post('/api/v1/auth/login').send({ email, password });
  const change = (auth: string, currentPassword: string, newPassword: string) =>
    http().patch('/api/v1/auth/password').set('Authorization', auth).send({ currentPassword, newPassword });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    const hire = await http()
      .post('/api/v1/staff')
      .set('Authorization', await login(app, ACCOUNTS.superAdmin))
      .send({ branchId: BRANCH.seocho, name: '변경테스트', email: EMAIL });
    expect(hire.status).toBe(201);
  });
  afterEach(async () => {
    await app.close();
  });

  it('바꾸면 새 비밀번호로만 로그인되고, 그 전에 받은 refresh token은 모두 폐기된다', async () => {
    const first = await rawLogin(EMAIL, MOCK_DEMO_PASSWORD); // 다른 기기 세션
    const second = await rawLogin(EMAIL, MOCK_DEMO_PASSWORD); // 지금 바꾸는 세션
    const res = await change(`Bearer ${second.body.data.accessToken}`, MOCK_DEMO_PASSWORD, NEW_PASSWORD);
    expect(res.status).toBe(200);

    expect((await rawLogin(EMAIL, MOCK_DEMO_PASSWORD)).status).toBe(401);
    expect((await rawLogin(EMAIL, NEW_PASSWORD)).status).toBe(200);
    for (const s of [first, second]) {
      const refreshed = await http().post('/api/v1/auth/refresh').send({ refreshToken: s.body.data.refreshToken });
      expect(refreshed.status).toBe(401);
    }
  });

  it('현재 비밀번호가 틀리면 400 CURRENT_PASSWORD_MISMATCH이고 아무것도 바뀌지 않는다', async () => {
    const session = await rawLogin(EMAIL, MOCK_DEMO_PASSWORD);
    const res = await change(`Bearer ${session.body.data.accessToken}`, 'wrong-password', NEW_PASSWORD);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CURRENT_PASSWORD_MISMATCH');

    expect((await rawLogin(EMAIL, MOCK_DEMO_PASSWORD)).status).toBe(200);
    const refreshed = await http().post('/api/v1/auth/refresh').send({ refreshToken: session.body.data.refreshToken });
    expect(refreshed.status).toBe(200); // 실패한 변경은 세션을 끊지 않는다
  });

  it('새 비밀번호가 8자 미만이면 400 VALIDATION_ERROR', async () => {
    const res = await change(await login(app, EMAIL), MOCK_DEMO_PASSWORD, 'short');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['본사 관리자', ACCOUNTS.superAdmin],
    ['지점 관리자', ACCOUNTS.seochoAdmin],
    ['회원', ACCOUNTS.seochoMember],
  ])('데모 계정(%s)은 403 DEMO_ACCOUNT_LOCKED이고 데모 비밀번호가 그대로다', async (_label, email) => {
    const res = await change(await login(app, email), MOCK_DEMO_PASSWORD, NEW_PASSWORD);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DEMO_ACCOUNT_LOCKED');
    expect((await rawLogin(email, MOCK_DEMO_PASSWORD)).status).toBe(200);
  });
});
