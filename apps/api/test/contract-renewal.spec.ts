import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { todayKst, toKstDateString } from '../src/common/date/kst-date';
import { BranchService } from '../src/modules/branches/branch.service';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { setBranchStatus } from './helpers/branch-status';
import { attachTerminationAgreement, uploadContractFile } from './helpers/contract-files';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D68·D69 — 위탁계약 회차와 계약서. 지점의 계약 정보 = 가장 최근 회차. 본사만 쓰고(지점 관리자는 자기 지점 열람만),
 * 갱신은 새 계약서가 있어야 새 회차로 생기며, 정정·파일 교체는 진행 중인 회차만. 종료 확정은 해지 합의서가 있어야 한다.
 * 계약 쓰기는 변경과 같은 트랜잭션에서 변경 이력(entity 'Branch')에 남고, 계약서를 열 때마다 열람 기록이 남는다.
 */
describe('위탁계약 회차·계약서 (D68·D69)', () => {
  let app: INestApplication;
  let superAdmin: string;
  let seochoAdmin: string;

  const api = (auth: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth),
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
    patch: (p: string, b?: object) => request(app.getHttpServer()).patch(`/api/v1${p}`).set('Authorization', auth).send(b),
  });
  const renewal = async (period: { contractStartAt: string; contractEndAt: string; contractPartner?: string }) => ({
    contractPartner: '서초 OO아파트 관리주체',
    ...period,
    contractFile: await uploadContractFile(app, superAdmin, { fileName: '2회차 계약서.pdf' }),
  });
  const renew = (auth: string, body: object) => api(auth).post(`/branches/${BRANCH.seocho}/contract/renewals`, body);
  const correct = (auth: string, body: object) => api(auth).patch(`/branches/${BRANCH.seocho}/contract`, body);
  const setFile = (auth: string, body: object) => api(auth).post(`/branches/${BRANCH.seocho}/contract/files`, body);
  const rounds = () => db(app).contractRound.findMany({ where: { branchId: BRANCH.seocho }, orderBy: { roundNo: 'asc' } });
  const round1 = async () => (await rounds())[0];
  const status = async () => (await db(app).branch.findUniqueOrThrow({ where: { id: BRANCH.seocho } })).contractStatus;
  const history = () =>
    db(app).auditLog.findMany({ where: { entity: 'Branch', entityId: BRANCH.seocho }, orderBy: { createdAt: 'asc' } });
  const listed = async () =>
    (await api(superAdmin).get('/branches')).body.data.find((b: { id: string }) => b.id === BRANCH.seocho);

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    superAdmin = await login(app, ACCOUNTS.superAdmin);
    seochoAdmin = await login(app, ACCOUNTS.seochoAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  describe('권한 — 쓰기는 본사만, 지점 관리자는 자기 지점 열람만', () => {
    it('지점 관리자는 갱신·정정·파일 올리기·업로드 URL이 403, 본사는 된다', async () => {
      const body = await renewal({ contractStartAt: '2027-03-01', contractEndAt: '2030-02-28' });
      expect((await renew(seochoAdmin, body)).status).toBe(403);
      expect((await correct(seochoAdmin, { contractPartner: '바뀐 상대방' })).status).toBe(403);
      expect((await setFile(seochoAdmin, { kind: 'CONTRACT', ...body.contractFile })).status).toBe(403);
      const url = await api(seochoAdmin).post('/branches/contract-files/upload-url', {
        fileName: 'a.pdf',
        fileType: 'application/pdf',
        fileSize: 10,
      });
      expect(url.status).toBe(403);
      expect(await rounds()).toHaveLength(1);
      expect(await history()).toHaveLength(0);

      expect((await renew(superAdmin, body)).status).toBe(201);
      expect((await correct(superAdmin, { contractPartner: '바뀐 상대방' })).status).toBe(200);
    });

    it('지점 관리자는 자기 지점 회차를 보고 계약서를 연다(열람 기록이 남는다), 본사도 열람이 기록된다', async () => {
      const file = await uploadContractFile(app, superAdmin);
      expect((await setFile(superAdmin, { kind: 'CONTRACT', ...file })).status).toBe(201);
      const list = await api(seochoAdmin).get(`/branches/${BRANCH.seocho}/contract/rounds`);
      expect(list.status).toBe(200);
      const fileId = list.body.data[0].files[0].id as string;

      const dl = await api(seochoAdmin).get(`/branches/${BRANCH.seocho}/contract/files/${fileId}/download`);
      expect(dl.status).toBe(200);
      expect(dl.body.data).toMatchObject({ expiresInSec: 60 });
      expect((await api(superAdmin).get(`/branches/${BRANCH.seocho}/contract/files/${fileId}/download`)).status).toBe(200);

      const views = (await history()).filter((l) => l.action === 'CONTRACT_FILE_VIEWED');
      expect(views.map((v) => v.actorId)).toEqual(['account-minsu', 'account-haneul']);
      expect(views[0].after).toMatchObject({ roundNo: 1, kind: 'CONTRACT', fileName: 'contract.pdf' });
    });

    it('없는 파일 id는 404이고 열람 기록이 남지 않는다', async () => {
      const res = await api(superAdmin).get(`/branches/${BRANCH.seocho}/contract/files/no-such-file/download`);
      expect(res.status).toBe(404);
      expect((await history()).filter((l) => l.action === 'CONTRACT_FILE_VIEWED')).toHaveLength(0);
    });
  });

  describe('갱신 = 새 회차', () => {
    it('새 계약서와 함께 2회차를 만들고 상태를 정상으로 돌리며, 1회차는 그대로 두고 이력을 남긴다', async () => {
      await setBranchStatus(BRANCH.seocho, 'RENEWAL_DUE');
      const before = await round1();
      const res = await renew(superAdmin, await renewal({ contractStartAt: '2027-03-01', contractEndAt: '2030-02-28' }));
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        contractRoundNo: 2,
        contractPartner: '서초 OO아파트 관리주체',
        contractStartAt: '2027-03-01',
        contractEndAt: '2030-02-28',
        contractStatus: 'ACTIVE',
        hasContractFile: true,
      });

      const [r1, r2] = await rounds();
      expect(r1).toEqual(before);
      expect(r2).toMatchObject({ roundNo: 2, createdBy: 'account-haneul' });
      const files = await db(app).contractFile.findMany({ where: { roundId: r2.id } });
      expect(files).toHaveLength(1);
      expect(files[0]).toMatchObject({ kind: 'CONTRACT', fileName: '2회차 계약서.pdf', replacedAt: null });

      const [log] = await history();
      expect(log).toMatchObject({
        action: 'CONTRACT_RENEWED',
        before: { roundNo: 1, contractEndAt: toKstDateString(before.endAt), contractStatus: 'RENEWAL_DUE' },
        after: { roundNo: 2, contractStartAt: '2027-03-01', contractEndAt: '2030-02-28', contractStatus: 'ACTIVE' },
      });
      const shown = await api(superAdmin).get(`/audit-logs?entity=Branch&entityId=${BRANCH.seocho}`);
      expect(shown.body.data[0]).toMatchObject({ action: 'CONTRACT_RENEWED' });
    });

    it('계약서가 없으면 400, 올리지 않은 경로면 409 — 회차가 생기지 않는다', async () => {
      const period = { contractPartner: 'x', contractStartAt: '2027-03-01', contractEndAt: '2030-02-28' };
      expect((await renew(superAdmin, period)).status).toBe(400);
      const ghost = await renew(superAdmin, {
        ...period,
        contractFile: { path: 'contracts/00000000-0000-0000-0000-000000000000.pdf', fileName: 'x.pdf' },
      });
      expect(ghost.status).toBe(409);
      expect(ghost.body.error.code).toBe('ATTACHMENT_NOT_UPLOADED');
      expect(await rounds()).toHaveLength(1);
      expect(await history()).toHaveLength(0);
    });

    it('새 시작일이 지난 회차 시작일보다 뒤가 아니거나 종료일이 시작일보다 앞서면 400', async () => {
      const r1Start = toKstDateString((await round1()).startAt);
      const sameStart = await renew(superAdmin, await renewal({ contractStartAt: r1Start, contractEndAt: '2030-02-28' }));
      expect(sameStart.status).toBe(400);
      expect(sameStart.body.error.code).toBe('INVALID_CONTRACT_PERIOD');
      const reversed = await renew(superAdmin, await renewal({ contractStartAt: '2027-03-01', contractEndAt: '2027-02-01' }));
      expect(reversed.status).toBe(400);
      expect(await rounds()).toHaveLength(1);
    });

    it('계약 종료 지점은 갱신하지 못한다(409) — 상태를 먼저 되돌려야 한다', async () => {
      await setBranchStatus(BRANCH.seocho, 'TERMINATED');
      const res = await renew(superAdmin, await renewal({ contractStartAt: '2027-03-01', contractEndAt: '2030-02-28' }));
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
      expect(await rounds()).toHaveLength(1);
      expect(await history()).toHaveLength(0);
    });

    it('날짜 형식이 YYYY-MM-DD가 아니면 400', async () => {
      expect((await renew(superAdmin, await renewal({ contractStartAt: '2027-03-01', contractEndAt: '2099-12-31T00:00:00Z' }))).status).toBe(400);
      expect((await renew(superAdmin, await renewal({ contractStartAt: '2027-03-01', contractEndAt: '2099-02-30' }))).status).toBe(400);
    });

    it('이력 쓰기가 실패하면 회차·파일·상태도 롤백된다(같은 트랜잭션)', async () => {
      const body = await renewal({ contractStartAt: '2027-03-01', contractEndAt: '2030-02-28' });
      // 없는 계정 id → 외래키 위반으로 쓰기가 실패하게 만든다
      await expect(app.get(BranchService).renewContract(BRANCH.seocho, body, 'account-does-not-exist')).rejects.toThrow();
      expect(await rounds()).toHaveLength(1);
      expect(await db(app).contractFile.count()).toBe(0);
      expect(await history()).toHaveLength(0);
    });
  });

  describe('정정 — 진행 중인 회차만', () => {
    it('바뀐 필드만 이력에 남기고 상태는 그대로 둔다', async () => {
      await setBranchStatus(BRANCH.seocho, 'EXPIRED');
      const before = await round1();
      const res = await correct(superAdmin, { contractStartAt: '2024-03-04', contractPartner: before.partner });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ contractStartAt: '2024-03-04', contractStatus: 'EXPIRED', contractRoundNo: 1 });
      const logs = await history();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: 'CONTRACT_CORRECTED',
        before: { roundNo: 1, contractStartAt: toKstDateString(before.startAt) },
        after: { roundNo: 1, contractStartAt: '2024-03-04' },
      });
    });

    it('갱신 뒤의 정정은 2회차만 고치고 지난 회차는 바뀌지 않는다', async () => {
      await renew(superAdmin, await renewal({ contractStartAt: '2027-03-01', contractEndAt: '2030-02-28' }));
      const before = await round1();
      expect((await correct(superAdmin, { contractEndAt: '2030-03-31' })).status).toBe(200);
      const [r1, r2] = await rounds();
      expect(r1).toEqual(before);
      expect(toKstDateString(r2.endAt)).toBe('2030-03-31');
      // 2회차 시작일을 1회차 시작일 이전으로 고칠 수는 없다
      const back = await correct(superAdmin, { contractStartAt: toKstDateString(r1.startAt) });
      expect(back.status).toBe(400);
      expect(back.body.error.code).toBe('INVALID_CONTRACT_PERIOD');
    });

    it('바뀐 것이 없으면 이력을 남기지 않고, 종료일이 시작일보다 앞서면 400', async () => {
      const before = await round1();
      expect((await correct(superAdmin, { contractPartner: before.partner })).status).toBe(200);
      expect(await history()).toHaveLength(0);
      const res = await correct(superAdmin, { contractEndAt: '2024-02-01' });
      expect(res.status).toBe(400);
      expect(await round1()).toEqual(before);
    });
  });

  describe('계약 파일 — 진행 중 회차에 올리기·교체, 지우는 경로 없음', () => {
    it('기존 지점(1회차)은 계약서 미등록으로 시작하고, 올리면 등록, 다시 올리면 교체(옛 파일은 교체 시각을 남긴다)', async () => {
      expect(await listed()).toMatchObject({ contractRoundNo: 1, hasContractFile: false });
      const first = await uploadContractFile(app, superAdmin, { fileName: '원본.pdf' });
      expect((await setFile(superAdmin, { kind: 'CONTRACT', ...first })).status).toBe(201);
      expect(await listed()).toMatchObject({ hasContractFile: true });

      const second = await uploadContractFile(app, superAdmin, { fileName: '재스캔.pdf' });
      expect((await setFile(superAdmin, { kind: 'CONTRACT', ...second })).status).toBe(201);
      const files = await db(app).contractFile.findMany({ orderBy: { uploadedAt: 'asc' } });
      expect(files.map((f) => [f.fileName, f.replacedAt === null])).toEqual([
        ['원본.pdf', false],
        ['재스캔.pdf', true],
      ]);
      expect((await history()).map((l) => l.action)).toEqual(['CONTRACT_FILE_UPLOADED', 'CONTRACT_FILE_REPLACED']);

      // 같은 경로를 두 번 붙이지 못한다
      const again = await setFile(superAdmin, { kind: 'CONTRACT', ...second });
      expect(again.status).toBe(409);
    });

    it('교체는 진행 중인 회차에만 붙는다 — 갱신 뒤에 올리면 1회차 파일은 그대로다', async () => {
      const original = await uploadContractFile(app, superAdmin, { fileName: '1회차.pdf' });
      await setFile(superAdmin, { kind: 'CONTRACT', ...original });
      await renew(superAdmin, await renewal({ contractStartAt: '2027-03-01', contractEndAt: '2030-02-28' }));
      const fix = await uploadContractFile(app, superAdmin, { fileName: '2회차 재스캔.pdf' });
      await setFile(superAdmin, { kind: 'CONTRACT', ...fix });
      const [r1, r2] = await rounds();
      const current = (roundId: string) => db(app).contractFile.findMany({ where: { roundId, replacedAt: null } });
      expect((await current(r1.id)).map((f) => f.fileName)).toEqual(['1회차.pdf']);
      expect((await current(r2.id)).map((f) => f.fileName)).toEqual(['2회차 재스캔.pdf']);
    });

    it('허용하지 않는 형식은 업로드 URL부터 400', async () => {
      const res = await api(superAdmin).post('/branches/contract-files/upload-url', {
        fileName: 'run.exe',
        fileType: 'application/octet-stream',
        fileSize: 10,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('종료 확정 — 해지 합의서가 있어야 한다(중도 해지 포함)', () => {
    const terminate = () => api(superAdmin).patch(`/branches/${BRANCH.seocho}/contract-status`, { status: 'TERMINATED' });

    it('해지 합의서가 없으면 409이고 아무것도 바뀌지 않는다(파견도 그대로)', async () => {
      const res = await terminate();
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TERMINATION_AGREEMENT_REQUIRED');
      expect(await status()).toBe('ACTIVE');
      expect(await db(app).staffAssignment.count({ where: { branchId: BRANCH.seocho, endDate: null } })).toBe(2);
      expect(await history()).toHaveLength(0);
    });

    it('종료일 전이라도 해지 합의서가 있으면 확정되고, 회차에 해지 확정일이 남는다. 확정 뒤에는 파일을 올리지 못한다', async () => {
      expect((await listed()).contractDaysLeft).toBeGreaterThan(0); // 기간이 남은 중도 해지
      await attachTerminationAgreement(app, superAdmin, BRANCH.seocho);
      expect(await listed()).toMatchObject({ hasTerminationAgreement: true });
      expect((await terminate()).status).toBe(200);
      expect(await status()).toBe('TERMINATED');
      expect(toKstDateString((await round1()).terminatedAt!)).toBe(todayKst());

      const late = await setFile(superAdmin, { kind: 'TERMINATION_AGREEMENT', ...(await uploadContractFile(app, superAdmin)) });
      expect(late.status).toBe(409);
      expect(late.body.error.code).toBe('BRANCH_TERMINATED');
    });

    it('종료에서 되돌리면 해지 확정일을 지운다', async () => {
      await attachTerminationAgreement(app, superAdmin, BRANCH.seocho);
      await terminate();
      expect((await api(superAdmin).patch(`/branches/${BRANCH.seocho}/contract-status`, { status: 'ACTIVE' })).status).toBe(200);
      expect((await round1()).terminatedAt).toBeNull();
    });
  });

  describe('종료 임박·기간 종료 표시(조회 때 계산)', () => {
    const plusDays = (n: number) => {
      const d = new Date(`${todayKst()}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };

    it('정상 상태에서 종료 60일 안이면 알림, 남은 일수를 함께 준다', async () => {
      await correct(superAdmin, { contractEndAt: plusDays(60) });
      expect(await listed()).toMatchObject({ contractDaysLeft: 60, renewalNotice: true });
      await correct(superAdmin, { contractEndAt: plusDays(61) });
      expect(await listed()).toMatchObject({ contractDaysLeft: 61, renewalNotice: false });
    });

    it('종료일이 지나도 상태는 자동으로 바뀌지 않는다(지난 일수만 음수로)', async () => {
      await correct(superAdmin, { contractEndAt: plusDays(-1) });
      expect(await listed()).toMatchObject({ contractDaysLeft: -1, renewalNotice: false, contractStatus: 'ACTIVE' });
    });
  });

  describe('신규 지점 등록 = 1회차', () => {
    const newBranch = async () => ({
      name: '판교점',
      code: 'PANGYO',
      region: '경기',
      address: '경기 성남시 분당구 판교역로 1',
      phone: '031-000-0000',
      standardCheckInTime: '08:30',
      contractPartner: '판교 OO오피스텔 관리단',
      contractStartAt: '2026-11-01',
      contractEndAt: '2028-10-31',
      contractFile: await uploadContractFile(app, superAdmin, { fileName: '판교 계약서.pdf' }),
    });
    const create = (auth: string, body: object) => api(auth).post('/branches', body);

    it('지점 관리자는 등록하지 못한다(403), 본사가 등록하면 1회차·계약서와 함께 목록·공개 목록·계약 이력에 보인다', async () => {
      const body = await newBranch();
      expect((await create(seochoAdmin, body)).status).toBe(403);
      expect(await db(app).branch.count({ where: { code: 'PANGYO' } })).toBe(0);

      const res = await create(superAdmin, body);
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        name: '판교점',
        contractStatus: 'ACTIVE',
        contractRoundNo: 1,
        contractStartAt: '2026-11-01',
        contractEndAt: '2028-10-31',
        hasContractFile: true,
        memberCount: 0,
      });
      const id = res.body.data.id as string;
      expect((await api(superAdmin).get('/branches')).body.data.map((b: { id: string }) => b.id)).toContain(id);
      const publicList = await request(app.getHttpServer()).get('/api/v1/branches/public');
      expect(publicList.body.data.map((b: { id: string }) => b.id)).toContain(id);
      const logs = await db(app).auditLog.findMany({ where: { entity: 'Branch', entityId: id } });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({ action: 'BRANCH_CREATED', after: { code: 'PANGYO', roundNo: 1, contractEndAt: '2028-10-31' } });
    });

    it('새 지점에 채용하면 지점 코드로 직원코드가 매겨진다(채번 시퀀스는 첫 채번 때 생긴다)', async () => {
      const id = (await create(superAdmin, await newBranch())).body.data.id as string;
      const hired = await api(superAdmin).post('/staff', { branchId: id, name: '판교 첫 직원', email: 'pangyo.first@spoism.example' });
      expect(hired.status).toBe(201);
      expect(hired.body.data).toMatchObject({ staffCode: 'PANGYO-001', branchId: id, branchName: '판교점' });
    });

    it('코드 중복 409, 형식·기간·종료일 누락·계약서 누락은 400 — 어느 쪽도 지점이 생기지 않는다', async () => {
      const before = await db(app).branch.count();
      const body = await newBranch();
      const taken = await create(superAdmin, { ...body, code: 'SEOCHO' });
      expect(taken.status).toBe(409);
      expect(taken.body.error.code).toBe('BRANCH_CODE_TAKEN');
      expect((await create(superAdmin, { ...body, code: 'pangyo' })).status).toBe(400);
      const reversed = await create(superAdmin, { ...body, contractEndAt: '2026-10-01' });
      expect(reversed.status).toBe(400);
      expect(reversed.body.error.code).toBe('INVALID_CONTRACT_PERIOD');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { contractEndAt, ...noEnd } = body;
      expect((await create(superAdmin, noEnd)).status).toBe(400);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { contractFile, ...noFile } = body;
      expect((await create(superAdmin, noFile)).status).toBe(400);
      expect(await db(app).branch.count()).toBe(before);
      expect(await db(app).contractRound.count({ where: { branch: { code: 'PANGYO' } } })).toBe(0);
    });
  });
});
