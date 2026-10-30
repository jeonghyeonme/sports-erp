import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { todayKst, toKstDateString } from '../src/common/date/kst-date';
import { BranchService } from '../src/modules/branches/branch.service';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { setBranchStatus } from './helpers/branch-status';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D68 — 위탁계약 갱신·정정과 계약 이력. 본사만 쓰고, 갱신·정정·상태 변경은 변경과 같은 트랜잭션에서
 * AuditLog(entity 'Branch')에 남는다. 종료 지점은 갱신하지 못한다(409). 계약 종료 차단 규칙(loadGate)은 그대로다.
 */
describe('위탁계약 갱신·정정·이력 (D68)', () => {
  let app: INestApplication;
  let superAdmin: string;
  let seochoAdmin: string;

  const api = (auth: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth),
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
    patch: (p: string, b?: object) => request(app.getHttpServer()).patch(`/api/v1${p}`).set('Authorization', auth).send(b),
  });
  const renew = (auth: string, body: object) => api(auth).post(`/branches/${BRANCH.seocho}/contract/renewals`, body);
  const correct = (auth: string, body: object) => api(auth).patch(`/branches/${BRANCH.seocho}/contract`, body);
  const seocho = () => db(app).branch.findUniqueOrThrow({ where: { id: BRANCH.seocho } });
  const history = () =>
    db(app).auditLog.findMany({ where: { entity: 'Branch', entityId: BRANCH.seocho }, orderBy: { createdAt: 'asc' } });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    superAdmin = await login(app, ACCOUNTS.superAdmin);
    seochoAdmin = await login(app, ACCOUNTS.seochoAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  describe('권한 — 본사만', () => {
    it('지점 관리자는 자기 지점 계약도 갱신·정정하지 못하고 이력도 못 본다(403), 본사는 된다', async () => {
      expect((await renew(seochoAdmin, { contractEndAt: '2099-12-31' })).status).toBe(403);
      expect((await correct(seochoAdmin, { contractPartner: '바뀐 상대방' })).status).toBe(403);
      expect((await api(seochoAdmin).get(`/audit-logs?entity=Branch&entityId=${BRANCH.seocho}`)).status).toBe(403);
      expect(await history()).toHaveLength(0);

      expect((await renew(superAdmin, { contractEndAt: '2099-12-31' })).status).toBe(201);
      expect((await correct(superAdmin, { contractPartner: '바뀐 상대방' })).status).toBe(200);
    });
  });

  describe('갱신', () => {
    it('새 종료일·상대방을 넣고 상태를 정상으로 돌리며, 바뀐 값을 이력에 남긴다', async () => {
      await setBranchStatus(BRANCH.seocho, 'RENEWAL_DUE');
      const before = await seocho();
      const res = await renew(superAdmin, { contractEndAt: '2030-02-28', contractPartner: '서초 OO아파트 관리주체' });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        contractEndAt: '2030-02-28',
        contractStatus: 'ACTIVE',
        contractPartner: '서초 OO아파트 관리주체',
      });

      const [log] = await history();
      expect(log).toMatchObject({
        action: 'CONTRACT_RENEWED',
        before: {
          contractEndAt: toKstDateString(before.contractEndAt!),
          contractStatus: 'RENEWAL_DUE',
          contractPartner: before.contractPartner,
        },
        after: { contractEndAt: '2030-02-28', contractStatus: 'ACTIVE', contractPartner: '서초 OO아파트 관리주체' },
      });

      // 본사 변경 이력 화면에서 지점 이름으로 보인다
      const listed = await api(superAdmin).get(`/audit-logs?entity=Branch&entityId=${BRANCH.seocho}`);
      expect(listed.body.data[0]).toMatchObject({ action: 'CONTRACT_RENEWED', entityName: before.name });
    });

    it('새 종료일이 지금 종료일보다 뒤가 아니면 400, 아무것도 바뀌지 않는다', async () => {
      const before = await seocho();
      const sameDay = toKstDateString(before.contractEndAt!);
      const res = await renew(superAdmin, { contractEndAt: sameDay });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CONTRACT_PERIOD');
      expect(await seocho()).toEqual(before);
      expect(await history()).toHaveLength(0);
    });

    it('계약 종료 지점은 갱신하지 못한다(409) — 상태를 먼저 되돌려야 한다', async () => {
      await setBranchStatus(BRANCH.seocho, 'TERMINATED');
      const res = await renew(superAdmin, { contractEndAt: '2099-12-31' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
      expect((await seocho()).contractStatus).toBe('TERMINATED');
      expect(await history()).toHaveLength(0);
    });

    it('날짜 형식이 YYYY-MM-DD가 아니면 400', async () => {
      expect((await renew(superAdmin, { contractEndAt: '2099-12-31T00:00:00Z' })).status).toBe(400);
      expect((await renew(superAdmin, { contractEndAt: '2099-02-30' })).status).toBe(400);
    });
  });

  describe('정정', () => {
    it('바뀐 필드만 이력에 남기고 상태는 그대로 둔다', async () => {
      await setBranchStatus(BRANCH.seocho, 'EXPIRED');
      const before = await seocho();
      const res = await correct(superAdmin, {
        contractStartAt: '2024-03-04',
        contractPartner: before.contractPartner, // 같은 값은 바뀐 것으로 치지 않는다
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ contractStartAt: '2024-03-04', contractStatus: 'EXPIRED' });

      const logs = await history();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: 'CONTRACT_CORRECTED',
        before: { contractStartAt: toKstDateString(before.contractStartAt) },
        after: { contractStartAt: '2024-03-04' },
      });
    });

    it('바뀐 것이 없으면 이력을 남기지 않는다', async () => {
      const before = await seocho();
      const res = await correct(superAdmin, { contractPartner: before.contractPartner });
      expect(res.status).toBe(200);
      expect(await history()).toHaveLength(0);
    });

    it('종료일이 시작일보다 앞서면 400, 아무것도 바뀌지 않는다', async () => {
      const before = await seocho();
      const res = await correct(superAdmin, { contractEndAt: '2024-02-01' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CONTRACT_PERIOD');
      expect(await seocho()).toEqual(before);
    });
  });

  describe('계약 상태 변경도 이력에 남는다', () => {
    it('바뀔 때만 남는다', async () => {
      expect((await api(superAdmin).patch(`/branches/${BRANCH.seocho}/contract-status`, { status: 'EXPIRED' })).status).toBe(200);
      expect((await api(superAdmin).patch(`/branches/${BRANCH.seocho}/contract-status`, { status: 'EXPIRED' })).status).toBe(200);
      const logs = await history();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: 'CONTRACT_STATUS_CHANGED',
        before: { contractStatus: 'ACTIVE' },
        after: { contractStatus: 'EXPIRED' },
      });
    });
  });

  it('이력 쓰기가 실패하면 계약 변경도 롤백된다(같은 트랜잭션)', async () => {
    const before = await seocho();
    // 없는 계정 id → AuditLog.actorId 외래키 위반으로 이력 쓰기만 실패하게 만든다
    await expect(
      app.get(BranchService).renewContract(BRANCH.seocho, { contractEndAt: '2099-12-31' }, 'account-does-not-exist'),
    ).rejects.toThrow();
    expect(await seocho()).toEqual(before);
    expect(await history()).toHaveLength(0);
  });

  describe('종료 임박 표시(조회 때 계산)', () => {
    const plusDays = (n: number) => {
      const d = new Date(`${todayKst()}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const listed = async () =>
      (await api(superAdmin).get('/branches')).body.data.find((b: { id: string }) => b.id === BRANCH.seocho);

    it('정상 상태에서 종료 60일 안이면 알림, 남은 일수를 함께 준다', async () => {
      await correct(superAdmin, { contractEndAt: plusDays(60) });
      expect(await listed()).toMatchObject({ contractDaysLeft: 60, renewalNotice: true });
      await correct(superAdmin, { contractEndAt: plusDays(61) });
      expect(await listed()).toMatchObject({ contractDaysLeft: 61, renewalNotice: false });
    });

    it('이미 갱신 임박으로 바꾼 지점과 종료일이 지난 지점은 알림하지 않는다(상태도 자동으로 바꾸지 않는다)', async () => {
      await correct(superAdmin, { contractEndAt: plusDays(10) });
      await setBranchStatus(BRANCH.seocho, 'RENEWAL_DUE');
      expect(await listed()).toMatchObject({ renewalNotice: false, contractStatus: 'RENEWAL_DUE' });

      await setBranchStatus(BRANCH.seocho, 'ACTIVE');
      await correct(superAdmin, { contractEndAt: plusDays(-1) });
      expect(await listed()).toMatchObject({ contractDaysLeft: -1, renewalNotice: false, contractStatus: 'ACTIVE' });
    });
  });
});
