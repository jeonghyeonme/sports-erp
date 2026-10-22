import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * 보안-6(security-plan S3, log/164) — 본사가 채용한 직원은 무작위 임시 비밀번호로 시작하고, 바꾸기 전에는
 * 내 정보·비밀번호 변경만 된다(나머지 403 PASSWORD_CHANGE_REQUIRED). 바꾸면 풀린다. 판정은 서버(JwtAuthGuard).
 */
describe('임시 비밀번호 — 첫 로그인 변경 강제', () => {
  let app: INestApplication;
  let temp: string;
  const EMAIL = 'first.login@spoism.example';
  const NEW_PASSWORD = 'first-change-77';
  const http = () => request(app.getHttpServer());
  const rawLogin = (password: string) => http().post('/api/v1/auth/login').send({ email: EMAIL, password });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    const hire = await http()
      .post('/api/v1/staff')
      .set('Authorization', await login(app, ACCOUNTS.superAdmin))
      .send({ branchId: BRANCH.seocho, name: '첫로그인', email: EMAIL });
    expect(hire.status).toBe(201);
    temp = hire.body.data.temporaryPassword;
  });
  afterEach(async () => {
    await app.close();
  });

  it('임시 비밀번호로 로그인하면 mustChangePassword가 실리고, 내 정보는 되지만 업무 화면 API는 403', async () => {
    const session = await rawLogin(temp);
    expect(session.status).toBe(200);
    expect(session.body.data.user.mustChangePassword).toBe(true);
    const auth = `Bearer ${session.body.data.accessToken}`;

    const me = await http().get('/api/v1/auth/me').set('Authorization', auth);
    expect(me.status).toBe(200);
    expect(me.body.data.mustChangePassword).toBe(true);

    for (const path of ['/programs', '/posts', '/attendance', '/leave-requests']) {
      const res = await http().get(`/api/v1${path}`).set('Authorization', auth);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    }
  });

  it('바꾸면 풀린다 — 새 비밀번호로 로그인하면 표시가 없고 업무 API가 된다', async () => {
    const auth = `Bearer ${(await rawLogin(temp)).body.data.accessToken}`;
    const changed = await http().patch('/api/v1/auth/password').set('Authorization', auth).send({
      currentPassword: temp,
      newPassword: NEW_PASSWORD,
    });
    expect(changed.status).toBe(200);

    const session = await rawLogin(NEW_PASSWORD);
    expect(session.body.data.user.mustChangePassword).toBeUndefined();
    const programs = await http().get('/api/v1/programs').set('Authorization', `Bearer ${session.body.data.accessToken}`);
    expect(programs.status).toBe(200);
  });

  it('대조군: 기존 계정(데모 직원)은 표시가 없고 같은 API가 된다', async () => {
    const auth = await login(app, ACCOUNTS.seochoStaff);
    const me = await http().get('/api/v1/auth/me').set('Authorization', auth);
    expect(me.body.data.mustChangePassword).toBeUndefined();
    expect((await http().get('/api/v1/programs').set('Authorization', auth)).status).toBe(200);
  });
});
