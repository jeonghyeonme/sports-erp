import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * RFP 중간 작업 M4(D51) — 인사 변경 신청 → 지점 관리자 1단계 승인(D11, 인사정보관리 ADR-STF-09).
 * 신청은 STAFF 본인, 항목은 이름·연락처, 같은 항목 대기 1건, 승인은 같은 트랜잭션에서 반영 + 변경 이력.
 * 쓰기가 많아 테스트마다 워커 DB를 다시 만든다.
 */
const STAFF = 'staff-seoyeon';

describe('인사 변경 신청·승인(ADR-STF-09)', () => {
  let app: INestApplication;
  const tok: Record<string, string> = {};

  const call = (auth: string, method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: object) => {
    const r = request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', auth);
    return body ? r.send(body) : r;
  };
  const submit = (field: string, newValue: string) => call(tok.seochoStaff, 'post', '/staff-change-requests', { field, newValue });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    tok.seochoStaff = await login(app, ACCOUNTS.seochoStaff);
    tok.seochoAdmin = await login(app, ACCOUNTS.seochoAdmin);
    tok.gangnamAdmin = await login(app, ACCOUNTS.gangnamAdmin);
    tok.superAdmin = await login(app, ACCOUNTS.superAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  it('신청 → 지점 관리자 승인: 직원 값이 바뀌고 이력은 항목만 남긴다(연락처 값은 남기지 않음)', async () => {
    const before = await db(app).staff.findUniqueOrThrow({ where: { id: STAFF } });
    const created = await submit('phone', '010-7777-1234');
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ staffId: STAFF, field: 'phone', oldValue: before.phone, newValue: '010-7777-1234', status: 'PENDING' });

    // 신청함 — 지점 관리자는 자기 지점 것만, 연락처는 마스킹
    const inbox = await call(tok.seochoAdmin, 'get', '/staff-change-requests?status=PENDING');
    expect(inbox.status).toBe(200);
    expect(inbox.body.data).toHaveLength(1);
    expect(inbox.body.data[0]).toMatchObject({ staffName: '박서연', newValue: '010-****-1234' });
    expect((await call(tok.gangnamAdmin, 'get', '/staff-change-requests?status=PENDING')).body.data).toEqual([]);

    const id = created.body.data.id;
    const approved = await call(tok.seochoAdmin, 'patch', `/staff-change-requests/${id}/approve`);
    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({ status: 'APPROVED', reviewedBy: 'account-minsu' });
    expect((await db(app).staff.findUniqueOrThrow({ where: { id: STAFF } })).phone).toBe('010-7777-1234');

    const logs = await db(app).auditLog.findMany({ where: { action: 'STAFF_PROFILE_CHANGED', entityId: STAFF } });
    expect(logs).toHaveLength(1);
    expect(logs[0].before).toEqual({ field: 'phone' });
    expect(JSON.stringify(logs[0])).not.toContain('7777');

    // 이미 처리된 신청은 다시 승인·반려할 수 없다
    expect((await call(tok.seochoAdmin, 'patch', `/staff-change-requests/${id}/reject`)).status).toBe(409);
  });

  it('이름 승인은 이전·새 이름을 이력에 남긴다', async () => {
    const created = await submit('name', '박서윤');
    await call(tok.seochoAdmin, 'patch', `/staff-change-requests/${created.body.data.id}/approve`);
    const log = await db(app).auditLog.findFirstOrThrow({ where: { action: 'STAFF_PROFILE_CHANGED', entityId: STAFF } });
    expect(log.before).toEqual({ field: 'name', name: '박서연' });
    expect(log.after).toMatchObject({ field: 'name', name: '박서윤' });
  });

  it('반려는 값을 바꾸지 않고 이력도 남기지 않는다', async () => {
    const created = await submit('name', '박서윤');
    const rejected = await call(tok.seochoAdmin, 'patch', `/staff-change-requests/${created.body.data.id}/reject`);
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('REJECTED');
    expect((await db(app).staff.findUniqueOrThrow({ where: { id: STAFF } })).name).toBe('박서연');
    expect(await db(app).auditLog.count({ where: { action: 'STAFF_PROFILE_CHANGED' } })).toBe(0);
  });

  it('같은 항목에 대기 신청이 있으면 409, 다른 항목은 된다. 취소하면 다시 신청할 수 있다', async () => {
    const first = await submit('phone', '010-1111-2222');
    const dup = await submit('phone', '010-3333-4444');
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CHANGE_REQUEST_PENDING');
    expect((await submit('name', '박서윤')).status).toBe(201);

    expect((await call(tok.seochoStaff, 'delete', `/staff-change-requests/${first.body.data.id}`)).status).toBe(200);
    expect((await submit('phone', '010-3333-4444')).status).toBe(201);
    const mine = await call(tok.seochoStaff, 'get', '/staff-change-requests/mine');
    expect(mine.body.data.map((r: { field: string }) => r.field).sort()).toEqual(['name', 'phone']);
  });

  it('동시에 같은 항목을 두 번 신청해도 대기는 1건', async () => {
    const results = await Promise.all([submit('phone', '010-5555-0001'), submit('phone', '010-5555-0002')]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await db(app).staffProfileChangeRequest.count({ where: { staffId: STAFF, status: 'PENDING' } })).toBe(1);
  });

  it.each([
    ['지금 값과 같음', 'name', '박서연', 'CHANGE_REQUEST_NO_CHANGE'],
    ['연락처 형식', 'phone', '12345', 'VALIDATION_ERROR'],
    ['신청할 수 없는 항목', 'position', '팀장', 'VALIDATION_ERROR'],
  ])('400 — %s', async (_n, field, value, code) => {
    const res = await submit(field, value);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(code);
  });

  it('권한: 신청·취소는 STAFF 본인, 승인은 지점 관리자(대조군 포함)', async () => {
    const created = await submit('name', '박서윤');
    const id = created.body.data.id;
    // 지점 관리자는 신청하지 않고 직접 고친다
    expect((await call(tok.seochoAdmin, 'post', '/staff-change-requests', { field: 'name', newValue: '김민수2' })).status).toBe(403);
    // 직원은 승인할 수 없다
    expect((await call(tok.seochoStaff, 'patch', `/staff-change-requests/${id}/approve`)).status).toBe(403);
    // 본사는 조회만(승인 불가)
    expect((await call(tok.superAdmin, 'patch', `/staff-change-requests/${id}/approve`)).status).toBe(403);
    expect((await call(tok.superAdmin, 'get', '/staff-change-requests?status=PENDING')).body.data).toHaveLength(1);
    // 관리자는 직원 신청을 취소할 수 없다
    expect((await call(tok.seochoAdmin, 'delete', `/staff-change-requests/${id}`)).status).toBe(403);
    // 다른 지점 관리자는 승인 403, 자기 지점 관리자는 된다
    expect((await call(tok.gangnamAdmin, 'patch', `/staff-change-requests/${id}/approve`)).status).toBe(403);
    expect((await call(tok.seochoAdmin, 'patch', `/staff-change-requests/${id}/approve`)).status).toBe(200);
  });
});
