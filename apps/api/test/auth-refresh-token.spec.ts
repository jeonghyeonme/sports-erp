import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, createApp, db } from './helpers/app';
import { MOCK_DEMO_PASSWORD } from '../src/mock-data/demo-password';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * Refresh Token — 권한관리 A-6 "1회용(rotate)"과 ADR-AUTH-04(발급 시 만료·폐기 토큰 정리).
 * 정리가 없으면 로그인·갱신마다 행이 쌓여 무료 DB 용량을 압박한다(design-constants ⑮).
 */
describe('Refresh Token 회전과 정리', () => {
  let app: INestApplication;

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  const loginRaw = async (email: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: MOCK_DEMO_PASSWORD });
    expect(res.status).toBe(200);
    return res.body.data as { accessToken: string; refreshToken: string; user: { accountId: string } };
  };
  const refresh = (refreshToken: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken });

  it('갱신하면 새 토큰이 나오고, 쓴 토큰은 다시 쓸 수 없다(401)', async () => {
    const first = await loginRaw(ACCOUNTS.seochoMember);

    const rotated = await refresh(first.refreshToken);
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.refreshToken).not.toBe(first.refreshToken);

    const reused = await refresh(first.refreshToken);
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe('INVALID_REFRESH_TOKEN');

    const again = await refresh(rotated.body.data.refreshToken);
    expect(again.status).toBe(200);
  });

  it('발급할 때 그 계정의 만료·폐기 토큰만 지우고, 살아 있는 토큰과 다른 계정 토큰은 남긴다', async () => {
    const prisma = db(app);
    const member = await loginRaw(ACCOUNTS.seochoMember); // 살아 있는 세션(다른 기기라고 가정)
    const memberId = member.user.accountId;
    const other = await loginRaw(ACCOUNTS.seochoStaff);
    const otherId = other.user.accountId;

    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 86_400_000);
    await prisma.refreshToken.createMany({
      data: [
        { id: 'rt-member-expired', accountId: memberId, tokenHash: 'x', expiresAt: past },
        { id: 'rt-member-revoked', accountId: memberId, tokenHash: 'x', expiresAt: future, revokedAt: past },
        { id: 'rt-other-expired', accountId: otherId, tokenHash: 'x', expiresAt: past },
      ],
    });

    await loginRaw(ACCOUNTS.seochoMember); // 같은 계정의 새 로그인 → 정리

    const ids = (await prisma.refreshToken.findMany({ select: { id: true } })).map((r) => r.id);
    expect(ids).not.toContain('rt-member-expired');
    expect(ids).not.toContain('rt-member-revoked');
    expect(ids).toContain('rt-other-expired'); // 다른 계정 것은 그 계정이 발급받을 때 정리된다

    const memberRows = await prisma.refreshToken.count({ where: { accountId: memberId } });
    expect(memberRows).toBe(2); // 첫 로그인(살아 있음) + 방금 로그인

    const stillValid = await refresh(member.refreshToken); // 다른 기기 세션은 그대로 쓸 수 있다
    expect(stillValid.status).toBe(200);
  });

  it('로그아웃한 토큰은 다음 발급 때 지워지고, 그 토큰으로는 갱신할 수 없다', async () => {
    const prisma = db(app);
    const first = await loginRaw(ACCOUNTS.seochoMember);
    const accountId = first.user.accountId;

    const out = await request(app.getHttpServer()).post('/api/v1/auth/logout').send({ refreshToken: first.refreshToken });
    expect(out.status).toBe(200);
    expect(await prisma.refreshToken.count({ where: { accountId, revokedAt: { not: null } } })).toBe(1);

    await loginRaw(ACCOUNTS.seochoMember);
    expect(await prisma.refreshToken.count({ where: { accountId, revokedAt: { not: null } } })).toBe(0);
    expect((await refresh(first.refreshToken)).status).toBe(401);
  });
});
