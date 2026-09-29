import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D33 — 근태를 DB로 옮기며 단일 스레드 가정 없이 동시 요청 아래 놓인 규칙들과, 도메인 문서(근태관리 §11)에
 * "검증되지 않음"으로 남아 있던 규칙들을 확인한다.
 * - 불변규칙 1: 하루 1건 체크인(동시 요청 포함)
 * - ADR-ATT-01: 연차는 승인 시점에만, 한 번만 차감(동시 승인 포함). 병가 등은 차감하지 않음(ATT-T02)
 * - ADR-ATT-02: 결근 확정 동시 호출에도 한 날짜 한 행
 * - 03문서 §6: 자동 지각 판정(ATT-T01), 연차 잔여의 "올해"는 KST(D33 결정 4)
 */
describe('근태 규칙 (D33)', () => {
  let app: INestApplication;
  const STAFF_ID = 'staff-seoyeon'; // 서초점, 입사 2022-07-11

  // Date만 가짜로 바꾼다(타이머·IO는 실제) — JWT 발급·검증도 같은 가짜 시각을 써서 일관된다.
  const fakeNow = (iso: string) =>
    jest.useFakeTimers({
      now: new Date(iso),
      doNotFake: [
        'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate',
        'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout',
      ],
    });

  const call = (token: string, method: 'get' | 'post' | 'patch', path: string, body?: object) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', token).send(body);

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
  });
  afterEach(async () => {
    jest.useRealTimers();
    await app.close();
  });

  it('동시 체크인 5건 → 1건만 201, 나머지는 ALREADY_CHECKED_IN 409, 기록은 1행', async () => {
    const token = await login(app, ACCOUNTS.seochoStaff);
    const results = await Promise.all(Array.from({ length: 5 }, () => call(token, 'post', '/attendance/check-in')));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const rejected = results.filter((r) => r.status !== 201);
    expect(rejected.every((r) => r.status === 409 && r.body.error.code === 'ALREADY_CHECKED_IN')).toBe(true);
    expect(await db(app).attendanceRecord.count({ where: { staffId: STAFF_ID } })).toBe(1);
  });

  it('체크아웃: 체크인 전 400 → 체크인 뒤 성공 → 두 번째는 409', async () => {
    const token = await login(app, ACCOUNTS.seochoStaff);
    expect((await call(token, 'post', '/attendance/check-out')).body.error.code).toBe('NOT_CHECKED_IN');
    await call(token, 'post', '/attendance/check-in');
    const out = await call(token, 'post', '/attendance/check-out');
    expect(out.status).toBe(201);
    expect(out.body.data.checkOutAt).toBeDefined();
    const again = await call(token, 'post', '/attendance/check-out');
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_CHECKED_OUT');
  });

  it('자동 지각 판정: 서초 기준 09:00 + 10분 — 09:15 KST는 LATE, 09:05 KST는 NORMAL', async () => {
    fakeNow('2026-06-10T00:15:00Z'); // 09:15 KST
    let token = await login(app, ACCOUNTS.seochoStaff);
    const late = await call(token, 'post', '/attendance/check-in');
    expect(late.body.data).toMatchObject({ date: '2026-06-10', status: 'LATE', branchId: BRANCH.seocho });

    fakeNow('2026-06-11T00:05:00Z'); // 다음 날 09:05 KST
    token = await login(app, ACCOUNTS.seochoStaff);
    const onTime = await call(token, 'post', '/attendance/check-in');
    expect(onTime.body.data).toMatchObject({ date: '2026-06-11', status: 'NORMAL' });
  });

  it('연차 잔여의 "올해"는 KST — UTC로는 12/31인 1/1 08:30 KST에 새해 잔여를 읽는다', async () => {
    fakeNow('2026-12-31T23:30:00Z'); // 2027-01-01 08:30 KST
    const token = await login(app, ACCOUNTS.seochoStaff);
    const res = await call(token, 'get', `/leave-balance/${STAFF_ID}`);
    expect(res.status).toBe(200);
    // 2022년 입사: 2027년 기준 근속 5년 → 15 + floor(4/2) = 17일 (2026년이었다면 16일)
    expect(res.body.data).toMatchObject({ year: 2027, totalDays: 17, usedDays: 0 });
  });

  it('연차 승인은 한 번만 차감된다 — 동시 승인 5건 중 1건만 성공, usedDays는 신청 일수만큼만 증가', async () => {
    const staffToken = await login(app, ACCOUNTS.seochoStaff);
    const adminToken = await login(app, ACCOUNTS.seochoAdmin);
    const before = (await call(staffToken, 'get', `/leave-balance/${STAFF_ID}`)).body.data.usedDays;
    const leave = await call(staffToken, 'post', '/leave-requests', {
      type: 'ANNUAL',
      startDate: '2026-11-02',
      endDate: '2026-11-04',
    });
    expect(leave.status).toBe(201);
    expect(leave.body.data.days).toBe(3);
    // 신청만으로는 차감하지 않는다(ADR-ATT-01)
    expect((await call(staffToken, 'get', `/leave-balance/${STAFF_ID}`)).body.data.usedDays).toBe(before);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => call(adminToken, 'patch', `/leave-requests/${leave.body.data.id}/approve`)),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.error.code === 'LEAVE_REQUEST_ALREADY_REVIEWED')).toBe(true);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect((await call(staffToken, 'get', `/leave-balance/${STAFF_ID}`)).body.data.usedDays).toBe(before + 3);
  });

  it('병가 승인과 연차 반려는 잔여를 차감하지 않는다(ATT-T02, ADR-ATT-01)', async () => {
    const staffToken = await login(app, ACCOUNTS.seochoStaff);
    const adminToken = await login(app, ACCOUNTS.seochoAdmin);
    const before = (await call(staffToken, 'get', `/leave-balance/${STAFF_ID}`)).body.data.usedDays;

    const sick = await call(staffToken, 'post', '/leave-requests', { type: 'SICK', startDate: '2026-11-09', endDate: '2026-11-10' });
    expect((await call(adminToken, 'patch', `/leave-requests/${sick.body.data.id}/approve`)).body.data.status).toBe('APPROVED');
    const annual = await call(staffToken, 'post', '/leave-requests', { type: 'ANNUAL', startDate: '2026-11-16', endDate: '2026-11-16' });
    expect((await call(adminToken, 'patch', `/leave-requests/${annual.body.data.id}/reject`)).body.data.status).toBe('REJECTED');

    expect((await call(staffToken, 'get', `/leave-balance/${STAFF_ID}`)).body.data.usedDays).toBe(before);
  });

  it('결근 확정을 동시에 두 번 호출해도 한 날짜에 한 행 — 두 응답을 합치면 저장된 행과 정확히 같다', async () => {
    await db(app).staff.update({ where: { id: STAFF_ID }, data: { employmentType: '정규직', offDays: [] } });
    const adminToken = await login(app, ACCOUNTS.seochoAdmin);
    const [a, b] = await Promise.all([
      call(adminToken, 'post', '/attendance/absence-confirm', { month: '2026-06' }),
      call(adminToken, 'post', '/attendance/absence-confirm', { month: '2026-06' }),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    const returned = [...a.body.data, ...b.body.data].filter((r: { staffId: string }) => r.staffId === STAFF_ID);
    const stored = await db(app).attendanceRecord.findMany({ where: { staffId: STAFF_ID, status: 'ABSENT' } });
    expect(stored.length).toBeGreaterThan(0);
    expect(returned).toHaveLength(stored.length); // 겹쳐서 돌려준 날짜가 없다(각 호출은 자기가 만든 행만)
    expect(new Set(stored.map((r) => r.date.getTime())).size).toBe(stored.length);
  });

  it('업무일지: 같은 날 동시 작성 5건 → 한 행만 남고(하루 1건), 그 내용은 보낸 것 중 하나', async () => {
    const token = await login(app, ACCOUNTS.seochoStaff);
    const contents = Array.from({ length: 5 }, (_, i) => `동시 작성 ${i}`);
    const results = await Promise.all(contents.map((content) => call(token, 'post', '/work-logs', { date: '2026-06-10', content })));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const logs = await db(app).workLog.findMany({ where: { staffId: STAFF_ID } });
    expect(logs).toHaveLength(1);
    expect(contents).toContain(logs[0].content);

    const list = await call(token, 'get', `/work-logs?staffId=${STAFF_ID}&date=2026-06-10`);
    expect(list.body.data).toEqual([expect.objectContaining({ date: '2026-06-10', content: logs[0].content })]);
  });
});
