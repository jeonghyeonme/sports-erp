import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { todayKst } from '../src/common/date/kst-date';
import { PermissionService } from '../src/common/permissions/permission.service';
import { ACCOUNTS, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D61 — 처리 대기함(GET /inbox). 역할별 항목과 건수, 범위(본인 지점·본인), 세부 권한(D60)으로 조회가 꺼진 항목 제외.
 * 건수는 기준 시드 상태에 기대지 않고 "만들기 전 → 만든 뒤" 차이로 본다.
 */
describe('처리 대기함 (D61)', () => {
  let app: INestApplication;
  const api = (auth: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth),
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
  });
  const countOf = async (auth: string, key: string) => {
    const items = (await api(auth).get('/inbox')).body.data as Array<{ key: string; count: number }>;
    return items.find((i) => i.key === key)?.count;
  };

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('역할마다 항목이 다르다 — 회원은 403', async () => {
    const keys = async (email: string) =>
      ((await api(await login(app, email)).get('/inbox')).body.data as Array<{ key: string }>).map((i) => i.key);
    expect(await keys(ACCOUNTS.superAdmin)).toEqual(['support', 'contract', 'unassigned', 'retention']);
    expect(await keys(ACCOUNTS.seochoAdmin)).toEqual(['leave', 'changeRequest', 'checkIn', 'congestion']);
    expect(await keys(ACCOUNTS.seochoStaff)).toEqual(['checkInToday', 'myLeave']);
    expect((await api(await login(app, ACCOUNTS.seochoMember)).get('/inbox')).status).toBe(403);
  });

  it('휴가 신청 하나가 서초 관리자 대기함에만 +1 — 강남 관리자는 그대로(지점 범위)', async () => {
    const seocho = await login(app, ACCOUNTS.seochoAdmin);
    const gangnam = await login(app, ACCOUNTS.gangnamAdmin);
    const staff = await login(app, ACCOUNTS.seochoStaff);
    const [s0, g0, m0] = [await countOf(seocho, 'leave'), await countOf(gangnam, 'leave'), await countOf(staff, 'myLeave')];
    expect((await api(staff).post('/leave-requests', { type: 'ANNUAL', startDate: '2026-12-14', endDate: '2026-12-15' })).status).toBe(201);
    expect(await countOf(seocho, 'leave')).toBe(s0! + 1);
    expect(await countOf(gangnam, 'leave')).toBe(g0);
    expect(await countOf(staff, 'myLeave')).toBe(m0! + 1);
  });

  it('지점이 올린 업무지원 요청은 본사 대기함에 +1', async () => {
    const hq = await login(app, ACCOUNTS.superAdmin);
    const before = await countOf(hq, 'support');
    const admin = await login(app, ACCOUNTS.seochoAdmin);
    await api(admin).post('/support-requests', { category: 'OTHER', title: '대기함 확인', content: '대기함' });
    expect(await countOf(hq, 'support')).toBe(before! + 1);
  });

  it('직원 — 오늘 출근 체크 전이면 1, 체크인하면 0(근무일일 때)', async () => {
    const staff = await login(app, ACCOUNTS.seochoStaff);
    const offDays = (await db(app).staff.findUniqueOrThrow({ where: { id: 'staff-seoyeon' } })).offDays;
    const weekday = new Date(`${todayKst()}T00:00:00Z`).getUTCDay();
    if (offDays.includes(weekday)) {
      expect(await countOf(staff, 'checkInToday')).toBe(0); // 정기 휴무일
      return;
    }
    expect(await countOf(staff, 'checkInToday')).toBe(1);
    expect((await api(staff).post('/attendance/check-in')).status).toBe(201);
    expect(await countOf(staff, 'checkInToday')).toBe(0);
  });

  it('세부 권한(D60)으로 휴가 조회가 꺼지면 그 항목이 빠진다', async () => {
    await db(app).rolePermission.create({ data: { role: 'BRANCH_ADMIN', feature: 'leave', action: 'READ', allowed: false } });
    app.get(PermissionService).invalidate();
    const admin = await login(app, ACCOUNTS.seochoAdmin);
    const keys = ((await api(admin).get('/inbox')).body.data as Array<{ key: string }>).map((i) => i.key);
    expect(keys).not.toContain('leave');
    expect(keys).toContain('checkIn'); // 대조군
  });
});
