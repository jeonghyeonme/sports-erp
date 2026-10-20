import { INestApplication } from '@nestjs/common';
import { PermissionAction, Role } from '@prisma/client';
import request from 'supertest';
import { PermissionService } from '../src/common/permissions/permission.service';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D60(권한관리 ADR-AUTH-07) — 세부 권한: 역할 상한(@Roles) 안에서 역할 기본값(RolePermission)·개인 예외(AccountPermission).
 * 판정 순서: 개인 예외 → 역할 기본값 → 허용. 개인 허용도 역할 상한·지점 격리를 넘지 못한다.
 * 변경 API·화면은 다음 단계라 여기서는 DB에 직접 쓴다. 역할 기본값은 30초 캐시라 쓰고 나서 invalidate()를 부른다.
 */
describe('세부 권한 (D60)', () => {
  let app: INestApplication;
  const MINSU = 'account-minsu'; // 서초 지점 관리자
  const SEOYEON = 'account-seoyeon'; // 서초 직원

  const api = (auth: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth),
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
  });
  const setRole = async (role: Role, feature: string, action: PermissionAction, allowed: boolean) => {
    await db(app).rolePermission.create({ data: { role, feature, action, allowed } });
    app.get(PermissionService).invalidate();
  };
  const setPersonal = (accountId: string, feature: string, action: PermissionAction, allowed: boolean) =>
    db(app).accountPermission.create({ data: { accountId, feature, action, allowed, grantedBy: 'account-haneul' } });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('행이 없으면 상한대로 허용된다(대조군)', async () => {
    const minsu = await login(app, ACCOUNTS.seochoAdmin);
    expect((await api(minsu).post('/members', { name: '권한 대조군' })).status).toBe(201);
    expect((await api(minsu).get('/members?export=true')).status).toBe(200);
  });

  it('역할 기본값에서 끄면 그 역할 전원이 403 — 다른 동작은 그대로', async () => {
    await setRole('BRANCH_ADMIN', 'member', 'CREATE', false);
    const minsu = await login(app, ACCOUNTS.seochoAdmin);
    const gangnam = await login(app, ACCOUNTS.gangnamAdmin);
    for (const tok of [minsu, gangnam]) {
      const res = await api(tok).post('/members', { name: '막힘' });
      expect([res.status, res.body.error.code]).toEqual([403, 'PERMISSION_DENIED']);
    }
    expect((await api(minsu).get('/members')).status).toBe(200);
    // 본사는 표 밖 — 영향 없다
    const hq = await login(app, ACCOUNTS.superAdmin);
    expect((await api(hq).get('/members')).status).toBe(200);
  });

  it('개인 허용은 역할에서 끈 칸을 그 사람에게만 되살린다', async () => {
    await setRole('BRANCH_ADMIN', 'member', 'CREATE', false);
    await setPersonal(MINSU, 'member', 'CREATE', true);
    const minsu = await login(app, ACCOUNTS.seochoAdmin);
    const gangnam = await login(app, ACCOUNTS.gangnamAdmin);
    expect((await api(minsu).post('/members', { name: '개인 허용' })).status).toBe(201);
    expect((await api(gangnam).post('/members', { name: '막힘' })).status).toBe(403);
  });

  it('개인 차단은 그 사람만 막고, 다음 요청부터 바로 반영된다(재로그인 없음)', async () => {
    const minsu = await login(app, ACCOUNTS.seochoAdmin);
    const gangnam = await login(app, ACCOUNTS.gangnamAdmin);
    expect((await api(minsu).get('/members')).status).toBe(200);
    await setPersonal(MINSU, 'member', 'READ', false);
    expect((await api(minsu).get('/members')).body.error.code).toBe('PERMISSION_DENIED');
    expect((await api(minsu).get(`/members/${(await db(app).member.findFirstOrThrow({ where: { branchId: BRANCH.seocho } })).id}`)).status).toBe(403);
    expect((await api(gangnam).get('/members')).status).toBe(200);
  });

  it('출력만 끄면 목록은 보이고 ?export=true만 403', async () => {
    await setRole('BRANCH_ADMIN', 'member', 'EXPORT', false);
    const minsu = await login(app, ACCOUNTS.seochoAdmin);
    expect((await api(minsu).get('/members')).status).toBe(200);
    const res = await api(minsu).get('/members?export=true');
    expect([res.status, res.body.error.code]).toEqual([403, 'PERMISSION_DENIED']);
  });

  it('개인 허용도 역할 상한을 넘지 못한다 — 직원에게 회원 입력을 허용해도 403', async () => {
    await setPersonal(SEOYEON, 'member', 'CREATE', true);
    const seoyeon = await login(app, ACCOUNTS.seochoStaff);
    const res = await api(seoyeon).post('/members', { name: '상한 초과' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).not.toBe('PERMISSION_DENIED'); // 역할 상한(RolesGuard)이 먼저 막는다
    expect(await db(app).member.count({ where: { name: '상한 초과' } })).toBe(0);
  });

  it('개인 허용도 지점 격리를 넘지 못한다', async () => {
    await setPersonal(MINSU, 'member', 'READ', true);
    const minsu = await login(app, ACCOUNTS.seochoAdmin);
    const foreign = await db(app).member.findFirstOrThrow({ where: { branchId: BRANCH.gangnam } });
    expect([403, 404]).toContain((await api(minsu).get(`/members/${foreign.id}`)).status);
  });

  it('직원 — 상한 안 칸(게시판 조회)은 끌 수 있고, 표 밖 본인 업무는 영향이 없다', async () => {
    await setRole('STAFF', 'post', 'READ', false);
    await setRole('STAFF', 'attendance', 'READ', false); // 직원 상한 밖 칸 — 효과 없음
    const seoyeon = await login(app, ACCOUNTS.seochoStaff);
    expect((await api(seoyeon).get('/posts')).body.error.code).toBe('PERMISSION_DENIED');
    expect((await api(seoyeon).get('/attendance')).status).toBe(200);
    expect((await api(seoyeon).post('/attendance/check-in')).status).toBe(201);
    // 지점 관리자는 영향 없다
    const minsu = await login(app, ACCOUNTS.seochoAdmin);
    expect((await api(minsu).get('/posts')).status).toBe(200);
  });

  it('역할 기본값은 30초 캐시 — invalidate() 전에는 이전 값으로 판정한다', async () => {
    const minsu = await login(app, ACCOUNTS.seochoAdmin);
    expect((await api(minsu).get('/programs')).status).toBe(200); // 캐시 채움
    await db(app).rolePermission.create({ data: { role: 'BRANCH_ADMIN', feature: 'program', action: 'READ', allowed: false } });
    expect((await api(minsu).get('/programs')).status).toBe(200);
    app.get(PermissionService).invalidate();
    expect((await api(minsu).get('/programs')).status).toBe(403);
  });

  it('DB 제약 — 역할 기본값은 지점 관리자·직원만', async () => {
    await expect(
      db(app).rolePermission.create({ data: { role: 'SUPER_ADMIN', feature: 'member', action: 'READ', allowed: false } }),
    ).rejects.toThrow();
  });
});
