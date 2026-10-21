import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';
import { MOCK_DEMO_PASSWORD } from '../src/fixtures/demo-password';

/**
 * D60 2단계(권한관리 ADR-AUTH-07) — 본사가 역할 기본값·개인 예외를 바꾸는 API.
 * 바꾸면 같은 앱에서 바로 판정이 바뀌고(역할 기본값은 캐시를 비운다), 변경 이력 PERMISSION_CHANGED가 남는다.
 */
describe('세부 권한 관리 API (D60 2단계)', () => {
  let app: INestApplication;
  let hq: string;

  const api = (auth: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth),
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
    put: (p: string, b?: object) => request(app.getHttpServer()).put(`/api/v1${p}`).set('Authorization', auth).send(b),
  });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    hq = await login(app, ACCOUNTS.superAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  it('카탈로그와 역할 표 — 처음엔 상한 칸이 모두 허용', async () => {
    const catalog = (await api(hq).get('/permissions/catalog')).body.data;
    expect(catalog.roles).toEqual(['BRANCH_ADMIN', 'STAFF']);
    expect(catalog.features.find((f: { feature: string }) => f.feature === 'member').label).toBe('회원');
    const matrix = (await api(hq).get('/permissions/roles')).body.data;
    expect(matrix.BRANCH_ADMIN.length).toBeGreaterThan(30);
    expect(matrix.STAFF.map((c: { feature: string }) => c.feature)).toEqual(['program', 'post', 'facility', 'instructor']);
    expect([...matrix.BRANCH_ADMIN, ...matrix.STAFF].every((c: { allowed: boolean }) => c.allowed)).toBe(true);
  });

  it('역할 칸을 끄면 바로 403, 다시 켜면 행이 지워지고 허용 — 변경 이력 두 건', async () => {
    const minsu = await login(app, ACCOUNTS.seochoAdmin);
    const off = await api(hq).put('/permissions/roles/BRANCH_ADMIN', { feature: 'member', action: 'CREATE', allowed: false });
    expect(off.status).toBe(200);
    expect(off.body.data.find((c: { feature: string; action: string }) => c.feature === 'member' && c.action === 'CREATE').allowed).toBe(false);
    expect((await api(minsu).post('/members', { name: '막힘' })).body.error.code).toBe('PERMISSION_DENIED');
    // 같은 값을 다시 보내면 아무것도 바뀌지 않는다(이력도 없음)
    await api(hq).put('/permissions/roles/BRANCH_ADMIN', { feature: 'member', action: 'CREATE', allowed: false });

    await api(hq).put('/permissions/roles/BRANCH_ADMIN', { feature: 'member', action: 'CREATE', allowed: true });
    expect(await db(app).rolePermission.count()).toBe(0);
    expect((await api(minsu).post('/members', { name: '다시 허용' })).status).toBe(201);

    const logs = await db(app).auditLog.findMany({ where: { action: 'PERMISSION_CHANGED' }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => [l.entity, l.entityId, (l.after as { allowed: boolean }).allowed])).toEqual([
      ['Role', 'BRANCH_ADMIN', false],
      ['Role', 'BRANCH_ADMIN', true],
    ]);
    const view = (await api(hq).get('/audit-logs?action=PERMISSION_CHANGED')).body.data;
    expect(view[0].entityName).toBe('지점 관리자(역할)');
  });

  it('개인 예외 — 허용·차단·기본값, 실제 적용 값과 이력', async () => {
    await api(hq).put('/permissions/roles/BRANCH_ADMIN', { feature: 'member', action: 'CREATE', allowed: false });
    const allow = await api(hq).put('/permissions/staff/staff-minsu/overrides', { feature: 'member', action: 'CREATE', mode: 'ALLOW' });
    expect(allow.status).toBe(200);
    const cell = allow.body.data.cells.find((c: { feature: string; action: string }) => c.feature === 'member' && c.action === 'CREATE');
    expect(cell).toMatchObject({ roleDefault: false, override: true, effective: true });

    const minsu = await login(app, ACCOUNTS.seochoAdmin);
    const gangnam = await login(app, ACCOUNTS.gangnamAdmin);
    expect((await api(minsu).post('/members', { name: '개인 허용' })).status).toBe(201);
    expect((await api(gangnam).post('/members', { name: '막힘' })).status).toBe(403);

    await api(hq).put('/permissions/staff/staff-minsu/overrides', { feature: 'member', action: 'READ', mode: 'DENY' });
    expect((await api(minsu).get('/members')).body.error.code).toBe('PERMISSION_DENIED');
    const reset = await api(hq).put('/permissions/staff/staff-minsu/overrides', { feature: 'member', action: 'READ', mode: 'DEFAULT' });
    expect(reset.body.data.cells.find((c: { feature: string; action: string }) => c.feature === 'member' && c.action === 'READ'))
      .toMatchObject({ override: null, effective: true });
    expect((await api(minsu).get('/members')).status).toBe(200);

    const logs = await db(app).auditLog.findMany({ where: { action: 'PERMISSION_CHANGED', entity: 'Staff' } });
    expect(logs).toHaveLength(3);
    expect(logs.every((l) => l.entityId === 'staff-minsu' && l.actorId === 'account-haneul')).toBe(true);
  });

  it('상한 밖 칸·표 밖 역할·모르는 기능은 400, 없는 직원은 404', async () => {
    const outside = await api(hq).put('/permissions/roles/STAFF', { feature: 'member', action: 'CREATE', allowed: false });
    expect([outside.status, outside.body.error.code]).toEqual([400, 'PERMISSION_OUTSIDE_CEILING']);
    const superRole = await api(hq).put('/permissions/roles/SUPER_ADMIN', { feature: 'member', action: 'READ', allowed: false });
    expect([superRole.status, superRole.body.error.code]).toEqual([400, 'PERMISSION_ROLE_NOT_GOVERNED']);
    const unknown = await api(hq).put('/permissions/roles/BRANCH_ADMIN', { feature: 'payroll', action: 'READ', allowed: false });
    expect(unknown.body.error.code).toBe('PERMISSION_OUTSIDE_CEILING');
    // 직원(박서연)에게 회원 입력 허용 — 상한 밖
    const staffOutside = await api(hq).put('/permissions/staff/staff-seoyeon/overrides', { feature: 'member', action: 'CREATE', mode: 'ALLOW' });
    expect(staffOutside.body.error.code).toBe('PERMISSION_OUTSIDE_CEILING');
    expect((await api(hq).get('/permissions/staff/no-such/overrides')).status).toBe(404);
    expect(await db(app).accountPermission.count()).toBe(0);
  });

  it('본사만 — 지점 관리자는 자기 권한도 못 바꾼다(대조군: 본사 200)', async () => {
    const minsu = await login(app, ACCOUNTS.seochoAdmin);
    expect((await api(minsu).get('/permissions/roles')).status).toBe(403);
    expect(
      (await api(minsu).put('/permissions/staff/staff-minsu/overrides', { feature: 'member', action: 'READ', mode: 'ALLOW' })).status,
    ).toBe(403);
    expect((await api(hq).get('/permissions/roles')).status).toBe(200);
  });

  it('로그인·/auth/me가 적용 권한을 내려 준다(3단계 화면 숨김용) — 본사·회원은 없다', async () => {
    await api(hq).put('/permissions/roles/BRANCH_ADMIN', { feature: 'member', action: 'CREATE', allowed: false });
    await api(hq).put('/permissions/staff/staff-minsu/overrides', { feature: 'member', action: 'EXPORT', mode: 'DENY' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ACCOUNTS.seochoAdmin, password: MOCK_DEMO_PASSWORD });
    const eff = res.body.data.user.effectivePermissions as Record<string, boolean>;
    expect(eff['member:CREATE']).toBe(false); // 역할 기본값
    expect(eff['member:EXPORT']).toBe(false); // 개인 예외
    expect(eff['member:READ']).toBe(true);
    expect(res.body.data.user.permissions).toBeUndefined(); // 개인 예외 원본은 내보내지 않는다
    const me = (await api(`Bearer ${res.body.data.accessToken}`).get('/auth/me')).body.data;
    expect(me.effectivePermissions).toEqual(eff);
    // 직원은 상한 칸 4개만, 본사는 표 밖
    const staff = await login(app, ACCOUNTS.seochoStaff);
    expect(Object.keys((await api(staff).get('/auth/me')).body.data.effectivePermissions).sort()).toEqual([
      'facility:READ',
      'instructor:READ',
      'post:READ',
      'program:READ',
    ]);
    expect((await api(hq).get('/auth/me')).body.data.effectivePermissions).toBeUndefined();
  });
});
