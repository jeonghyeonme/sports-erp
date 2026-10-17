import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { setBranchStatus } from './helpers/branch-status';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * RFP 중간 작업 M9(D51) — 업무지원 요청(개념도 현장→본사, D56).
 * 요청은 지점 관리자, 처리는 본사. 상태: 요청 → 처리중 → 완료, 또는 반려(답변 필수). 완료·반려는 종결.
 * 지점 격리 공격 케이스는 branch-isolation 표에도 있다.
 */
describe('업무지원 요청(D56)', () => {
  let app: INestApplication;
  const tok: Record<string, string> = {};
  const body = { category: 'FACILITY', title: '샤워실 온수 고장', content: '어제 저녁부터 남자 샤워실 온수가 안 나옵니다.' };

  const call = (auth: string, method: 'get' | 'post' | 'patch', path: string, payload?: object) => {
    const r = request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', auth);
    return payload ? r.send(payload) : r;
  };
  const create = () => call(tok.seochoAdmin, 'post', '/support-requests', body);
  const setStatus = (id: string, status: string, response?: string) =>
    call(tok.superAdmin, 'patch', `/support-requests/${id}/status`, { status, response });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    for (const [k, email] of Object.entries(ACCOUNTS)) tok[k] = await login(app, email);
  });
  afterEach(async () => {
    await app.close();
  });

  it('지점 관리자가 올리면 본사가 처리중 → 완료로 바꾼다(처리자·처리 시각 기록)', async () => {
    const created = await create();
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ branchId: BRANCH.seocho, requesterId: 'account-minsu', status: 'REQUESTED' });
    const id = created.body.data.id;

    expect((await setStatus(id, 'IN_PROGRESS')).body.data).toMatchObject({ status: 'IN_PROGRESS', handlerId: 'account-haneul' });
    const done = await setStatus(id, 'DONE', '시설팀이 10/18 방문 수리 완료');
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ status: 'DONE', response: '시설팀이 10/18 방문 수리 완료' });
    expect(done.body.data.resolvedAt).toBeTruthy();

    // 지점 관리자는 자기 지점 목록·상세에서 결과를 본다
    const list = await call(tok.seochoAdmin, 'get', '/support-requests');
    expect(list.body.data.map((r: { id: string }) => r.id)).toEqual([id]);
    expect(list.body.meta.total).toBe(1);
  });

  it('반려는 답변이 필수이고, 종결된 요청은 다시 바꿀 수 없다', async () => {
    const id = (await create()).body.data.id;
    const noReason = await setStatus(id, 'REJECTED');
    expect(noReason.status).toBe(400);
    expect(noReason.body.error.code).toBe('RESPONSE_REQUIRED');

    expect((await setStatus(id, 'REJECTED', '관리사무소 소관입니다')).status).toBe(200);
    const again = await setStatus(id, 'IN_PROGRESS');
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('두 본사 관리자가 동시에 처리해도 한 번만 반영된다', async () => {
    const id = (await create()).body.data.id;
    const results = await Promise.all([setStatus(id, 'DONE', '완료'), setStatus(id, 'REJECTED', '반려')]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it('DB도 반려 답변·처리 시각 규칙을 막는다(CHECK, D56)', async () => {
    const id = (await create()).body.data.id;
    await expect(db(app).supportRequest.update({ where: { id }, data: { status: 'REJECTED' } })).rejects.toThrow();
    await expect(db(app).supportRequest.update({ where: { id }, data: { status: 'DONE' } })).rejects.toThrow();
  });

  it('권한: 요청은 지점 관리자만, 처리는 본사만(대조군 포함)', async () => {
    expect((await call(tok.seochoStaff, 'post', '/support-requests', body)).status).toBe(403);
    expect((await call(tok.superAdmin, 'post', '/support-requests', body)).status).toBe(403);
    const id = (await create()).body.data.id;
    expect((await call(tok.seochoAdmin, 'patch', `/support-requests/${id}/status`, { status: 'DONE' })).status).toBe(403);
    expect((await call(tok.seochoStaff, 'get', '/support-requests')).status).toBe(403);
    // 본사는 전 지점을 본다
    expect((await call(tok.superAdmin, 'get', '/support-requests?status=REQUESTED')).body.data).toHaveLength(1);
  });

  it('계약 종료 지점은 새 요청 409, 이미 있던 요청 조회는 된다', async () => {
    const id = (await create()).body.data.id;
    await setBranchStatus(BRANCH.seocho, 'TERMINATED');
    const res = await create();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BRANCH_TERMINATED');
    expect((await call(tok.seochoAdmin, 'get', `/support-requests/${id}`)).status).toBe(200);
  });

  it('입력 검증 — 모르는 분류·짧은 제목은 400', async () => {
    expect((await call(tok.seochoAdmin, 'post', '/support-requests', { ...body, category: 'PARKING' })).status).toBe(400);
    expect((await call(tok.seochoAdmin, 'post', '/support-requests', { ...body, title: 'x' })).status).toBe(400);
  });
});
