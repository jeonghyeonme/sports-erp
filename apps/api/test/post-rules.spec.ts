import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D36 — 게시판을 DB로 옮기며 단일 스레드 가정 없이 놓인 규칙과 쓰기 권한을 확인한다.
 * 가시성(ADR-BRD-01)·페이지네이션(ADR-BRD-02)은 posts-member-visibility.spec.ts, 계약 종료 차단은
 * contract-termination.spec.ts, 타 지점 격리는 branch-isolation.spec.ts가 본다.
 * - 조회수: 동시 조회에도 증가분을 잃지 않는다(원자적 증가, D36 결정 2)
 * - 소프트 삭제(게시판 A-6): 행은 남고 상세·목록에서 빠지며, 두 번째 삭제·삭제된 글 수정은 404
 * - 수정은 작성자 본인만, 삭제는 작성자 또는 본사(게시판 A-5)
 */
describe('게시판 규칙 (D36)', () => {
  let app: INestApplication;
  const call = (token: string, method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: object) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', token).send(body);

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('동시 상세 조회 20건 → 조회수가 정확히 20 올라간다(증가분 유실 없음)', async () => {
    const token = await login(app, ACCOUNTS.seochoMember);
    const before = (await db(app).post.findUniqueOrThrow({ where: { id: 'post-seocho-event' } })).viewCount;
    const results = await Promise.all(Array.from({ length: 20 }, () => call(token, 'get', '/posts/post-seocho-event')));
    expect(results.every((r) => r.status === 200)).toBe(true);
    const after = (await db(app).post.findUniqueOrThrow({ where: { id: 'post-seocho-event' } })).viewCount;
    expect(after - before).toBe(20);
  });

  it('응답에 작성자·지점 이름이 채워진다(DB 조인·묶음 조회)', async () => {
    const res = await call(await login(app, ACCOUNTS.seochoAdmin), 'get', '/posts');
    const event = res.body.data.find((p: { id: string }) => p.id === 'post-seocho-event');
    const manual = res.body.data.find((p: { id: string }) => p.id === 'post-hq-manual');
    expect(event).toMatchObject({ authorName: '김민수', branchName: '서초점', publishedAt: '2026-08-28' });
    expect(manual.authorName).toBe('정하늘');
    expect(manual.branchName).toBeUndefined(); // 전사 공지는 지점이 없다
    expect(res.body.data.map((p: { id: string }) => p.id)).toEqual(['post-hq-manual', 'post-seocho-event']); // 등록순
  });

  it('소프트 삭제: 작성자가 지우면 행은 남고 상세·목록에서 빠진다 — 두 번째 삭제와 삭제된 글 수정은 404', async () => {
    const author = await login(app, ACCOUNTS.seochoAdmin); // post-seocho-event 작성자
    expect((await call(author, 'delete', '/posts/post-seocho-event')).status).toBe(200);
    const row = await db(app).post.findUniqueOrThrow({ where: { id: 'post-seocho-event' } });
    expect(row.deletedAt).not.toBeNull();
    expect((await call(author, 'get', '/posts/post-seocho-event')).status).toBe(404);
    const list = await call(author, 'get', '/posts');
    expect(list.body.data.map((p: { id: string }) => p.id)).not.toContain('post-seocho-event');
    expect(list.body.meta.total).toBe(1);
    expect((await call(author, 'delete', '/posts/post-seocho-event')).status).toBe(404);
    expect((await call(author, 'patch', '/posts/post-seocho-event', { title: '되살리기' })).status).toBe(404);
  });

  it('수정은 작성자 본인만 — 본사도 남의 글은 수정 못 하고(403), 작성자는 된다(대조군)', async () => {
    const hq = await login(app, ACCOUNTS.superAdmin);
    const denied = await call(hq, 'patch', '/posts/post-seocho-event', { title: '본사가 고침' });
    expect(denied.status).toBe(403);
    expect((await db(app).post.findUniqueOrThrow({ where: { id: 'post-seocho-event' } })).title).toBe('9월 아침 요가 이벤트 안내');

    const ok = await call(await login(app, ACCOUNTS.seochoAdmin), 'patch', '/posts/post-seocho-event', { title: '10월 이벤트' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.title).toBe('10월 이벤트');
  });

  it('삭제는 작성자 또는 본사 — 같은 지점 직원은 403, 본사는 남의 글도 지울 수 있다', async () => {
    const staff = await login(app, ACCOUNTS.seochoStaff);
    expect((await call(staff, 'delete', '/posts/post-seocho-event')).status).toBe(403);
    expect((await db(app).post.findUniqueOrThrow({ where: { id: 'post-seocho-event' } })).deletedAt).toBeNull();
    expect((await call(await login(app, ACCOUNTS.superAdmin), 'delete', '/posts/post-seocho-event')).status).toBe(200);
  });

  it('작성 범위: 본사는 HQ 공지(없는 지점 지정 시 404), 지점장은 자기 지점 BRANCH_TO_MEMBER로 강제, 직원·회원은 403', async () => {
    const hq = await login(app, ACCOUNTS.superAdmin);
    const body = { title: '공지', content: '내용', category: 'NOTICE' };
    expect((await call(hq, 'post', '/posts', { ...body, branchId: 'branch-nowhere' })).body.error.code).toBe('BRANCH_NOT_FOUND');
    expect((await call(hq, 'post', '/posts', body)).body.data).toMatchObject({ scope: 'HQ_TO_BRANCH', visibleToMember: false });

    const admin = await call(await login(app, ACCOUNTS.seochoAdmin), 'post', '/posts', { ...body, branchId: BRANCH.gangnam, visibleToMember: false });
    expect(admin.body.data).toMatchObject({ scope: 'BRANCH_TO_MEMBER', branchId: BRANCH.seocho, visibleToMember: true });

    expect((await call(await login(app, ACCOUNTS.seochoStaff), 'post', '/posts', body)).status).toBe(403);
    expect((await call(await login(app, ACCOUNTS.seochoMember), 'post', '/posts', body)).status).toBe(403);
  });
});
