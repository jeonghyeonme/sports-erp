import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, createApp, login } from './helpers/app';

/**
 * ADR-BRD-01 — 회원은 본인 지점 BRANCH_TO_MEMBER 게시글 + visibleToMember=true인 HQ 공지만 볼 수 있다.
 * 직원 전용 HQ 공지(예: 교육자료)가 회원에게 노출되던 정보 노출 결함(docs/domains/게시판.md §6 D1)의 회귀 테스트.
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
});
