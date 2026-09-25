import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, createApp, login } from './helpers/app';

/**
 * ADR-BRD-01 — 회원은 본인 지점 BRANCH_TO_MEMBER 게시글 + visibleToMember=true인 HQ 공지만 볼 수 있다.
 * 직원 전용 HQ 공지(예: 교육자료)가 회원에게 노출되던 정보 노출 결함(docs/domains/게시판.md §6 D1)의 회귀 테스트.
 * ADR-BRD-02 — GET /posts 목록 조회 페이지네이션(기본 limit=20, meta.total/page/pageSize).
 * MockDataService가 인메모리 상태를 가지므로 테스트마다 새 앱을 띄운다.
 */
describe('회원 대상 게시글 가시성(visibleToMember)', () => {
  let app: INestApplication;
  let superAdmin: string;
  let seochoAdmin: string;
  let seochoStaff: string;
  let seochoMember: string;

  const api = (auth: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth),
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
  });

  beforeEach(async () => {
    app = await createApp();
    superAdmin = await login(app, ACCOUNTS.superAdmin);
    seochoAdmin = await login(app, ACCOUNTS.seochoAdmin);
    seochoStaff = await login(app, ACCOUNTS.seochoStaff);
    seochoMember = await login(app, ACCOUNTS.seochoMember);
  });
  afterEach(async () => {
    await app.close();
  });

  it('시드된 직원 전용 HQ 공지(visibleToMember=false)는 회원 목록에 나타나지 않는다', async () => {
    const res = await api(seochoMember).get('/posts');
    expect(res.status).toBe(200);
    const titles = res.body.data.map((p: { title: string }) => p.title);
    expect(titles).not.toContain('ERP 시스템 사용 매뉴얼 안내');
  });

  it('대조군: 같은 공지가 본사 관리자·지점 관리자·직원 목록에는 나타난다', async () => {
    for (const auth of [superAdmin, seochoAdmin, seochoStaff]) {
      const res = await api(auth).get('/posts');
      const titles = res.body.data.map((p: { title: string }) => p.title);
      expect(titles).toContain('ERP 시스템 사용 매뉴얼 안내');
    }
  });

  it('회원이 비공개 HQ 공지의 상세를 직접 조회하면 404', async () => {
    const list = await api(seochoAdmin).get('/posts');
    const hidden = list.body.data.find((p: { title: string }) => p.title === 'ERP 시스템 사용 매뉴얼 안내');
    const res = await api(seochoMember).get(`/posts/${hidden.id}`);
    expect(res.status).toBe(404);
  });

  it('회원은 본인 지점 BRANCH_TO_MEMBER 공지는 그대로 볼 수 있다', async () => {
    const res = await api(seochoMember).get('/posts');
    expect(res.status).toBe(200);
    const titles = res.body.data.map((p: { title: string }) => p.title);
    expect(titles).toContain('9월 아침 요가 이벤트 안내');
  });

  it('SUPER_ADMIN이 visibleToMember=true로 작성한 HQ 공지는 회원에게 노출된다', async () => {
    const created = await api(superAdmin).post('/posts', {
      title: '정책 변경 안내',
      content: '전 지점 공통 정책이 변경되었습니다.',
      category: 'NOTICE',
      visibleToMember: true,
    });
    expect(created.status).toBe(201);

    const list = await api(seochoMember).get('/posts');
    const titles = list.body.data.map((p: { title: string }) => p.title);
    expect(titles).toContain('정책 변경 안내');

    const detail = await api(seochoMember).get(`/posts/${created.body.data.id}`);
    expect(detail.status).toBe(200);
  });

  it('visibleToMember를 지정하지 않으면 기본값 false로 회원에게 노출되지 않는다', async () => {
    const created = await api(superAdmin).post('/posts', {
      title: '팀장급 워크숍 자료',
      content: '내부 워크숍 자료입니다.',
      category: 'TRAINING_MATERIAL',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.visibleToMember).toBe(false);

    const list = await api(seochoMember).get('/posts');
    const titles = list.body.data.map((p: { title: string }) => p.title);
    expect(titles).not.toContain('팀장급 워크숍 자료');
  });

  describe('ADR-BRD-02: 목록 조회 페이지네이션', () => {
    async function createPosts(count: number) {
      for (let i = 0; i < count; i++) {
        await api(superAdmin).post('/posts', { title: `대량 공지 ${i}`, content: 'x', category: 'NOTICE' });
      }
    }

    it('기본 limit=20으로 잘려서 응답하고 meta에 total/page/pageSize가 붙는다', async () => {
      await createPosts(25);
      const res = await api(superAdmin).get('/posts');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(20);
      // 시드 2건 + 신규 25건 = 27건
      expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 27 });
    });

    it('page=2를 주면 나머지가 내려온다', async () => {
      await createPosts(25);
      const res = await api(superAdmin).get('/posts?page=2');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(7);
      expect(res.body.meta).toEqual({ page: 2, pageSize: 20, total: 27 });
    });

    it('limit을 지정하면 그 크기로 잘린다', async () => {
      await createPosts(5);
      const res = await api(superAdmin).get('/posts?limit=3');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
      expect(res.body.meta).toEqual({ page: 1, pageSize: 3, total: 7 });
    });

    it('scope 필터와 함께 써도 total은 필터링 이후 기준이다', async () => {
      await createPosts(25); // 전부 scope=HQ_TO_BRANCH(SUPER_ADMIN 작성)
      const res = await api(superAdmin).get('/posts?scope=BRANCH_TO_MEMBER');
      expect(res.status).toBe(200);
      // 시드된 BRANCH_TO_MEMBER 공지 1건뿐 — 대량 생성분은 전부 HQ_TO_BRANCH라 안 섞인다.
      expect(res.body.meta.total).toBe(1);
    });

    it('잘못된/음수 page·limit은 1·20으로 안전하게 대체된다', async () => {
      const res = await api(superAdmin).get('/posts?page=-5&limit=abc');
      expect(res.status).toBe(200);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.pageSize).toBe(20);
    });
  });
});
