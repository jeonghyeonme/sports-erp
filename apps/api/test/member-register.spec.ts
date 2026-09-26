import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, login, mockData } from './helpers/app';

/**
 * 회원관리 도메인 — ADR-MEM-02(앱 회원가입, 탈퇴 회원 이메일 재사용 = 부분 unique).
 * MockDataService가 인메모리 상태를 가지므로 테스트마다 새 앱을 띄운다.
 */
describe('POST /members/register (앱 회원가입)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  const register = (body: Partial<Record<string, unknown>>) =>
    request(app.getHttpServer())
      .post('/api/v1/members/register')
      .send({
        branchId: BRANCH.seocho,
        name: '신규가입자',
        email: 'newbie@example.com',
        password: 'register-pass-1',
        ...body,
      });

  it('Account+Member를 동시에 만들고 즉시 로그인 토큰을 돌려준다', async () => {
    const res = await register({});
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user).toMatchObject({ role: 'MEMBER', branchId: BRANCH.seocho });
    expect(res.body.data.member).toMatchObject({ name: '신규가입자', branchId: BRANCH.seocho, status: 'ACTIVE' });

    const member = mockData(app).members.find((m) => m.id === res.body.data.member.id);
    expect(member?.accountId).toBeDefined();
  });

  it('가입 후 그 계정으로 실제 로그인이 된다', async () => {
    await register({});
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'newbie@example.com', password: 'register-pass-1' });
    expect(res.status).toBe(200);
  });

  it('계약종료 지점에는 신규 가입이 409 BRANCH_TERMINATED(불변규칙 2)', async () => {
    mockData(app).branches.find((b) => b.id === BRANCH.seocho)!.contractStatus = 'TERMINATED';
    const res = await register({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BRANCH_TERMINATED');
  });

  it('만 19세 미만이 법정대리인 동의 없이 가입하면 400 GUARDIAN_CONSENT_REQUIRED(불변규칙 3)', async () => {
    const res = await register({ birthDate: '2015-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('GUARDIAN_CONSENT_REQUIRED');
  });

  it('미성년이어도 법정대리인 동의가 있으면 가입된다(대조군)', async () => {
    const res = await register({ birthDate: '2015-01-01', guardianConsent: true });
    expect(res.status).toBe(201);
  });

  it('이미 활성 계정이 쓰는 이메일이면 409 EMAIL_ALREADY_EXISTS', async () => {
    const res = await register({ email: 'kim.minsu@spoism.example' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('ADR-MEM-02 핵심 — 탈퇴 회원과 같은 이메일로 재가입할 수 있다(부분 unique: 활성 계정끼리만 유일)', async () => {
    // 기존 회원(이수진, member-sujin/account-sujin)을 탈퇴시켜 계정을 비활성화한다.
    const admin = await login(app, ACCOUNTS.seochoAdmin);
    const withdraw = await request(app.getHttpServer())
      .patch('/api/v1/members/member-sujin/status')
      .set('Authorization', admin)
      .send({ status: 'WITHDRAWN' });
    expect(withdraw.status).toBe(200);

    const sujinAccount = mockData(app).accounts.find((a) => a.id === 'account-sujin');
    expect(sujinAccount?.isActive).toBe(false);

    // 같은 이메일(sujin의 원래 이메일)로 새로 가입 — 이메일 값을 변형하지 않고 그대로 뒀기 때문에 가능해야 한다.
    const res = await register({ email: sujinAccount!.email, name: '새로운가입자' });
    expect(res.status).toBe(201);

    // 원래 탈퇴 계정의 이메일은 그대로 보존돼 있다(대안 B의 "값 변형" 방식이 아님을 확인).
    expect(mockData(app).accounts.find((a) => a.id === 'account-sujin')?.email).toBe(sujinAccount!.email);
  });

  it('이메일 중복 검사가 먼저라 실패 시 Member가 생성되지 않는다(롤백 대신 순서로 방지)', async () => {
    const before = mockData(app).members.length;
    await register({ email: 'kim.minsu@spoism.example' });
    expect(mockData(app).members.length).toBe(before);
  });

  it('존재하지 않는 지점이면 404 BRANCH_NOT_FOUND', async () => {
    const res = await register({ branchId: 'branch-none' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BRANCH_NOT_FOUND');
  });
});
