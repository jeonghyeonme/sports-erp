import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * RFP 중간 작업 M10(D51) — 게시판 첨부(게시판 ADR-BRD-04, 저장소 D57).
 * 테스트는 메모리 드라이버(Supabase 값이 없는 로컬)로 돈다 — 업로드 URL은 api의 /dev-storage로 향한다.
 * 흐름: 업로드 URL 요청 → 그 URL로 PUT → 붙이기(저장소에서 크기·형식 재확인) → 상세에 목록 → 다운로드 URL.
 */
const PDF = 'application/pdf';

describe('게시판 첨부(ADR-BRD-04, D57)', () => {
  let app: INestApplication;
  const tok: Record<string, string> = {};
  let hqPostId: string;

  const http = () => request(app.getHttpServer());
  const call = (auth: string, method: 'get' | 'post' | 'delete', path: string, body?: object) => {
    const r = http()[method](`/api/v1${path}`).set('Authorization', auth);
    return body ? r.send(body) : r;
  };
  // 업로드 URL 받기 → 올리기 → 붙이기
  async function attach(auth: string, postId: string, fileName: string, type: string, bytes: number) {
    const url = await call(auth, 'post', `/posts/${postId}/attachments/upload-url`, { fileName, fileType: type, fileSize: bytes });
    if (url.status !== 201) return url;
    await http().put(`/api/v1/${url.body.data.uploadUrl}`).set('Content-Type', type).send(Buffer.alloc(bytes, 1));
    return call(auth, 'post', `/posts/${postId}/attachments`, { path: url.body.data.path, fileName });
  }

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    for (const [k, email] of Object.entries(ACCOUNTS)) tok[k] = await login(app, email);
    const post = await call(tok.superAdmin, 'post', '/posts', { title: '안전교육 자료', content: '첨부 확인', category: 'TRAINING_MATERIAL' });
    hqPostId = post.body.data.id;
  });
  afterEach(async () => {
    await app.close();
  });

  it('본사가 올린 교육자료를 지점 관리자가 상세에서 보고 내려받는다', async () => {
    const attached = await attach(tok.superAdmin, hqPostId, '소방안전.pdf', PDF, 2048);
    expect(attached.status).toBe(201);
    expect(attached.body.data).toMatchObject({ fileName: '소방안전.pdf', fileType: PDF, fileSize: 2048 });

    const detail = await call(tok.seochoAdmin, 'get', `/posts/${hqPostId}`);
    expect(detail.body.data.attachments).toEqual([expect.objectContaining({ fileName: '소방안전.pdf', fileSize: 2048 })]);

    const dl = await call(tok.seochoAdmin, 'get', `/posts/${hqPostId}/attachments/${attached.body.data.id}/download`);
    expect(dl.status).toBe(200);
    const file = await http().get(`/api/v1/${dl.body.data.url}`);
    expect(file.status).toBe(200);
    expect(file.headers['content-disposition']).toContain(encodeURIComponent('소방안전.pdf'));
    expect(Buffer.from(file.body).length).toBe(2048);
  });

  it('회원에게 안 보이는 본사 공지의 첨부는 회원이 받을 수 없다(404)', async () => {
    const attached = await attach(tok.superAdmin, hqPostId, 'a.pdf', PDF, 10);
    const res = await call(tok.seochoMember, 'get', `/posts/${hqPostId}/attachments/${attached.body.data.id}/download`);
    expect(res.status).toBe(404);
  });

  it('작성자만 붙이고, 작성자·본사만 지운다', async () => {
    const res = await call(tok.seochoAdmin, 'post', `/posts/${hqPostId}/attachments/upload-url`, { fileName: 'a.pdf', fileType: PDF, fileSize: 10 });
    expect(res.status).toBe(403);
    const branchPost = await call(tok.seochoAdmin, 'post', '/posts', { title: '지점 공지', content: '내용', category: 'NOTICE' });
    const a = await attach(tok.seochoAdmin, branchPost.body.data.id, 'map.png', 'image/png', 100);
    expect(a.status).toBe(201);
    expect((await call(tok.seochoStaff, 'delete', `/posts/${branchPost.body.data.id}/attachments/${a.body.data.id}`)).status).toBe(403);
    expect((await call(tok.superAdmin, 'delete', `/posts/${branchPost.body.data.id}/attachments/${a.body.data.id}`)).status).toBe(200);
    expect(await db(app).attachment.count({ where: { postId: branchPost.body.data.id } })).toBe(0);
  });

  it('다른 지점 글에는 접근할 수 없다(존재를 드러내지 않는 404)', async () => {
    const branchPost = await call(tok.seochoAdmin, 'post', '/posts', { title: '서초 공지', content: '내용', category: 'NOTICE' });
    const a = await attach(tok.seochoAdmin, branchPost.body.data.id, 'x.pdf', PDF, 10);
    const res = await call(tok.gangnamAdmin, 'get', `/posts/${branchPost.body.data.id}/attachments/${a.body.data.id}/download`);
    expect(res.status).toBe(404);
    expect(BRANCH.gangnam).not.toBe(BRANCH.seocho);
  });

  it.each([
    ['허용 안 된 형식', 'run.exe', 'application/octet-stream', 10, 400, 'ATTACHMENT_TYPE_NOT_ALLOWED'],
    ['확장자와 형식 불일치', 'a.pdf', 'image/png', 10, 400, 'ATTACHMENT_TYPE_NOT_ALLOWED'],
    ['10MB 초과', 'big.pdf', PDF, 10 * 1024 * 1024 + 1, 400, 'VALIDATION_ERROR'],
  ])('업로드 URL 거부 — %s', async (_n, fileName, type, size, status, code) => {
    const res = await call(tok.superAdmin, 'post', `/posts/${hqPostId}/attachments/upload-url`, { fileName, fileType: type, fileSize: size });
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  it('신고한 형식과 다르게 올린 파일은 붙이기에서 거부된다(저장소에서 다시 확인)', async () => {
    const url = await call(tok.superAdmin, 'post', `/posts/${hqPostId}/attachments/upload-url`, { fileName: 'a.pdf', fileType: PDF, fileSize: 10 });
    await http().put(`/api/v1/${url.body.data.uploadUrl}`).set('Content-Type', 'text/html').send(Buffer.from('<script>'));
    const res = await call(tok.superAdmin, 'post', `/posts/${hqPostId}/attachments`, { path: url.body.data.path, fileName: 'a.pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ATTACHMENT_TYPE_NOT_ALLOWED');
  });

  it('올리지 않은 경로·다른 글의 경로는 붙일 수 없다', async () => {
    const url = await call(tok.superAdmin, 'post', `/posts/${hqPostId}/attachments/upload-url`, { fileName: 'a.pdf', fileType: PDF, fileSize: 10 });
    const notUploaded = await call(tok.superAdmin, 'post', `/posts/${hqPostId}/attachments`, { path: url.body.data.path, fileName: 'a.pdf' });
    expect(notUploaded.status).toBe(409);
    const other = await call(tok.superAdmin, 'post', '/posts', { title: '다른 글', content: '내용', category: 'NOTICE' });
    const mismatch = await call(tok.superAdmin, 'post', `/posts/${other.body.data.id}/attachments`, { path: url.body.data.path, fileName: 'a.pdf' });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.code).toBe('ATTACHMENT_PATH_MISMATCH');
  });

  it('글 하나에 5개까지 — 동시에 붙여도 넘지 않는다', async () => {
    const uploads = [];
    for (let i = 0; i < 6; i++) {
      const url = await call(tok.superAdmin, 'post', `/posts/${hqPostId}/attachments/upload-url`, { fileName: `f${i}.pdf`, fileType: PDF, fileSize: 10 });
      await http().put(`/api/v1/${url.body.data.uploadUrl}`).set('Content-Type', PDF).send(Buffer.alloc(10));
      uploads.push({ path: url.body.data.path, fileName: `f${i}.pdf` });
    }
    const results = await Promise.all(uploads.map((u) => call(tok.superAdmin, 'post', `/posts/${hqPostId}/attachments`, u)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(5);
    expect(results.filter((r) => r.status === 409)).toHaveLength(1);
    const sixth = await call(tok.superAdmin, 'post', `/posts/${hqPostId}/attachments/upload-url`, { fileName: 'g.pdf', fileType: PDF, fileSize: 10 });
    expect(sixth.status).toBe(409);
    expect(sixth.body.error.code).toBe('ATTACHMENT_LIMIT');
  });
});
