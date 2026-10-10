import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * 퇴사·Role 전환의 "재로그인 없이 즉시 반영" — domains/권한관리.md ADR-AUTH-01, §11 "검증되지 않음" 항목 해소.
 * JwtStrategy가 매 요청 Account를 PK 재조회해 isActive/role을 다시 구성하므로,
 * 이미 발급된 Access Token이 있어도 퇴사 처리·Role 전환 직후 다음 요청부터 바로 반영되어야 한다
 * (토큰 만료를 기다리지 않음 — 불변규칙: 퇴사자는 즉시 접근 차단).
 */
describe('인증 상태의 즉시 반영 (퇴사·Role 전환)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    await resetWorkerDb(); // D30 — 테스트마다 퇴사·Role 전환 전 상태에서 시작
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  // D26에서 skip했던 두 테스트 — D30으로 퇴사·Role 전환이 DB 계정을 바꾸면서 다시 통과한다(skip 해제).
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

  // log/102 — 계정·프로필·소속 지점 이름을 Prisma 작업 하나로 읽도록 합쳤다. 매 요청 재조회(ADR-AUTH-01)는 그대로라
  // 지점 이름도 파견 직후 같은 토큰의 다음 요청부터 바뀌어야 한다.
  it('소속 지점 이름 — 직원·회원은 소속 지점, 본사는 없음, 파견 직후 같은 토큰에서 새 지점', async () => {
    const me = async (auth: string) => (await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', auth)).body.data;
    const staffToken = await login(app, ACCOUNTS.seochoStaff);
    const superToken = await login(app, ACCOUNTS.superAdmin);

    expect(await me(staffToken)).toMatchObject({ branchId: BRANCH.seocho, branchName: '서초점' });
    expect(await me(await login(app, ACCOUNTS.seochoMember))).toMatchObject({ branchId: BRANCH.seocho, branchName: '서초점' });
    const hq = await me(superToken);
    expect(hq.branchId).toBeUndefined();
    expect(hq.branchName).toBeUndefined();

    const assignRes = await request(app.getHttpServer())
      .post('/api/v1/staff/staff-seoyeon/assignments')
      .set('Authorization', superToken)
      .send({ branchId: BRANCH.gangnam });
    expect(assignRes.status).toBeLessThan(300);
    expect(await me(staffToken)).toMatchObject({ branchId: BRANCH.gangnam, branchName: '강남점' });
  });
});
