import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D62 — 게시글 본문 서식(HTML)은 저장 전에 허용 목록으로 정화한다. 회원 웹 토큰이 localStorage라(D41)
 * 스크립트·이벤트 속성·위험 링크가 하나라도 남으면 안 된다. 태그 없이 온 글은 문단 HTML로 바꿔 저장한다.
 */
describe('게시글 본문 정화 (D62)', () => {
  let app: INestApplication;
  let admin: string;
  const create = (content: string) =>
    request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', admin)
      .send({ title: '서식 공지', content, category: 'NOTICE' });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    admin = await login(app, ACCOUNTS.seochoAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  it('허용한 서식은 남긴다(대조군)', async () => {
    const html = '<h2>제목</h2><p><strong>굵게</strong> <em>기울임</em></p><ul><li>하나</li></ul><blockquote><p>인용</p></blockquote><hr>';
    const res = await create(html);
    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe(html.replace('<hr>', '<hr />')); // 빈 태그는 자기 닫힘으로 직렬화된다
  });

  it('스크립트·이벤트 속성·style·img·iframe을 지운다', async () => {
    const res = await create(
      '<p onclick="steal()" style="color:red">안녕<script>alert(1)</script><img src=x onerror="alert(1)"><iframe src="https://evil.example"></iframe></p>',
    );
    expect(res.status).toBe(201);
    const saved = (await db(app).post.findUniqueOrThrow({ where: { id: res.body.data.id } })).content;
    expect(saved).toBe('<p>안녕</p>');
    expect(saved).not.toMatch(/script|onerror|onclick|style|img|iframe/i);
  });

  it('링크는 http(s)·mailto만, 새 창에 rel noopener — javascript: 링크는 주소가 지워진다', async () => {
    const res = await create('<p><a href="javascript:alert(1)">나쁜</a> <a href="https://spoism.example/a">좋은</a></p>');
    const saved = res.body.data.content as string;
    expect(saved).not.toMatch(/javascript:/i);
    expect(saved).toContain('<a href="https://spoism.example/a" target="_blank" rel="noopener noreferrer nofollow">좋은</a>');
  });

  it('태그 없이 온 글은 줄마다 문단으로 — 꺾쇠는 글자로 남는다', async () => {
    const res = await create('첫 줄 a < b\n둘째 줄');
    expect(res.body.data.content).toBe('<p>첫 줄 a &lt; b</p><p>둘째 줄</p>');
  });

  it('인라인 태그로 시작하면 문단으로 감싼다 — 화면이 HTML로 알아보게', async () => {
    const res = await create('<strong>굵게</strong> 시작');
    expect(res.body.data.content).toBe('<p><strong>굵게</strong> 시작</p>');
  });

  it('정화 뒤 글자가 없으면 400 — 수정도 같다', async () => {
    const empty = await create('<p><script>x</script></p>');
    expect([empty.status, empty.body.error.code]).toEqual([400, 'POST_CONTENT_EMPTY']);
    const ok = await create('<p>본문</p>');
    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/posts/${ok.body.data.id}`)
      .set('Authorization', admin)
      .send({ content: '<p><img src=x onerror=alert(1)></p>' });
    expect([patched.status, patched.body.error.code]).toEqual([400, 'POST_CONTENT_EMPTY']);
  });
});
