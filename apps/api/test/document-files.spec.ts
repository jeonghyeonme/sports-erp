import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PermissionService } from '../src/common/permissions/permission.service';
import { uploadContractFile } from './helpers/contract-files';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D69 2차(log/206, 자원문서관리 ADR-RES-05) — 문서 실제 파일 업로드. 게시판 첨부·계약 파일과 같은 저장소 방식(D57):
 * 업로드 URL → 브라우저가 올림 → 등록 때 저장소에서 다시 확인. 열 때마다 열람 기록. 옛 주소 문서는 그대로 열린다.
 * 로컬·테스트는 메모리 저장소라 업로드·다운로드 URL이 api의 /dev-storage로 향한다.
 */
describe('문서 파일 업로드 (D69 2차)', () => {
  let app: INestApplication;
  let minsu: string;
  const api = (auth: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth),
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
  });
  const upload = async (auth: string, fileName = '근로계약서.pdf', type = 'application/pdf', bytes = 2048) => {
    const url = await api(auth).post('/documents/upload-url', { fileName, fileType: type, fileSize: bytes });
    expect(url.status).toBe(201);
    await request(app.getHttpServer()).put(`/api/v1/${url.body.data.uploadUrl}`).set('Content-Type', type).send(Buffer.alloc(bytes, 7));
    return { path: url.body.data.path as string, fileName };
  };

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    minsu = await login(app, ACCOUNTS.seochoAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  it('올린 파일로 문서를 등록하고, 열면 60초 URL과 열람 기록이 남는다', async () => {
    const file = await upload(minsu);
    const res = await api(minsu).post('/documents', { category: 'MANUAL', title: '안전 매뉴얼', file });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ stored: true, fileName: '근로계약서.pdf', fileType: 'application/pdf', fileSize: 2048 });
    expect(res.body.data.fileUrl).toBeUndefined();
    expect(JSON.stringify(res.body.data)).not.toContain(file.path); // 저장소 경로는 응답에 없다
    const row = await db(app).document.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect([row.storagePath, row.fileUrl]).toEqual([file.path, null]);

    const opened = await api(minsu).get(`/documents/${row.id}/open`);
    expect(opened.status).toBe(200);
    expect(opened.body.data).toMatchObject({ expiresInSec: 60, external: false });
    const bytes = await request(app.getHttpServer()).get(`/api/v1/${opened.body.data.url}`);
    expect(bytes.status).toBe(200);
    const logs = await db(app).auditLog.findMany({ where: { entity: 'Document', entityId: row.id, action: 'DOCUMENT_FILE_VIEWED' } });
    expect(logs).toHaveLength(1);
    expect(logs[0].actorId).toBe('account-minsu');
  });

  it('옛 주소 문서는 그 주소를 그대로 열고(외부 링크), 열람 기록도 남긴다 — 가짜 주소(demo://)는 409', async () => {
    const made = await api(minsu).post('/documents', { category: 'MANUAL', title: '옛 링크 문서', fileUrl: 'https://files.example/manual.pdf' });
    expect(made.status).toBe(201);
    const legacy = await db(app).document.findUniqueOrThrow({ where: { id: made.body.data.id } });
    const opened = await api(minsu).get(`/documents/${legacy.id}/open`);
    expect(opened.status).toBe(200);
    expect(opened.body.data).toEqual({ url: legacy.fileUrl, expiresInSec: null, external: true });
    expect(await db(app).auditLog.count({ where: { entityId: legacy.id, action: 'DOCUMENT_FILE_VIEWED' } })).toBe(1);

    const fake = await db(app).document.create({
      data: { category: 'MANUAL', branchId: BRANCH.seocho, title: '시연 가짜 주소', fileUrl: 'demo://x.pdf', uploadedBy: 'account-minsu' },
    });
    const refused = await api(minsu).get(`/documents/${fake.id}/open`);
    expect([refused.status, refused.body.error.code]).toEqual([409, 'DOCUMENT_FILE_UNAVAILABLE']);
    expect(await db(app).auditLog.count({ where: { entityId: fake.id } })).toBe(0);
  });

  it('파일과 주소는 정확히 하나 — 둘 다 없거나 둘 다 있으면 400, DB도 CHECK로 막는다', async () => {
    const none = await api(minsu).post('/documents', { category: 'MANUAL', title: '빈 문서' });
    expect([none.status, none.body.error.code]).toEqual([400, 'DOCUMENT_FILE_REQUIRED']);
    const file = await upload(minsu);
    const both = await api(minsu).post('/documents', { category: 'MANUAL', title: '둘 다', file, fileUrl: 'https://x.example/a.pdf' });
    expect([both.status, both.body.error.code]).toEqual([400, 'DOCUMENT_FILE_REQUIRED']);
    await expect(
      db(app).document.create({ data: { category: 'MANUAL', title: 'DB 우회', uploadedBy: 'account-minsu' } }),
    ).rejects.toThrow(/Document_file_source_ck/);
  });

  it('올리지 않은 경로는 409, 같은 파일을 두 번 붙이면 409, 계약 파일 경로는 400', async () => {
    const ghost = { path: 'documents/00000000-0000-4000-8000-000000000000.pdf', fileName: 'x.pdf' };
    const notUploaded = await api(minsu).post('/documents', { category: 'MANUAL', title: '유령', file: ghost });
    expect([notUploaded.status, notUploaded.body.error.code]).toEqual([409, 'ATTACHMENT_NOT_UPLOADED']);

    const file = await upload(minsu);
    expect((await api(minsu).post('/documents', { category: 'MANUAL', title: '처음', file })).status).toBe(201);
    const dup = await api(minsu).post('/documents', { category: 'MANUAL', title: '두 번째', file });
    expect([dup.status, dup.body.error.code]).toEqual([409, 'ATTACHMENT_DUPLICATE']);

    const hq = await login(app, ACCOUNTS.superAdmin);
    const contract = await uploadContractFile(app, hq);
    const wrong = await api(minsu).post('/documents', { category: 'MANUAL', title: '계약 파일 경로', file: contract });
    expect(wrong.status).toBe(400);
  });

  it('형식·크기는 게시판 첨부와 같다(D57), 직원은 업로드 URL을 받지 못하고, 문서 입력 권한을 끄면 403', async () => {
    const exe = await api(minsu).post('/documents/upload-url', { fileName: 'a.exe', fileType: 'application/octet-stream', fileSize: 10 });
    expect([exe.status, exe.body.error.code]).toEqual([400, 'ATTACHMENT_TYPE_NOT_ALLOWED']);
    const big = await api(minsu).post('/documents/upload-url', { fileName: 'a.pdf', fileType: 'application/pdf', fileSize: 11 * 1024 * 1024 });
    expect(big.status).toBe(400);
    const staff = await login(app, ACCOUNTS.seochoStaff);
    expect((await api(staff).post('/documents/upload-url', { fileName: 'a.pdf', fileType: 'application/pdf', fileSize: 10 })).status).toBe(403);

    await db(app).rolePermission.create({ data: { role: 'BRANCH_ADMIN', feature: 'document', action: 'CREATE', allowed: false } });
    app.get(PermissionService).invalidate();
    const denied = await api(minsu).post('/documents/upload-url', { fileName: 'a.pdf', fileType: 'application/pdf', fileSize: 10 });
    expect([denied.status, denied.body.error.code]).toEqual([403, 'PERMISSION_DENIED']);
  });

  it('목록은 서버 쪽 나누기 — total은 DB 개수, 검색어·정렬은 서버가', async () => {
    const file = await upload(minsu);
    await api(minsu).post('/documents', { category: 'MANUAL', title: '수영장 점검표', file });
    const total = await db(app).document.count({ where: { deletedAt: null, OR: [{ branchId: null }, { branchId: BRANCH.seocho }] } });
    const page1 = await api(minsu).get('/documents?limit=1');
    expect([page1.body.meta.total, page1.body.data.length]).toEqual([total, 1]);
    expect(page1.body.data[0].title).toBe('수영장 점검표'); // 기본은 최근 등록부터
    const found = await api(minsu).get(`/documents?q=${encodeURIComponent('수영장 점검')}`);
    expect(found.body.data.map((d: { title: string }) => d.title)).toEqual(['수영장 점검표']);
    const byTitle = await api(minsu).get('/documents?sort=title&dir=asc&limit=100');
    const titles = (byTitle.body.data as { title: string }[]).map((d) => d.title);
    const expected = (
      await db(app).document.findMany({
        where: { deletedAt: null, OR: [{ branchId: null }, { branchId: BRANCH.seocho }] },
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
        select: { title: true },
      })
    ).map((d) => d.title);
    expect(titles).toEqual(expected);
  });
});
