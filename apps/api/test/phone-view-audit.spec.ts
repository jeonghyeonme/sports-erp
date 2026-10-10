import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D47 — 회원·직원 상세(전화번호 원문, ADR-MEM-04·STF-T03)를 관리자가 열면 AuditLog에 PHONE_VIEWED가 남는다.
 * 본인 조회·목록(마스킹)·번호 없는 상세·거부된 요청은 남지 않는다. 조회는 D44의 GET /audit-logs(본사 전용)로 한다.
 * 상세 조회가 쓰기를 하므로 테스트마다 워커 DB를 되돌린다.
 */
describe('상세 전화번호 열람 기록 — D47', () => {
  let app: INestApplication;
  const tok: Record<string, string> = {};

  const get = (auth: string, p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth);
  const views = () =>
    db(app).auditLog.findMany({ where: { action: 'PHONE_VIEWED' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const accountId = (email: string) => db(app).account.findFirstOrThrow({ where: { email, isActive: true } }).then((a) => a.id);

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    for (const [k, email] of Object.entries(ACCOUNTS)) tok[k] = await login(app, email);
  });
  afterEach(async () => {
    await app.close();
  });

  describe('기록한다', () => {
    it.each(['superAdmin', 'seochoAdmin'] as const)('%s가 회원 상세를 열면 처리자·대상·지점이 남는다', async (who) => {
      const res = await get(tok[who], '/members/member-sujin');
      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBe('010-1234-5678');

      const rows = await views();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId: await accountId(ACCOUNTS[who]),
        entity: 'Member',
        entityId: 'member-sujin',
        before: null,
        after: { branchId: BRANCH.seocho },
      });
    });

    it('관리자가 직원 상세를 열면 남고, 열 때마다 한 건씩 쌓인다', async () => {
      expect((await get(tok.seochoAdmin, '/staff/staff-seoyeon')).status).toBe(200);
      expect((await get(tok.superAdmin, '/staff/staff-seoyeon')).status).toBe(200);

      const rows = await views();
      expect(rows.map((r) => [r.entity, r.entityId, r.actorId])).toEqual([
        ['Staff', 'staff-seoyeon', await accountId(ACCOUNTS.seochoAdmin)],
        ['Staff', 'staff-seoyeon', await accountId(ACCOUNTS.superAdmin)],
      ]);
    });
  });

  describe('기록하지 않는다', () => {
    it('본인 조회 — 회원 웹 내 정보, 직원 본인 상세·me', async () => {
      expect((await get(tok.seochoMember, '/members/member-sujin')).status).toBe(200);
      expect((await get(tok.seochoStaff, '/staff/staff-seoyeon')).status).toBe(200);
      expect((await get(tok.seochoStaff, '/staff/me')).status).toBe(200);
      expect(await views()).toHaveLength(0);
    });

    it('목록(마스킹)은 남지 않는다', async () => {
      expect((await get(tok.seochoAdmin, `/members?branchId=${BRANCH.seocho}`)).status).toBe(200);
      expect((await get(tok.seochoAdmin, `/staff?branchId=${BRANCH.seocho}`)).status).toBe(200);
      expect(await views()).toHaveLength(0);
    });

    it('번호가 비어 있는 상세는 드러난 원문이 없어 남지 않는다', async () => {
      await db(app).member.update({ where: { id: 'member-sujin' }, data: { phone: null } });
      expect((await get(tok.seochoAdmin, '/members/member-sujin')).status).toBe(200);
      expect(await views()).toHaveLength(0);
    });

    it('다른 지점 관리자의 상세 요청은 거부(403)되고 남지 않는다 — 자기 지점 대조군은 남는다', async () => {
      expect((await get(tok.gangnamAdmin, '/members/member-sujin')).status).toBe(403);
      expect((await get(tok.gangnamAdmin, '/staff/staff-seoyeon')).status).toBe(403);
      expect(await views()).toHaveLength(0);

      expect((await get(tok.seochoAdmin, '/members/member-sujin')).status).toBe(200);
      expect(await views()).toHaveLength(1);
    });
  });

  describe('조회 GET /audit-logs?action=PHONE_VIEWED — 본사만', () => {
    it('대상 회원·직원 이름과 처리자 이름이 붙는다', async () => {
      await get(tok.seochoAdmin, '/members/member-sujin');
      await get(tok.seochoAdmin, '/staff/staff-seoyeon');

      const res = await get(tok.superAdmin, '/audit-logs?action=PHONE_VIEWED');
      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(2);
      const byEntity = Object.fromEntries(
        res.body.data.map((r: { entity: string; entityName?: string; actorName?: string }) => [r.entity, r]),
      );
      expect(byEntity.Member).toMatchObject({ entityName: '이수진', actorName: '김민수' });
      expect(byEntity.Staff).toMatchObject({ entityName: '박서연', actorName: '김민수' });
    });

    it('지점 관리자는 열람 기록을 볼 수 없다(403)', async () => {
      expect((await get(tok.seochoAdmin, '/audit-logs?action=PHONE_VIEWED')).status).toBe(403);
    });
  });
});
