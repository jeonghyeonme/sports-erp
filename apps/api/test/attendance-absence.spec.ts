import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { todayKst } from '../src/common/date/kst-date';
import { ACCOUNTS, BRANCH, createApp, login, mockData } from './helpers/app';

function daysBeforeToday(n: number): string {
  const d = new Date(`${todayKst()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * 결근 미리보기·확정 — ADR-ATT-02(domains/근태관리.md) 재결정 검증.
 * 최초 결정("조회 시점 지연 계산, 미영속")은 결근 이력이 DB에 안 남는다는 문제로 철회됐고,
 * "관리자 명시적 확정 액션"(ADR-AUTH-02와 같은 원칙 — 되돌리기 어려운 인사 조치는 사람이 트리거)으로
 * 재결정됐다. 미리보기는 저장하지 않고, 확정 호출만 AttendanceRecord(ABSENT)를 영속화해야 한다.
 */
describe('결근 미리보기·확정 (ADR-ATT-02)', () => {
  let app: INestApplication;
  let adminToken: string;
  const STAFF_ID = 'staff-seoyeon'; // 서초점 소속

  beforeEach(async () => {
    app = await createApp();
    adminToken = await login(app, ACCOUNTS.seochoAdmin);
    const staff = mockData(app).staff.find((s) => s.id === STAFF_ID)!;
    staff.employmentType = '정규직';
    staff.offDays = []; // 이 테스트에서는 모든 날짜를 근무일로 취급(요일 계산 자체는 kst-date.spec.ts가 별도 검증)
  });
  afterEach(async () => {
    await app.close();
  });

  const month = () => daysBeforeToday(1).slice(0, 7);
  const preview = (token = adminToken) =>
    request(app.getHttpServer())
      .get(`/api/v1/attendance/absence-preview?branchId=${BRANCH.seocho}&month=${month()}`)
      .set('Authorization', token);
  const confirm = (note?: string, token = adminToken) =>
    request(app.getHttpServer())
      .post('/api/v1/attendance/absence-confirm')
      .set('Authorization', token)
      .send({ month: month(), note });

  it('체크인·승인휴가가 없는 과거 근무일은 잠정 결근으로 미리보기에 잡히되 저장되지는 않는다', async () => {
    const yesterday = daysBeforeToday(1);
    const res = await preview();
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ staffId: STAFF_ID, date: yesterday })]),
    );
    expect(
      mockData(app).attendanceRecords.some((r) => r.staffId === STAFF_ID && r.date === yesterday),
    ).toBe(false);
  });

  it('확정하면 AttendanceRecord(ABSENT)로 영속화되고, 재확정해도 중복 생성되지 않는다(멱등)', async () => {
    const yesterday = daysBeforeToday(1);
    const first = await confirm();
    expect(first.status).toBe(201);
    expect(first.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ staffId: STAFF_ID, date: yesterday, status: 'ABSENT' })]),
    );
    expect(
      mockData(app).attendanceRecords.filter((r) => r.staffId === STAFF_ID && r.date === yesterday),
    ).toHaveLength(1);

    const second = await confirm(); // 이미 기록이 생겼으니 미리보기에서 빠져 아무것도 새로 안 만든다
    expect(second.status).toBe(201);
    expect(second.body.data).toHaveLength(0);
    expect(
      mockData(app).attendanceRecords.filter((r) => r.staffId === STAFF_ID && r.date === yesterday),
    ).toHaveLength(1);
  });

  it('승인된 휴가 기간은 결근 후보에서 빠진다', async () => {
    const yesterday = daysBeforeToday(1);
    mockData(app).leaveRequests.push({
      id: 'leave-test-absence-1',
      staffId: STAFF_ID,
      type: 'ANNUAL',
      startDate: yesterday,
      endDate: yesterday,
      days: 1,
      status: 'APPROVED',
    });
    const res = await preview();
    expect(
      res.body.data.some((r: { staffId: string; date: string }) => r.staffId === STAFF_ID && r.date === yesterday),
    ).toBe(false);
  });

  it('이미 체크인 기록이 있는 날은 결근 후보에서 빠진다', async () => {
    const yesterday = daysBeforeToday(1);
    mockData(app).attendanceRecords.push({
      id: 'attendance-test-absence-1',
      staffId: STAFF_ID,
      date: yesterday,
      status: 'NORMAL',
      checkInAt: `${yesterday}T00:30:00.000Z`,
    });
    const res = await preview();
    expect(
      res.body.data.some((r: { staffId: string; date: string }) => r.staffId === STAFF_ID && r.date === yesterday),
    ).toBe(false);
  });

  it('파트타임 직원은 결근 후보에서 제외된다(근무일 판정 자체를 하지 않음)', async () => {
    const staff = mockData(app).staff.find((s) => s.id === STAFF_ID)!;
    staff.employmentType = '파트타임';
    const res = await preview();
    expect(res.body.data.some((r: { staffId: string }) => r.staffId === STAFF_ID)).toBe(false);
  });

  it('BRANCH_ADMIN이 아닌 STAFF는 결근을 확정할 수 없다(403, 대조군은 위 테스트들의 BRANCH_ADMIN 성공 케이스)', async () => {
    const staffToken = await login(app, ACCOUNTS.seochoStaff);
    const res = await confirm(undefined, staffToken);
    expect(res.status).toBe(403);
  });

  it('SUPER_ADMIN도 결근을 확정할 수 없다(현장 운영 비개입 원칙, 03문서 §7)', async () => {
    const superToken = await login(app, ACCOUNTS.superAdmin);
    const res = await confirm(undefined, superToken);
    expect(res.status).toBe(403);
  });
});
