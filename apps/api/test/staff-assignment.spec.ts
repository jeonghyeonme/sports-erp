import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MOCK_DEMO_PASSWORD } from '../src/mock-data/mock-data.service';
import { ACCOUNTS, BRANCH, createApp, login } from './helpers/app';

/**
 * 파견 발령·퇴사 처리의 실제 효과 — domains/인사정보관리.md §11 "검증되지 않음" 항목 해소.
 * 파견 발령은 Staff.branchId뿐 아니라 연결된 Account.branchId도 함께 갱신해야
 * "재로그인 없이 즉시 반영"(권한관리 ADR-AUTH-01과 같은 메커니즘)이 실제로 성립한다.
 */
describe('파견 발령·퇴사 처리의 실제 효과', () => {
  let app: INestApplication;
  const STAFF_ID = 'staff-seoyeon'; // 서초점 소속 박서연

  beforeEach(async () => {
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('파견 발령 후 예전 지점 관리자는 접근을 잃고, 새 지점 관리자는 재로그인 없이 즉시 접근한다', async () => {
    const seochoAdminToken = await login(app, ACCOUNTS.seochoAdmin);
    const gangnamAdminToken = await login(app, ACCOUNTS.gangnamAdmin); // 발령 전에 미리 로그인해 둔다
    const superToken = await login(app, ACCOUNTS.superAdmin);

    // 발령 전: 서초 관리자는 접근 가능, 강남 관리자는 불가(대조군)
    const before = await request(app.getHttpServer())
      .get(`/api/v1/staff/${STAFF_ID}`)
      .set('Authorization', seochoAdminToken);
    expect(before.status).toBe(200);
    const beforeGangnam = await request(app.getHttpServer())
      .get(`/api/v1/staff/${STAFF_ID}`)
      .set('Authorization', gangnamAdminToken);
    expect(beforeGangnam.status).toBe(403);

    const assignRes = await request(app.getHttpServer())
      .post(`/api/v1/staff/${STAFF_ID}/assignments`)
      .set('Authorization', superToken)
      .send({ branchId: BRANCH.gangnam });
    expect(assignRes.status).toBeLessThan(300);

    // 발령 후: 같은 토큰들로, 재로그인 없이 즉시 뒤바뀐다.
    const afterSeocho = await request(app.getHttpServer())
      .get(`/api/v1/staff/${STAFF_ID}`)
      .set('Authorization', seochoAdminToken);
    expect(afterSeocho.status).toBe(403);

    const afterGangnam = await request(app.getHttpServer())
      .get(`/api/v1/staff/${STAFF_ID}`)
      .set('Authorization', gangnamAdminToken);
    expect(afterGangnam.status).toBe(200);
    expect(afterGangnam.body.data.branchId).toBe(BRANCH.gangnam);
  });

  it('파견 이력에 새 레코드가 생기고, 활성(endDate 없음) 레코드는 항상 최대 1건이다', async () => {
    const superToken = await login(app, ACCOUNTS.superAdmin);
    const before = await request(app.getHttpServer())
      .get(`/api/v1/staff/${STAFF_ID}/assignments`)
      .set('Authorization', superToken);
    const activeBefore = before.body.data.filter((a: { endDate?: string }) => !a.endDate);
    expect(activeBefore).toHaveLength(1);

    await request(app.getHttpServer())
      .post(`/api/v1/staff/${STAFF_ID}/assignments`)
      .set('Authorization', superToken)
      .send({ branchId: BRANCH.gangnam });

    const after = await request(app.getHttpServer())
      .get(`/api/v1/staff/${STAFF_ID}/assignments`)
      .set('Authorization', superToken);
    const activeAfter = after.body.data.filter((a: { endDate?: string }) => !a.endDate);
    expect(activeAfter).toHaveLength(1); // 여전히 활성은 1건(불변규칙 2)
    expect(activeAfter[0].branchId).toBe(BRANCH.gangnam);
    expect(after.body.data.length).toBe(before.body.data.length + 1); // 새 레코드 1건 추가, 기존 것은 마감됨(삭제 아님)
  });

  it('퇴사 처리 후 해당 계정은 로그인 자체가 실패한다(ACCOUNT_INACTIVE)', async () => {
    const adminToken = await login(app, ACCOUNTS.seochoAdmin);
    const resignRes = await request(app.getHttpServer())
      .patch(`/api/v1/staff/${STAFF_ID}/resign`)
      .set('Authorization', adminToken);
    expect(resignRes.status).toBe(200);
    expect(resignRes.body.data.status).toBe('RESIGNED');

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ACCOUNTS.seochoStaff, password: MOCK_DEMO_PASSWORD });
    expect(loginRes.status).toBe(401);
    expect(loginRes.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  it('퇴사 처리 시 활성 StaffAssignment도 함께 마감된다', async () => {
    const adminToken = await login(app, ACCOUNTS.seochoAdmin);
    const superToken = await login(app, ACCOUNTS.superAdmin);
    await request(app.getHttpServer()).patch(`/api/v1/staff/${STAFF_ID}/resign`).set('Authorization', adminToken);

    const history = await request(app.getHttpServer())
      .get(`/api/v1/staff/${STAFF_ID}/assignments`)
      .set('Authorization', superToken);
    const active = history.body.data.filter((a: { endDate?: string }) => !a.endDate);
    expect(active).toHaveLength(0);
  });
});
