import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { todayKst } from '../src/common/date/kst-date';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * RFP 중간 작업 M2·M7(D51, 작업 브리프 B2).
 * - ADR-ATT-04: 지점 관리자의 근태 정정·누락일 등록(PUT /attendance/:staffId/:date), 사유 필수, 그날 기록의 지점 기준.
 * - D52: 근태 정정·회원 상태·자산 상태 변경을 변경 이력(AuditLog)에 같은 트랜잭션으로 남긴다.
 * 이 파일은 쓰기가 많아 테스트마다 워커 DB를 템플릿에서 다시 만든다(apps/api CLAUDE.md).
 */
const STAFF = 'staff-seoyeon';

const daysFromToday = (n: number) => {
  const d = new Date(`${todayKst()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

describe('근태 정정(ADR-ATT-04)과 변경 이력 확대(D52)', () => {
  let app: INestApplication;
  const tok: Record<string, string> = {};

  const put = (auth: string, staffId: string, date: string, body: object) =>
    request(app.getHttpServer()).put(`/api/v1/attendance/${staffId}/${date}`).set('Authorization', auth).send(body);
  const patch = (auth: string, path: string, body: object) =>
    request(app.getHttpServer()).patch(`/api/v1${path}`).set('Authorization', auth).send(body);
  const audits = (action: string, entityId: string) =>
    db(app).auditLog.findMany({ where: { action, entityId }, orderBy: { createdAt: 'asc' } });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    tok.seochoAdmin = await login(app, ACCOUNTS.seochoAdmin);
    tok.seochoStaff = await login(app, ACCOUNTS.seochoStaff);
    tok.superAdmin = await login(app, ACCOUNTS.superAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  describe('정정·등록', () => {
    it('기록 없는 날을 등록하고(KST 시각) 이력에 "없음 → 정상"으로 남긴다', async () => {
      const date = daysFromToday(-1);
      const res = await put(tok.seochoAdmin, STAFF, date, {
        status: 'NORMAL',
        checkInTime: '08:55',
        checkOutTime: '18:05',
        reason: '체크인 누락 — 출입 기록 확인',
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ staffId: STAFF, date, status: 'NORMAL', branchId: BRANCH.seocho });
      expect(res.body.data.checkInAt).toBe(new Date(`${date}T08:55:00+09:00`).toISOString());

      const logs = await audits('ATTENDANCE_CORRECTED', STAFF);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({ entity: 'Staff', actorId: 'account-minsu' });
      expect(logs[0].before).toEqual({ date, status: null });
      expect(logs[0].after).toMatchObject({ date, status: 'NORMAL', reason: '체크인 누락 — 출입 기록 확인', branchId: BRANCH.seocho });
    });

    it('있는 기록을 고치면 이전 값이 이력에 남고, 같은 값으로 다시 보내면 이력이 늘지 않는다', async () => {
      const date = daysFromToday(-2);
      await db(app).attendanceRecord.create({
        data: { staffId: STAFF, branchId: BRANCH.seocho, date: new Date(`${date}T00:00:00Z`), status: 'ABSENT', note: '결근 확정' },
      });
      const body = { status: 'LATE', checkInTime: '09:40', reason: '결근 확정 후 출근 확인됨' };
      expect((await put(tok.seochoAdmin, STAFF, date, body)).status).toBe(200);
      expect((await put(tok.seochoAdmin, STAFF, date, body)).status).toBe(200);

      const logs = await audits('ATTENDANCE_CORRECTED', STAFF);
      expect(logs).toHaveLength(1);
      expect(logs[0].before).toEqual({ date, status: 'ABSENT', checkInAt: null, checkOutAt: null });
      const row = await db(app).attendanceRecord.findUniqueOrThrow({
        where: { staffId_date: { staffId: STAFF, date: new Date(`${date}T00:00:00Z`) } },
      });
      expect(row).toMatchObject({ status: 'LATE', note: '결근 확정 후 출근 확인됨', checkOutAt: null });
    });

    it.each([
      ['사유 없음', { status: 'NORMAL', checkInTime: '09:00' }, 'VALIDATION_ERROR'],
      ['출근 상태인데 출근 시각 없음', { status: 'NORMAL', reason: '누락 등록' }, 'CHECK_IN_REQUIRED'],
      ['결근에 시각', { status: 'ABSENT', checkInTime: '09:00', reason: '결근 처리' }, 'VALIDATION_ERROR'],
      ['퇴근이 출근보다 빠름', { status: 'NORMAL', checkInTime: '18:00', checkOutTime: '09:00', reason: '시각 정정' }, 'INVALID_TIME_RANGE'],
    ])('400 — %s', async (_name, body, code) => {
      const res = await put(tok.seochoAdmin, STAFF, daysFromToday(-1), body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(code);
      expect(await audits('ATTENDANCE_CORRECTED', STAFF)).toHaveLength(0);
    });

    it('오늘 이후 날짜는 400(오늘은 된다)', async () => {
      const future = await put(tok.seochoAdmin, STAFF, daysFromToday(1), { status: 'ABSENT', reason: '미리 결근' });
      expect(future.status).toBe(400);
      expect(future.body.error.code).toBe('FUTURE_ATTENDANCE');
      const today = await put(tok.seochoAdmin, STAFF, todayKst(), { status: 'ON_LEAVE', reason: '반차 신청 누락' });
      expect(today.status).toBe(200);
    });
  });

  describe('권한', () => {
    const body = { status: 'NORMAL', checkInTime: '09:00', reason: '권한 확인' };

    it('직원·본사는 정정할 수 없다(지점 관리자만, 대조군 포함)', async () => {
      const date = daysFromToday(-1);
      expect((await put(tok.seochoStaff, STAFF, date, body)).status).toBe(403);
      expect((await put(tok.superAdmin, STAFF, date, body)).status).toBe(403);
      expect((await put(tok.seochoAdmin, STAFF, date, body)).status).toBe(200);
    });

    it('그날 기록이 다른 지점 것이면(ADR-ATT-03 스냅샷) 지금 자기 지점 직원이어도 403', async () => {
      const date = daysFromToday(-3);
      await db(app).attendanceRecord.create({
        data: { staffId: STAFF, branchId: BRANCH.gangnam, date: new Date(`${date}T00:00:00Z`), checkInAt: new Date(), status: 'NORMAL' },
      });
      const res = await put(tok.seochoAdmin, STAFF, date, body);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ATTENDANCE_SCOPE_VIOLATION');
      expect(await audits('ATTENDANCE_CORRECTED', STAFF)).toHaveLength(0);
    });
  });

  describe('회원·자산 상태 변경 이력(D52)', () => {
    it('회원 상태가 바뀌면 남기고, 같은 상태면 남기지 않는다', async () => {
      expect((await patch(tok.seochoAdmin, '/members/member-sujin/status', { status: 'DORMANT' })).status).toBe(200);
      expect((await patch(tok.seochoAdmin, '/members/member-sujin/status', { status: 'DORMANT' })).status).toBe(200);
      const logs = await audits('MEMBER_STATUS_CHANGED', 'member-sujin');
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({ entity: 'Member', actorId: 'account-minsu' });
      expect(logs[0].before).toEqual({ status: 'ACTIVE' });
      expect(logs[0].after).toEqual({ status: 'DORMANT', branchId: BRANCH.seocho });
    });

    it('자산 상태 전이를 남기고, 허용 안 된 전이(409)는 남기지 않는다', async () => {
      const id = 'asset-seocho-treadmill';
      expect((await patch(tok.seochoAdmin, `/assets/${id}/status`, { status: 'REPAIRING' })).status).toBe(200);
      expect((await patch(tok.seochoAdmin, `/assets/${id}/status`, { status: 'DISPOSED' })).status).toBe(409);
      const logs = await audits('ASSET_STATUS_CHANGED', id);
      expect(logs).toHaveLength(1);
      expect(logs[0].before).toEqual({ status: 'NORMAL' });
      expect(logs[0].after).toEqual({ status: 'REPAIRING', branchId: BRANCH.seocho });

      // 본사 변경 이력 화면 — 자산은 "이름(자산코드)"로 보인다
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit-logs?action=ASSET_STATUS_CHANGED')
        .set('Authorization', tok.superAdmin);
      expect(res.status).toBe(200);
      expect(res.body.data[0].entityName).toMatch(/^러닝머신\(.+\)$/);
    });
  });
});
