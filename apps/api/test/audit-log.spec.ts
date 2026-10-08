import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D44 — 인사 변경 3종(역할 변경·퇴사·파견)은 같은 트랜잭션에서 AuditLog에 남고, 조회는 본사(SUPER_ADMIN)만 한다.
 * 실패·거부된 요청은 이력을 남기지 않는다(변경과 이력이 함께 롤백된다).
 * 테스트마다 워커 DB를 되돌린다 — 퇴사·파견이 다음 테스트의 직원 상태를 바꾸기 때문이다.
 */
describe('변경 이력(AuditLog) — D44', () => {
  let app: INestApplication;
  let staffId: string; // 서초점 직원(박서연, STAFF)
  const tok: Record<string, string> = {};

  const call = (auth: string, method: 'get' | 'post' | 'patch', path: string, body?: object) => {
    const r = request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', auth);
    return body ? r.send(body) : r;
  };
  const logs = () => db(app).auditLog.findMany({ where: { entityId: staffId }, orderBy: { createdAt: 'asc' } });
  const accountId = (email: string) => db(app).account.findFirstOrThrow({ where: { email, isActive: true } }).then((a) => a.id);

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    for (const [k, email] of Object.entries(ACCOUNTS)) tok[k] = await login(app, email);
    staffId = (await db(app).staff.findFirstOrThrow({ where: { branchId: BRANCH.seocho, name: '박서연' } })).id;
  });
  afterEach(async () => {
    await app.close();
  });

  describe('기록', () => {
    it('역할 변경 — 처리자·전후 역할이 남고, 같은 역할로의 변경은 남기지 않는다', async () => {
      expect((await call(tok.superAdmin, 'patch', `/permissions/staff/${staffId}/role`, { role: 'BRANCH_ADMIN' })).status).toBe(200);
      expect((await call(tok.superAdmin, 'patch', `/permissions/staff/${staffId}/role`, { role: 'BRANCH_ADMIN' })).status).toBe(200);

      const rows = await logs();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId: await accountId(ACCOUNTS.superAdmin),
        entity: 'Staff',
        action: 'ROLE_CHANGED',
        before: { role: 'STAFF' },
        after: { role: 'BRANCH_ADMIN' },
      });
    });

    it('퇴사 — 지점 관리자가 처리자로 남고, 이미 퇴사한 직원을 다시 처리하면(409) 이력이 늘지 않는다', async () => {
      expect((await call(tok.seochoAdmin, 'patch', `/staff/${staffId}/resign`)).status).toBe(200);
      expect((await call(tok.seochoAdmin, 'patch', `/staff/${staffId}/resign`)).status).toBe(409);

      const rows = await logs();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId: await accountId(ACCOUNTS.seochoAdmin),
        action: 'RESIGNED',
        before: { status: 'ACTIVE', branchId: BRANCH.seocho },
        after: { status: 'RESIGNED' },
      });
    });

    it('파견 — 전후 지점이 남는다', async () => {
      const res = await call(tok.superAdmin, 'post', `/staff/${staffId}/assignments`, { branchId: BRANCH.gangnam, note: '인력 보강' });
      expect(res.status).toBe(201);

      const rows = await logs();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId: await accountId(ACCOUNTS.superAdmin),
        action: 'ASSIGNED',
        before: { branchId: BRANCH.seocho },
        after: { branchId: BRANCH.gangnam, note: '인력 보강' },
      });
    });

    it('실패한 파견(없는 지점 404)과 권한 없는 역할 변경(403)은 이력을 남기지 않는다', async () => {
      expect((await call(tok.superAdmin, 'post', `/staff/${staffId}/assignments`, { branchId: 'branch-none' })).status).toBe(404);
      expect((await call(tok.seochoAdmin, 'patch', `/permissions/staff/${staffId}/role`, { role: 'BRANCH_ADMIN' })).status).toBe(403);
      expect(await logs()).toHaveLength(0);
    });
  });

  describe('조회 GET /audit-logs — 본사만', () => {
    it('최신순으로 처리자·대상 이름과 페이지 정보를 준다', async () => {
      await call(tok.superAdmin, 'patch', `/permissions/staff/${staffId}/role`, { role: 'BRANCH_ADMIN' });
      await call(tok.superAdmin, 'post', `/staff/${staffId}/assignments`, { branchId: BRANCH.gangnam });

      const res = await call(tok.superAdmin, 'get', `/audit-logs?entity=Staff&entityId=${staffId}`);
      expect(res.status).toBe(200);
      expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 2 });
      expect(res.body.data.map((r: { action: string }) => r.action)).toEqual(['ASSIGNED', 'ROLE_CHANGED']);
      expect(res.body.data[0]).toMatchObject({ actorName: '정하늘', entityName: '박서연' });
    });

    it('limit은 100을 넘지 않는다', async () => {
      const res = await call(tok.superAdmin, 'get', '/audit-logs?limit=1000');
      expect(res.status).toBe(200);
      expect(res.body.meta.pageSize).toBe(100);
    });

    it.each([
      ['지점 관리자', 'seochoAdmin'],
      ['직원', 'seochoStaff'],
      ['회원', 'seochoMember'],
    ])('%s — 조회할 수 없다(403)', async (_label, who) => {
      const res = await call(tok[who], 'get', '/audit-logs');
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
