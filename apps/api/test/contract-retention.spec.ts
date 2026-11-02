import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { addYearsToDateString, todayKst } from '../src/common/date/kst-date';
import { StorageService } from '../src/modules/storage/storage.service';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { setBranchStatus } from './helpers/branch-status';
import { uploadContractFile } from './helpers/contract-files';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D71 — 계약 파일 보존. 보존 끝 = 회차가 끝난 날(해지 확정일 또는 종료일) + 3년.
 * - 실물 이관 완료는 본사가 파일 하나씩, 언제든(보존 끝 전에도) 표시한다. 표시해도 보존 끝까지는 열람된다.
 * - 보존 끝 6개월 전부터 미이관 파일을 처리 대기함·지점 상세에 알리고, 이관할 때까지 계속 알린다.
 * - 시스템 파일은 "이관 완료 + 보존 끝 지남"일 때만 본사가 정리(저장소 삭제)한다. 이관 전에는 지우지 않는다.
 * 날짜는 시드 1회차의 종료일을 오늘 기준으로 옮겨 만든다(보존 끝이 오늘에서 며칠 떨어지게).
 */
describe('계약 파일 보존·실물 이관·정리 (D71)', () => {
  let app: INestApplication;
  let superAdmin: string;
  let seochoAdmin: string;

  const api = (auth: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth),
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
  });

  /** 오늘 + n일(YYYY-MM-DD, KST). */
  const plusDays = (n: number, from = todayKst()) => {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  /** 보존 끝(종료일 + 3년)이 retentionUntil이 되도록 서초 1회차 종료일을 옮긴다. */
  const setRetentionUntil = async (retentionUntil: string) => {
    const endAt = addYearsToDateString(retentionUntil, -3);
    await db(app).contractRound.update({
      where: { branchId_roundNo: { branchId: BRANCH.seocho, roundNo: 1 } },
      data: { startAt: new Date('2015-01-01T00:00:00Z'), endAt: new Date(`${endAt}T00:00:00Z`) },
    });
  };
  /** 서초 1회차에 계약서를 올리고 파일 id를 돌려준다. */
  const uploadSeochoContract = async () => {
    const file = await uploadContractFile(app, superAdmin, { fileName: '서초 계약서.pdf' });
    const res = await api(superAdmin).post(`/branches/${BRANCH.seocho}/contract/files`, { kind: 'CONTRACT', roundNo: 1, ...file });
    expect(res.status).toBe(201);
    const row = await db(app).contractFile.findFirstOrThrow({ where: { fileName: '서초 계약서.pdf' } });
    return row.id;
  };
  const archive = (auth: string, fileId: string, branchId: string = BRANCH.seocho) =>
    api(auth).post(`/branches/${branchId}/contract/files/${fileId}/archive`);
  const download = (auth: string, fileId: string) => api(auth).get(`/branches/${BRANCH.seocho}/contract/files/${fileId}/download`);
  const overview = async () => (await api(superAdmin).get('/branches/contract-files/retention')).body.data as {
    archiveNeeded: Array<{ id: string }>;
    purgeCandidates: Array<{ id: string }>;
  };
  const inboxCount = async (key: string) =>
    ((await api(superAdmin).get('/inbox')).body.data as Array<{ key: string; count: number }>).find((i) => i.key === key)?.count;
  const history = async () =>
    (await db(app).auditLog.findMany({ where: { entity: 'Branch', entityId: BRANCH.seocho }, orderBy: { createdAt: 'asc' } })).map(
      (l) => l.action,
    );

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    superAdmin = await login(app, ACCOUNTS.superAdmin);
    seochoAdmin = await login(app, ACCOUNTS.seochoAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  it('이관·보존 현황·정리는 본사만 — 지점 관리자는 403(자기 지점 열람은 된다), 본사는 된다', async () => {
    const fileId = await uploadSeochoContract();
    expect((await archive(seochoAdmin, fileId)).status).toBe(403);
    expect((await api(seochoAdmin).get('/branches/contract-files/retention')).status).toBe(403);
    expect((await api(seochoAdmin).post('/branches/contract-files/purge', { fileIds: [fileId] })).status).toBe(403);
    expect((await download(seochoAdmin, fileId)).status).toBe(200); // 대조군 — 열람은 자기 지점 관리자도 된다
    expect((await archive(superAdmin, fileId)).status).toBe(201);
    expect((await api(superAdmin).get('/branches/contract-files/retention')).status).toBe(200);
  });

  it('보존 끝 전에도 이관 표시가 되고, 표시한 뒤에도 열람된다. 두 번 표시하면 409, 이력이 남는다', async () => {
    const fileId = await uploadSeochoContract(); // 시드 1회차 보존 끝은 몇 년 뒤
    expect((await archive(superAdmin, fileId)).status).toBe(201);
    const row = await db(app).contractFile.findUniqueOrThrow({ where: { id: fileId } });
    expect(row).toMatchObject({ archivedBy: 'account-haneul', purgedAt: null });
    expect((await download(superAdmin, fileId)).status).toBe(200);

    const again = await archive(superAdmin, fileId);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('CONTRACT_FILE_ALREADY_ARCHIVED');
    expect(await history()).toEqual(['CONTRACT_FILE_UPLOADED', 'CONTRACT_FILE_ARCHIVED', 'CONTRACT_FILE_VIEWED']);
  });

  it('다른 지점 경로로 파일을 이관하려 하면 404이고 표시되지 않는다', async () => {
    const fileId = await uploadSeochoContract();
    expect((await archive(superAdmin, fileId, BRANCH.gangnam)).status).toBe(404);
    expect((await db(app).contractFile.findUniqueOrThrow({ where: { id: fileId } })).archivedAt).toBeNull();
  });

  it('보존 끝이 지나도 이관 전이면 정리되지 않는다(409) — 알림은 계속 뜨고 열람도 된다', async () => {
    const fileId = await uploadSeochoContract();
    await setRetentionUntil(plusDays(-10));
    const { archiveNeeded, purgeCandidates } = await overview();
    expect(archiveNeeded.map((r) => r.id)).toContain(fileId);
    expect(purgeCandidates.map((r) => r.id)).not.toContain(fileId);
    expect(await inboxCount('contractArchive')).toBe(1);

    const res = await api(superAdmin).post('/branches/contract-files/purge', { fileIds: [fileId] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONTRACT_FILE_NOT_PURGEABLE');
    expect((await db(app).contractFile.findUniqueOrThrow({ where: { id: fileId } })).purgedAt).toBeNull();
    expect((await download(superAdmin, fileId)).status).toBe(200);
  });

  it('이관했어도 보존 끝 전이면 정리되지 않는다(409)', async () => {
    const fileId = await uploadSeochoContract();
    await setRetentionUntil(plusDays(10));
    await archive(superAdmin, fileId);
    expect((await overview()).purgeCandidates).toHaveLength(0);
    expect((await api(superAdmin).post('/branches/contract-files/purge', { fileIds: [fileId] })).status).toBe(409);
  });

  it('이관 완료 + 보존 끝 지남이면 정리 대상이고, 정리하면 저장소에서 지워지고(열면 410) 기록은 남는다', async () => {
    const fileId = await uploadSeochoContract();
    await setRetentionUntil(plusDays(-1));
    await archive(superAdmin, fileId);
    expect((await overview()).purgeCandidates.map((r) => r.id)).toEqual([fileId]);
    expect(await inboxCount('contractPurge')).toBe(1);
    expect(await inboxCount('contractArchive')).toBe(0); // 이관했으니 이관 알림에서는 빠진다

    const res = await api(superAdmin).post('/branches/contract-files/purge', { fileIds: [fileId] });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ purged: 1 });
    const row = await db(app).contractFile.findUniqueOrThrow({ where: { id: fileId } });
    expect(row).toMatchObject({ purgedBy: 'account-haneul' });
    expect(row.purgedAt).not.toBeNull();
    expect(await app.get(StorageService).info(row.path)).toBeNull(); // 저장소 객체가 실제로 지워졌다

    const opened = await download(superAdmin, fileId);
    expect(opened.status).toBe(410);
    expect(opened.body.error.code).toBe('CONTRACT_FILE_PURGED');
    const rounds = (await api(superAdmin).get(`/branches/${BRANCH.seocho}/contract/rounds`)).body.data;
    expect(rounds[0].files[0]).toMatchObject({ id: fileId, fileName: '서초 계약서.pdf' });
    expect(rounds[0].files[0].purgedAt).toBeDefined();
    expect(await history()).toContain('CONTRACT_FILE_PURGED');
    expect(await inboxCount('contractPurge')).toBe(0);
    expect((await api(superAdmin).post('/branches/contract-files/purge', { fileIds: [fileId] })).status).toBe(409);
  });

  it('계약 종료 지점에도 이관 표시는 된다(끝난 계약을 위한 기능 — 올리기 차단과 다르다)', async () => {
    const fileId = await uploadSeochoContract();
    await setBranchStatus(BRANCH.seocho, 'TERMINATED');
    expect((await archive(superAdmin, fileId)).status).toBe(201);
  });

  it('알림은 보존 끝 6개월 전부터 — 6개월 하루 밖이면 뜨지 않는다', async () => {
    const fileId = await uploadSeochoContract();
    const sixMonths = (() => {
      const [y, m, d] = todayKst().split('-').map(Number);
      const t = new Date(Date.UTC(y, m - 1 + 6, 1));
      const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
      t.setUTCDate(Math.min(d, last));
      return t.toISOString().slice(0, 10);
    })();
    await setRetentionUntil(plusDays(1, sixMonths));
    expect(await inboxCount('contractArchive')).toBe(0);
    expect((await overview()).archiveNeeded).toHaveLength(0);
    // 윤년 2/29가 끼면 +3년·-3년 왕복이 하루 어긋날 수 있어 실제 보존 끝을 확인한다
    const until = async () =>
      (await api(superAdmin).get(`/branches/${BRANCH.seocho}/contract/rounds`)).body.data[0].files[0].retentionUntil as string;
    expect(await until()).toBe(plusDays(1, sixMonths));

    await setRetentionUntil(sixMonths);
    expect(await until()).toBe(sixMonths);
    expect(await inboxCount('contractArchive')).toBe(1);
    expect((await overview()).archiveNeeded.map((r) => r.id)).toEqual([fileId]);
  });
});
