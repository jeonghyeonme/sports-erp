import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BranchContractStatus } from '../src/mock-data/mock-data.types';
import { ACCOUNTS, BRANCH, createApp, login, mockData } from './helpers/app';

/**
 * 위탁계약 종료(TERMINATED) 지점의 신규 활동 차단 — 설계 1-1 §2-1 "TERMINATED 전이가 하위 도메인에 미치는 영향".
 * - 차단 대상은 TERMINATED뿐이다. EXPIRED(만료)·RENEWAL_DUE(갱신임박)는 차단하지 않는다.
 * - 과거 데이터(회원·게시글·예약 이력) 조회는 유지한다(소프트 삭제 원칙).
 * MockDataService가 인메모리 상태를 가지므로 테스트마다 새 앱을 띄운다.
 */
describe('위탁계약 종료 지점의 신규 활동 차단', () => {
  let app: INestApplication;
  let admin: string; // 서초점 관리자
  let member: string; // 서초점 회원 수진
  let slotId: string;

  const setSeochoStatus = (status: BranchContractStatus) => {
    mockData(app).branches.find((b) => b.id === BRANCH.seocho)!.contractStatus = status;
  };
  const api = (auth: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth),
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
  });

  beforeEach(async () => {
    app = await createApp();
    admin = await login(app, ACCOUNTS.seochoAdmin);
    member = await login(app, ACCOUNTS.seochoMember);
    const m = mockData(app);
    const programIds = m.programs.filter((p) => p.branchId === BRANCH.seocho && p.status === 'RUNNING').map((p) => p.id);
    const slot = m.scheduleSlots.find((s) => programIds.includes(s.programId));
    if (!slot) throw new Error('테스트 전제 위반: 서초점 진행중 프로그램의 회차가 없다');
    slotId = slot.id;
  });
  afterEach(async () => {
    await app.close();
  });

  describe('TERMINATED: 신규 활동은 409 BRANCH_TERMINATED', () => {
    beforeEach(() => setSeochoStatus('TERMINATED'));

    it('신규 회원 등록', async () => {
      const res = await api(admin).post('/members', { name: '신규회원' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
    });
    it('예약 생성', async () => {
      const res = await api(member).post('/reservations', { scheduleSlotId: slotId });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
    });
    it('게시글 신규 작성', async () => {
      const res = await api(admin).post('/posts', { title: 't', content: 'c', category: 'NOTICE' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
    });
    it('차단된 요청은 데이터를 남기지 않는다', async () => {
      const m = mockData(app);
      const counts = () => [m.members.length, m.reservations.length, m.posts.length];
      const before = counts();
      await api(admin).post('/members', { name: '신규회원' });
      await api(member).post('/reservations', { scheduleSlotId: slotId });
      await api(admin).post('/posts', { title: 't', content: 'c', category: 'NOTICE' });
      expect(counts()).toEqual(before);
    });
  });

  describe('TERMINATED: 과거 데이터 조회는 유지된다', () => {
    beforeEach(() => setSeochoStatus('TERMINATED'));

    it('회원 목록·상세', async () => {
      const list = await api(admin).get('/members');
      expect(list.status).toBe(200);
      expect(list.body.data.length).toBeGreaterThan(0);
      expect((await api(admin).get(`/members/${list.body.data[0].id}`)).status).toBe(200);
    });
    it('게시글 열람', async () => {
      const res = await api(admin).get('/posts');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
    it('기존 예약 이력 조회', async () => {
      setSeochoStatus('ACTIVE'); // 예약은 활성 상태에서 만들고
      expect((await api(member).post('/reservations', { scheduleSlotId: slotId })).status).toBe(201);
      setSeochoStatus('TERMINATED'); // 종료된 뒤에도 이력은 보인다
      const res = await api(member).get('/reservations');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe.each<BranchContractStatus>(['ACTIVE', 'RENEWAL_DUE', 'EXPIRED'])('%s: 차단하지 않는다', (status) => {
    beforeEach(() => setSeochoStatus(status));

    it('신규 회원 등록', async () => {
      expect((await api(admin).post('/members', { name: '신규회원' })).status).toBe(201);
    });
    it('예약 생성', async () => {
      expect((await api(member).post('/reservations', { scheduleSlotId: slotId })).status).toBe(201);
    });
    it('게시글 신규 작성', async () => {
      expect((await api(admin).post('/posts', { title: 't', content: 'c', category: 'NOTICE' })).status).toBe(201);
    });
  });

  // 설계 1-1 §2-1: "TERMINATED 지점에 현재 파견 중(StaffAssignment.endDate=null)인 직원이 있으면
  // 그 파견을 종료 처리하고 본사가 재배치할 대상 목록에 올려야 함". 코드에는 아직 없다(계약 상태를 바꾸는 API도 없음).
  it.todo('TERMINATED 전이 시 파견 중인 직원의 파견을 종료하고 재배치 대상 목록에 올린다 (설계 1-1 §2-1, 미구현)');
});
