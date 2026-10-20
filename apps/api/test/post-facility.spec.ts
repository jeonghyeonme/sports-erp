import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * 게시판 ADR-BRD-05(RFP F4-3 "현장→이용자 각 시설에 대한 공지") — 지점 공지에 대상 시설을 붙인다.
 * - 지점 관리자는 자기 지점 시설만(다른 지점 시설은 BranchScopeGuard가 403, 없는 시설 404)
 * - 본사 공지(HQ_TO_BRANCH)에는 시설을 둘 수 없다(400)
 * - 목록은 facilityId로 거르고, 회원도 시설 이름을 본다
 * - 수정으로 시설을 바꾸거나(같은 지점만) null로 해제한다. DB 트리거가 최종 방어선이다(D28 방식)
 */
describe('시설별 공지 (ADR-BRD-05)', () => {
  let app: INestApplication;
  let seochoFacility: { id: string; name: string };
  let gangnamFacility: { id: string };

  const api = (auth: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth),
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
    patch: (p: string, b?: object) => request(app.getHttpServer()).patch(`/api/v1${p}`).set('Authorization', auth).send(b),
  });
  const notice = (extra: object = {}) => ({ title: '수영장 점검', content: '수영장 수질 점검 안내', category: 'NOTICE', ...extra });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    seochoFacility = await db(app).facility.findFirstOrThrow({ where: { branchId: BRANCH.seocho }, orderBy: { id: 'asc' } });
    gangnamFacility = await db(app).facility.findFirstOrThrow({ where: { branchId: BRANCH.gangnam }, orderBy: { id: 'asc' } });
  });
  afterEach(async () => {
    await app.close();
  });

  it('지점 관리자가 자기 지점 시설로 공지를 쓰면 목록 필터·회원 상세에 시설이 보인다', async () => {
    const admin = await login(app, ACCOUNTS.seochoAdmin);
    const created = await api(admin).post('/posts', notice({ facilityId: seochoFacility.id }));
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ facilityId: seochoFacility.id, facilityName: seochoFacility.name });
    // 대조군 — 시설 없는 지점 공지
    expect((await api(admin).post('/posts', notice({ title: '지점 전체 공지' }))).status).toBe(201);

    const member = await login(app, ACCOUNTS.seochoMember);
    const filtered = await api(member).get(`/posts?facilityId=${seochoFacility.id}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.map((p: { id: string }) => p.id)).toEqual([created.body.data.id]);
    const detail = await api(member).get(`/posts/${created.body.data.id}`);
    expect(detail.body.data.facilityName).toBe(seochoFacility.name);
  });

  it('다른 지점 시설은 403, 없는 시설은 404 — 글이 생기지 않는다', async () => {
    const admin = await login(app, ACCOUNTS.seochoAdmin);
    const before = await db(app).post.count();
    const foreign = await api(admin).post('/posts', notice({ facilityId: gangnamFacility.id }));
    expect([foreign.status, foreign.body.error.code]).toEqual([403, 'FACILITY_SCOPE_VIOLATION']);
    const missing = await api(admin).post('/posts', notice({ facilityId: 'no-such-facility' }));
    expect([missing.status, missing.body.error.code]).toEqual([404, 'FACILITY_NOT_FOUND']);
    expect(await db(app).post.count()).toBe(before);
  });

  it('본사 공지에는 시설을 둘 수 없다(400)', async () => {
    const hq = await login(app, ACCOUNTS.superAdmin);
    const res = await api(hq).post('/posts', notice({ branchId: BRANCH.seocho, facilityId: seochoFacility.id }));
    expect([res.status, res.body.error.code]).toEqual([400, 'POST_FACILITY_NOT_ALLOWED']);
  });

  it('수정으로 같은 지점 시설로 바꾸거나 null로 해제한다 — 다른 지점 시설은 400', async () => {
    const admin = await login(app, ACCOUNTS.seochoAdmin);
    const { body } = await api(admin).post('/posts', notice());
    const id = body.data.id as string;

    const set = await api(admin).patch(`/posts/${id}`, { facilityId: seochoFacility.id });
    expect([set.status, set.body.data.facilityId]).toEqual([200, seochoFacility.id]);
    const foreign = await api(admin).patch(`/posts/${id}`, { facilityId: gangnamFacility.id });
    expect([foreign.status, foreign.body.error.code]).toEqual([400, 'FACILITY_BRANCH_MISMATCH']);
    // 시설과 무관한 수정은 시설을 건드리지 않는다
    expect((await api(admin).patch(`/posts/${id}`, { title: '제목만' })).body.data.facilityId).toBe(seochoFacility.id);
    const cleared = await api(admin).patch(`/posts/${id}`, { facilityId: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.facilityId).toBeUndefined();
  });

  it('DB 트리거 — 앱을 거치지 않고 다른 지점 시설을 넣어도 거부된다', async () => {
    const admin = await login(app, ACCOUNTS.seochoAdmin);
    const { body } = await api(admin).post('/posts', notice());
    await expect(
      db(app).post.update({ where: { id: body.data.id }, data: { facilityId: gangnamFacility.id } }),
    ).rejects.toThrow(/BRANCH_MISMATCH/);
  });
});
