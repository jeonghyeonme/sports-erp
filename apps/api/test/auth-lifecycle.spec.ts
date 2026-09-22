import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, createApp, login } from './helpers/app';

/**
 * 퇴사·Role 전환의 "재로그인 없이 즉시 반영" — domains/권한관리.md ADR-AUTH-01, §11 "검증되지 않음" 항목 해소.
 * JwtStrategy가 매 요청 Account를 PK 재조회해 isActive/role을 다시 구성하므로,
 * 이미 발급된 Access Token이 있어도 퇴사 처리·Role 전환 직후 다음 요청부터 바로 반영되어야 한다
 * (토큰 만료를 기다리지 않음 — 불변규칙: 퇴사자는 즉시 접근 차단).
 */
describe('인증 상태의 즉시 반영 (퇴사·Role 전환)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('로그인된 상태에서 퇴사 처리 → 같은 토큰으로 바로 다음 요청이 401(ACCOUNT_INACTIVE)', async () => {
    const staffToken = await login(app, ACCOUNTS.seochoStaff);

    // 퇴사 처리 전엔 정상 접근 가능(대조군)
    const before = await request(app.getHttpServer())
      .get('/api/v1/staff/me')
      .set('Authorization', staffToken);
    expect(before.status).toBe(200);

    const adminToken = await login(app, ACCOUNTS.seochoAdmin);
    const resignRes = await request(app.getHttpServer())
      .patch('/api/v1/staff/staff-seoyeon/resign')
      .set('Authorization', adminToken);
    expect(resignRes.status).toBe(200);

    // 같은 토큰, 재로그인 없이 바로 다음 요청 — 토큰은 아직 만료 전이다.
    const after = await request(app.getHttpServer())
      .get('/api/v1/staff/me')
      .set('Authorization', staffToken);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  it('Role 전환 직후(재로그인 없이) 같은 토큰으로 새 Role 권한의 API가 바로 열린다', async () => {
    const staffToken = await login(app, ACCOUNTS.seochoStaff);

    // 전환 전엔 BRANCH_ADMIN 전용 API 접근 불가(대조군)
    const before = await request(app.getHttpServer()).get('/api/v1/staff').set('Authorization', staffToken);
    expect(before.status).toBe(403);

    const superToken = await login(app, ACCOUNTS.superAdmin);
    const roleRes = await request(app.getHttpServer())
      .patch('/api/v1/permissions/staff/staff-seoyeon/role')
      .set('Authorization', superToken)
      .send({ role: 'BRANCH_ADMIN' });
    expect(roleRes.status).toBe(200);

    const after = await request(app.getHttpServer()).get('/api/v1/staff').set('Authorization', staffToken);
    expect(after.status).toBe(200);
  });
});
