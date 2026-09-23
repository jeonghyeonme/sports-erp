import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, login, mockData } from './helpers/app';

/**
 * 근태 기록의 지점 귀속 — ADR-ATT-03(domains/근태관리.md) 검증.
 * 최초 구조(현재 파견 지점 기준 집계)는 월중 파견 이동 시 과거 근무 기록이 소급 왜곡됐다
 * ("현장별 근태"라는 F03a 요건 위반). 이 테스트는 그 시나리오를 직접 재현해, 수정된 구조가
 * 체크인/결근확정/요약 세 경로 모두에서 "기록 시점 당시 소속"으로 귀속하는지 확인한다.
 *
 * 파견 이력을 고정된 과거 달(2026-06)로 직접 구성해 실행일에 관계없이 결정적으로 만든다
 * (reservation-capacity.spec.ts가 미래 슬롯에 고정 날짜를 쓰는 것과 같은 이유).
 */
describe('근태 기록의 지점 귀속 (ADR-ATT-03)', () => {
  let app: INestApplication;
  const STAFF_ID = 'staff-seoyeon';
  const SEOCHO_PERIOD = { start: '2026-06-01', end: '2026-06-16' }; // endDate 배타적 → 서초 마지막 근무일 06-15
  const GANGNAM_PERIOD_START = '2026-06-16';

  beforeEach(async () => {
    app = await createApp();
    const data = mockData(app);

    const staff = data.staff.find((s) => s.id === STAFF_ID)!;
    staff.employmentType = '정규직';
    staff.offDays = [];
    staff.branchId = BRANCH.gangnam; // 현재는 강남 소속(파견 이동 완료된 상태를 시뮬레이션)

    // 이 직원의 파견 이력을 서초(6/1~6/15) → 강남(6/16~, 현재 진행 중) 두 구간으로 고정한다.
    for (let i = data.staffAssignments.length - 1; i >= 0; i--) {
      if (data.staffAssignments[i].staffId === STAFF_ID) data.staffAssignments.splice(i, 1);
    }
    data.staffAssignments.push(
      {
        id: 'assignment-test-seocho',
        staffId: STAFF_ID,
        branchId: BRANCH.seocho,
        startDate: SEOCHO_PERIOD.start,
        endDate: SEOCHO_PERIOD.end,
        assignedBy: 'account-haneul',
      },
      {
        id: 'assignment-test-gangnam',
        staffId: STAFF_ID,
        branchId: BRANCH.gangnam,
        startDate: GANGNAM_PERIOD_START,
        assignedBy: 'account-haneul',
      },
    );
  });
  afterEach(async () => {
    await app.close();
  });

  it('결근 확정 — 서초 재직 중이던 과거 날짜는 서초로, 강남 이동 후 날짜는 강남으로 귀속된다', async () => {
    const superToken = await login(app, ACCOUNTS.superAdmin);
    const confirmAs = (branchToken: string, note: string) =>
      request(app.getHttpServer())
        .post('/api/v1/attendance/absence-confirm')
        .set('Authorization', branchToken)
        .send({ month: '2026-06', note });

    // 서초 관리자가 서초분을 확정 — 서초 재직 기간(6/1~6/15)의 결근만 잡혀야 한다.
    // (서초 관리자 본인 staff-minsu도 같은 호출에서 셀프서비스로 함께 잡히므로, 대상 직원만 걸러서 본다.)
    const seochoAdminToken = await login(app, ACCOUNTS.seochoAdmin);
    const seochoResult = await confirmAs(seochoAdminToken, '서초 확정');
    expect(seochoResult.status).toBe(201);
    const seochoDates = seochoResult.body.data
      .filter((r: { staffId: string }) => r.staffId === STAFF_ID)
      .map((r: { date: string }) => r.date);
    expect(seochoDates.every((d: string) => d >= SEOCHO_PERIOD.start && d < SEOCHO_PERIOD.end)).toBe(true);
    expect(seochoDates.length).toBeGreaterThan(0);

    // 강남 관리자가 강남분을 확정 — 6/16 이후분만 잡혀야 한다(서초 기간과 겹치지 않음).
    const gangnamAdminToken = await login(app, ACCOUNTS.gangnamAdmin);
    const gangnamResult = await confirmAs(gangnamAdminToken, '강남 확정');
    expect(gangnamResult.status).toBe(201);
    const gangnamDates = gangnamResult.body.data
      .filter((r: { staffId: string }) => r.staffId === STAFF_ID)
      .map((r: { date: string }) => r.date);
    expect(gangnamDates.every((d: string) => d >= GANGNAM_PERIOD_START)).toBe(true);
    expect(gangnamDates.length).toBeGreaterThan(0);

    // 두 확정 결과에 겹치는 날짜가 없다 — 같은 날이 두 지점 모두에 결근으로 잡히면 왜곡이 재발한 것.
    const overlap = seochoDates.filter((d: string) => gangnamDates.includes(d));
    expect(overlap).toHaveLength(0);

    // 실제로 저장된 레코드도 각각 올바른 branchId를 갖는다(super로 전체 조회).
    const allRecords = mockData(app).attendanceRecords.filter((r) => r.staffId === STAFF_ID);
    for (const r of allRecords) {
      if (r.date < SEOCHO_PERIOD.end) expect(r.branchId).toBe(BRANCH.seocho);
      else expect(r.branchId).toBe(BRANCH.gangnam);
    }
    void superToken; // 대조군 시나리오(3번째 it)에서 재사용
  });

  it('체크인 기록의 branchId는 체크인 시점(오늘) 기준 소속으로 저장된다', async () => {
    const staffToken = await login(app, ACCOUNTS.seochoStaff); // staff-seoyeon 본인
    const res = await request(app.getHttpServer())
      .post('/api/v1/attendance/check-in')
      .set('Authorization', staffToken);
    expect(res.status).toBe(201);
    expect(res.body.data.branchId).toBe(BRANCH.gangnam); // beforeEach에서 강남으로 이동 완료 상태
  });

  it('지점 근태 요약은 기록의 branchId 기준이라, 전출 전 기록은 서초 요약에서만 보인다', async () => {
    const data = mockData(app);
    data.attendanceRecords.push({
      id: 'attendance-test-snapshot-1',
      staffId: STAFF_ID,
      branchId: BRANCH.seocho,
      date: '2026-06-10',
      status: 'NORMAL',
      checkInAt: '2026-06-10T00:30:00.000Z',
    });

    const superToken = await login(app, ACCOUNTS.superAdmin);
    const seochoSummary = await request(app.getHttpServer())
      .get(`/api/v1/attendance/summary?branchId=${BRANCH.seocho}&month=2026-06`)
      .set('Authorization', superToken);
    const gangnamSummary = await request(app.getHttpServer())
      .get(`/api/v1/attendance/summary?branchId=${BRANCH.gangnam}&month=2026-06`)
      .set('Authorization', superToken);

    const seochoRow = seochoSummary.body.data.find((r: { staffId: string }) => r.staffId === STAFF_ID);
    const gangnamRow = gangnamSummary.body.data.find((r: { staffId: string }) => r.staffId === STAFF_ID);
    expect(seochoRow?.normal).toBe(1); // 서초 요약에는 잡힘(현재 소속이 강남이어도)
    expect(gangnamRow?.normal ?? 0).toBe(0); // 강남 요약에는 안 잡힘(그 기록은 강남 소속 때 생긴 게 아니므로)
  });
});
