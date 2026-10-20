import { Injectable } from '@nestjs/common';
import {
  AttendanceRecord,
  AttendanceStatus,
  LeaveBalance,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  Prisma,
  WorkLog,
} from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { kstHoursMinutes, todayKst, toKstDateString } from '../../common/date/kst-date';
import { PrismaService } from '../../prisma/prisma.service';
import { recordAudit } from '../../prisma/audit';
import { lockStaff } from '../../prisma/integrity';
import {
  MockAttendanceRecord,
  MockLeaveBalance,
  MockLeaveBalanceWithUsage,
  MockLeaveRequest,
  MockWorkLog,
} from '../../fixtures/mock-data.types';

type Tx = Prisma.TransactionClient;
type AssignmentSpan = { branchId: string; startDate: Date; endDate: Date | null };
export type AbsenceCandidate = { staffId: string; name: string; date: string };

const LEAVE_STATUSES: LeaveStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
const dateOf = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`);
const day = (d: Date) => toKstDateString(d);

/**
 * 근태·휴가·연차 잔여·업무일지 — D33. 원천은 DB다.
 * 판정 규칙(지각·결근·지점 귀속·연차 차감)은 mock 구현(근태관리 문서, ADR-ATT-01~03)을 그대로 옮겼고,
 * 단일 스레드 가정에 기대던 곳은 DB 제약 + 조건부 갱신으로 바꿨다(D33 결정 1).
 */
@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 체크인·체크아웃 ─────────────────────────────────────

  // 근태관리 A-6 "자동 지각 판정" — Branch.standardCheckInTime 대비 10분 초과 시 LATE.
  // 체크인 중복 방지(불변규칙 1): 앱 검사 + (staffId, date) unique. 동시 체크인 경합은 P2002 → 409.
  async checkIn(staffId: string): Promise<MockAttendanceRecord> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: { branch: { select: { standardCheckInTime: true } } },
    });
    if (!staff) throw staffNotFound();
    const now = new Date();
    const date = todayKst();
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { staffId_date: { staffId, date: dateOf(date) } },
    });
    if (existing?.checkInAt) throw alreadyCheckedIn();

    const status: AttendanceStatus = isLate(now, staff.branch.standardCheckInTime) ? 'LATE' : 'NORMAL';
    // 오늘 체크인이므로 "현재" 소속이 맞지만, 결근 확정과 같은 경로(ADR-ATT-03)를 타게 한다.
    const branchId = (await this.branchIdForStaffOnDate(staffId, date)) ?? staff.branchId;

    if (existing) {
      const { count } = await this.prisma.attendanceRecord.updateMany({
        where: { id: existing.id, checkInAt: null },
        data: { checkInAt: now, status, branchId },
      });
      if (count === 0) throw alreadyCheckedIn();
      return toMockAttendance(await this.prisma.attendanceRecord.findUniqueOrThrow({ where: { id: existing.id } }));
    }
    try {
      return toMockAttendance(
        await this.prisma.attendanceRecord.create({
          data: { staffId, branchId, date: dateOf(date), checkInAt: now, status },
        }),
      );
    } catch (e) {
      if (isUniqueViolation(e)) throw alreadyCheckedIn();
      throw e;
    }
  }

  async checkOut(staffId: string): Promise<MockAttendanceRecord> {
    const date = dateOf(todayKst());
    const { count } = await this.prisma.attendanceRecord.updateMany({
      where: { staffId, date, checkInAt: { not: null }, checkOutAt: null },
      data: { checkOutAt: new Date() },
    });
    const record = await this.prisma.attendanceRecord.findUnique({ where: { staffId_date: { staffId, date } } });
    if (!record || !record.checkInAt) {
      throw new AppException('NOT_CHECKED_IN', '오늘 체크인 기록이 없습니다.', 400);
    }
    if (count === 0) {
      throw new AppException('ALREADY_CHECKED_OUT', '오늘 이미 체크아웃했습니다.', 409);
    }
    return toMockAttendance(record);
  }

  // ── 조회 ──────────────────────────────────────────────

  async listAttendance(staffId: string, month?: string): Promise<MockAttendanceRecord[]> {
    const rows = await this.prisma.attendanceRecord.findMany({
      where: { staffId, date: monthRange(month) },
      orderBy: { date: 'asc' },
    });
    return rows.map(toMockAttendance).filter((r) => !month || r.date.startsWith(month));
  }

  // 근태관리 A-5 GET /attendance/summary — ADR-ATT-03: 집계 기준은 "기록 자체의 branchId"다.
  // 직원 명단은 "현재 이 지점 소속" ∪ "이 달에 이 지점 기록이 있는 사람"이라, 월중 전출한 직원도 전출 전 기록만큼 남는다.
  async summary(branchId: string, month: string) {
    const records = (
      await this.prisma.attendanceRecord.findMany({ where: { branchId, date: monthRange(month) } })
    )
      .map(toMockAttendance)
      .filter((r) => r.date.startsWith(month));
    const current = await this.prisma.staff.findMany({
      where: { branchId },
      select: { id: true },
      orderBy: { staffCode: 'asc' },
    });
    const staffIds = [...new Set([...current.map((s) => s.id), ...records.map((r) => r.staffId)])];
    const names = new Map(
      (await this.prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } })).map(
        (s) => [s.id, s.name],
      ),
    );

    return staffIds.map((staffId) => {
      const own = records.filter((r) => r.staffId === staffId);
      const count = (status: AttendanceStatus) => own.filter((r) => r.status === status).length;
      return {
        staffId,
        name: names.get(staffId) ?? '(알 수 없음)',
        normal: count('NORMAL'),
        late: count('LATE'),
        absent: count('ABSENT'),
        earlyLeave: count('EARLY_LEAVE'),
        onLeave: count('ON_LEAVE'),
      };
    });
  }

  // ── 결근 미리보기·확정 (ADR-ATT-02) ──────────────────────

  // "잠정 결근": ①재직 중 ②오늘 이전 ③그 날짜 기준 이 지점 소속(ADR-ATT-03) ④근무일(파트타임 제외)
  // ⑤근태기록 없음 ⑥승인된 휴가 기간 아님. 저장하지 않는다.
  // D33 결정 3 — 후보 직원·파견 이력·그 달의 근태·그 달과 겹치는 승인 휴가를 한 번씩 읽고 메모리에서 판정한다
  // (mock의 직원×날짜 루프마다 전체 기록을 다시 훑던 O(직원×일수×누적기록)를 "그 달" 크기로 묶는다).
  async previewAbsences(branchId: string, month: string, tx: Tx = this.prisma): Promise<AbsenceCandidate[]> {
    const range = monthRange(month);
    if (!range) return [];
    const staff = await tx.staff.findMany({
      where: { status: 'ACTIVE', OR: [{ branchId }, { assignments: { some: { branchId } } }] },
      include: { assignments: { select: { branchId: true, startDate: true, endDate: true } } },
      orderBy: { staffCode: 'asc' },
    });
    if (staff.length === 0) return [];
    const staffIds = staff.map((s) => s.id);
    const lastDay = new Date(range.lt.getTime() - 86_400_000);
    const [records, leaves] = await Promise.all([
      tx.attendanceRecord.findMany({ where: { staffId: { in: staffIds }, date: range }, select: { staffId: true, date: true } }),
      tx.leaveRequest.findMany({
        where: { staffId: { in: staffIds }, status: 'APPROVED', startDate: { lte: lastDay }, endDate: { gte: range.gte } },
        select: { staffId: true, startDate: true, endDate: true },
      }),
    ]);
    const recorded = new Set(records.map((r) => `${r.staffId}|${day(r.date)}`));
    const leavesByStaff = groupBy(leaves, (l) => l.staffId);

    const daysInMonth = lastDay.getUTCDate();
    const todayStr = todayKst();
    const result: AbsenceCandidate[] = [];
    for (const s of staff) {
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${month}-${String(d).padStart(2, '0')}`;
        if (dateStr >= todayStr) continue; // 오늘·미래는 아직 판단하지 않는다
        if ((branchOnDate(s.assignments, dateStr) ?? s.branchId) !== branchId) continue;
        if (!isWorkDay(s, dateStr)) continue;
        if (recorded.has(`${s.id}|${dateStr}`)) continue;
        const onLeave = (leavesByStaff.get(s.id) ?? []).some(
          (l) => day(l.startDate) <= dateStr && dateStr <= day(l.endDate),
        );
        if (onLeave) continue;
        result.push({ staffId: s.id, name: s.name, date: dateStr });
      }
    }
    return result;
  }

  // 확정은 미리보기를 지금 다시 계산해 그 후보만 ABSENT로 저장한다. (staffId, date) unique + skipDuplicates라
  // 두 관리자가 동시에 확정해도 한 날짜에 한 행만 남고, 각 호출은 자기가 실제로 만든 행만 돌려받는다(D33 결정 1).
  async confirmAbsences(branchId: string, month: string, note?: string): Promise<MockAttendanceRecord[]> {
    const candidates = await this.previewAbsences(branchId, month);
    if (candidates.length === 0) return [];
    const created = await this.prisma.attendanceRecord.createManyAndReturn({
      data: candidates.map((c) => ({
        staffId: c.staffId,
        branchId,
        date: dateOf(c.date),
        status: 'ABSENT' as AttendanceStatus,
        note: note ?? '결근 확정(관리자 확인)',
      })),
      skipDuplicates: true,
    });
    return created.map(toMockAttendance).sort((a, b) => a.staffId.localeCompare(b.staffId) || a.date.localeCompare(b.date));
  }

  // ── 관리자 정정(ADR-ATT-04) ─────────────────────────────

  /**
   * 그날 근태를 관리자가 정한 값으로 바꾼다. 기록이 없으면 만든다(체크인을 잊은 날 — RFP "현장별>개인별 근태 등록").
   * - 지점: 기록의 지점(ADR-ATT-03 스냅샷), 기록이 없으면 그날 파견 지점이 요청자 지점이어야 한다. 직원의 현재 지점은 가드가 본다(D46).
   * - 상태는 관리자가 고른다. 출근 상태(정상·지각·조퇴)는 출근 시각이 필요하고, 결근·휴가는 시각을 비운다.
   * - 변경 이력(entity=Staff, ATTENDANCE_CORRECTED)을 같은 트랜잭션에 남긴다(D44·D52). 바뀐 것이 없으면 쓰지도 남기지도 않는다.
   * - 같은 날을 두 관리자가 동시에 고치면 행 락으로 줄을 세운다. 둘 다 새로 만들려 하면 한쪽은 409.
   */
  async correct(
    actor: { accountId: string; branchId: string },
    staffId: string,
    date: string,
    input: { status: AttendanceStatus; checkInTime?: string; checkOutTime?: string; reason: string },
  ): Promise<MockAttendanceRecord> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || day(dateOf(date)) !== date) {
      throw new AppException('VALIDATION_ERROR', '날짜는 YYYY-MM-DD 형식이어야 합니다.', 400);
    }
    if (date > todayKst()) throw new AppException('FUTURE_ATTENDANCE', '오늘 이후 날짜의 근태는 정정할 수 없습니다.', 400);
    const worked = input.status === 'NORMAL' || input.status === 'LATE' || input.status === 'EARLY_LEAVE';
    if (worked && !input.checkInTime) {
      throw new AppException('CHECK_IN_REQUIRED', '정상·지각·조퇴는 출근 시각이 필요합니다.', 400);
    }
    if (!worked && (input.checkInTime || input.checkOutTime)) {
      throw new AppException('VALIDATION_ERROR', '결근·휴가에는 출퇴근 시각을 넣지 않습니다.', 400);
    }
    if (input.checkInTime && input.checkOutTime && input.checkOutTime < input.checkInTime) {
      throw new AppException('INVALID_TIME_RANGE', '퇴근 시각이 출근 시각보다 빠릅니다.', 400);
    }
    const kst = (hhmm?: string) => (hhmm ? new Date(`${date}T${hhmm}:00+09:00`) : null);
    const next = { status: input.status, checkInAt: kst(input.checkInTime), checkOutAt: kst(input.checkOutTime) };
    const reason = input.reason.trim();

    const staff = await this.prisma.staff.findUnique({ where: { id: staffId }, select: { branchId: true } });
    if (!staff) throw staffNotFound();

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "AttendanceRecord" WHERE "staffId" = ${staffId} AND "date" = ${dateOf(date)} FOR UPDATE`;
        const existing = await tx.attendanceRecord.findUnique({ where: { staffId_date: { staffId, date: dateOf(date) } } });
        const branchId = existing?.branchId ?? (await this.branchIdForStaffOnDate(staffId, date)) ?? staff.branchId;
        if (branchId !== actor.branchId) {
          throw new AppException('ATTENDANCE_SCOPE_VIOLATION', '다른 지점에서 근무한 날의 근태는 정정할 수 없습니다.', 403);
        }
        const snapshot = (r: { status: AttendanceStatus; checkInAt: Date | null; checkOutAt: Date | null }) => ({
          status: r.status,
          checkInAt: r.checkInAt?.toISOString() ?? null,
          checkOutAt: r.checkOutAt?.toISOString() ?? null,
        });
        if (existing && JSON.stringify(snapshot(existing)) === JSON.stringify(snapshot(next))) return existing;

        const saved = existing
          ? await tx.attendanceRecord.update({ where: { id: existing.id }, data: { ...next, note: reason } })
          : await tx.attendanceRecord.create({ data: { staffId, branchId, date: dateOf(date), ...next, note: reason } });
        await recordAudit(tx, {
          actorId: actor.accountId,
          entity: 'Staff',
          entityId: staffId,
          action: 'ATTENDANCE_CORRECTED',
          before: existing ? { date, ...snapshot(existing) } : { date, status: null },
          after: { date, ...snapshot(saved), reason, branchId },
        });
        return saved;
      });
      return toMockAttendance(row);
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new AppException('ATTENDANCE_CONFLICT', '같은 날 근태가 방금 다른 요청으로 만들어졌습니다. 다시 불러와 확인하세요.', 409);
      }
      throw e;
    }
  }

  // ── 휴가·연차 잔여 ──────────────────────────────────────

  // year를 안 주면 올해(KST, D33 결정 4). 행이 없으면 입사 연차로 계산해 만든다(지연 생성, 동시 생성은 skipDuplicates).
  async leaveBalance(staffId: string, year?: number, tx: Tx = this.prisma): Promise<MockLeaveBalance> {
    const targetYear = year ?? Number(todayKst().slice(0, 4));
    const key = { staffId_year: { staffId, year: targetYear } };
    const found = await tx.leaveBalance.findUnique({ where: key });
    if (found) return toMockBalance(found);
    const staff = await tx.staff.findUnique({ where: { id: staffId }, select: { hireDate: true } });
    if (!staff) throw staffNotFound();
    await tx.leaveBalance.createMany({
      data: [{ staffId, year: targetYear, totalDays: annualLeaveTotalDays(staff.hireDate, targetYear), usedDays: 0 }],
      skipDuplicates: true,
    });
    return toMockBalance(await tx.leaveBalance.findUniqueOrThrow({ where: key }));
  }

  // 근태관리 F3-2(log/133) — 잔여 연차 + 올해 승인된 휴가의 유형별 사용 일수. 해를 걸친 휴가는 시작일의 해로 센다.
  // 잔여 계산(leaveBalance)은 신청·승인 트랜잭션도 쓰므로 집계는 조회 라우트에서만 붙인다.
  async leaveBalanceWithUsage(staffId: string): Promise<MockLeaveBalanceWithUsage> {
    const balance = await this.leaveBalance(staffId);
    const sums = await this.prisma.leaveRequest.groupBy({
      by: ['type'],
      where: {
        staffId,
        status: 'APPROVED',
        startDate: { gte: dateOf(`${balance.year}-01-01`), lt: dateOf(`${balance.year + 1}-01-01`) },
      },
      _sum: { days: true },
    });
    const usedByType: Record<LeaveType, number> = { ANNUAL: 0, SICK: 0, FAMILY_EVENT: 0, OTHER: 0 };
    for (const s of sums) usedByType[s.type] = s._sum.days ?? 0;
    return { ...balance, usedByType };
  }

  // 근태관리 A-6 — 잔여일수 초과 신청도 막지 않고 경고만 반환(관리자 재량 승인).
  async requestLeave(
    staffId: string,
    input: { type: LeaveType; startDate: string; endDate: string; reason?: string },
  ): Promise<{ request: MockLeaveRequest; warning?: string }> {
    const days = leaveDays(input.startDate, input.endDate);
    if (days <= 0) {
      throw new AppException('INVALID_DATE_RANGE', '종료일은 시작일 이후여야 합니다.', 400);
    }
    let warning: string | undefined;
    if (input.type === 'ANNUAL') {
      const balance = await this.leaveBalance(staffId);
      if (balance.totalDays - balance.usedDays < days) {
        warning = '잔여 연차보다 많은 일수를 신청했습니다. 관리자 재량으로 승인될 수 있습니다.';
      }
    }
    // ADR-ATT-05(log/141) — 대기·승인 중인 휴가와 하루라도 겹치면 받지 않는다. 같은 신청이 재시도로 두 번 오면
    // 둘 다 승인돼 연차가 두 번 깎였다. 직원 행 락 위에서 검사하고 만들어 동시 신청도 한 건만 남는다.
    const startDate = dateOf(input.startDate);
    const endDate = dateOf(input.endDate);
    const request = await this.prisma.$transaction(async (tx) => {
      if (!(await lockStaff(tx, staffId))) throw staffNotFound();
      await assertNoOverlappingLeave(tx, staffId, startDate, endDate, ['PENDING', 'APPROVED']);
      return tx.leaveRequest.create({
        data: { staffId, type: input.type, startDate, endDate, days, reason: input.reason },
      });
    });
    return { request: toMockLeave(request), warning };
  }

  async listLeaveRequests(filter: { staffId?: string; branchId?: string; status?: string }): Promise<MockLeaveRequest[]> {
    // 예전 mock은 모르는 상태값으로 거르면 빈 목록이었다 — enum 밖 값을 DB로 보내 500이 나지 않게 유지.
    if (filter.status && !LEAVE_STATUSES.includes(filter.status as LeaveStatus)) return [];
    const rows = await this.prisma.leaveRequest.findMany({
      where: {
        staffId: filter.staffId,
        staff: filter.branchId ? { branchId: filter.branchId } : undefined,
        status: filter.status as LeaveStatus | undefined,
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toMockLeave);
  }

  // ADR-ATT-01 — 승인 시점에만 차감, ANNUAL만 잔여에 반영. "PENDING일 때만" 바꾸는 조건부 갱신과
  // 잔여 증가를 한 트랜잭션으로 묶어, 동시 승인이 와도 한 번만 차감된다(data-integrity §6).
  async approveLeaveRequest(id: string, approverId: string): Promise<MockLeaveRequest> {
    return this.prisma.$transaction(async (tx) => {
      // ADR-ATT-05 — 신청 때 막기 전에 쌓인 겹치는 신청(배포 DB 등)이 있어도, 이미 승인된 휴가와 겹치면 승인하지 않는다.
      const pending = await tx.leaveRequest.findUnique({ where: { id }, select: { staffId: true, startDate: true, endDate: true } });
      if (pending) {
        await lockStaff(tx, pending.staffId);
        await assertNoOverlappingLeave(tx, pending.staffId, pending.startDate, pending.endDate, ['APPROVED'], id);
      }
      const request = await this.review(tx, id, approverId, 'APPROVED');
      if (request.type === 'ANNUAL') {
        const balance = await this.leaveBalance(request.staffId, undefined, tx);
        await tx.leaveBalance.update({
          where: { staffId_year: { staffId: request.staffId, year: balance.year } },
          data: { usedDays: { increment: request.days } },
        });
      }
      return toMockLeave(request);
    });
  }

  async rejectLeaveRequest(id: string, approverId: string): Promise<MockLeaveRequest> {
    return toMockLeave(await this.prisma.$transaction((tx) => this.review(tx, id, approverId, 'REJECTED')));
  }

  private async review(tx: Tx, id: string, approverId: string, status: LeaveStatus): Promise<LeaveRequest> {
    const { count } = await tx.leaveRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status, approverId, reviewedAt: new Date() },
    });
    const request = await tx.leaveRequest.findUnique({ where: { id } });
    if (!request) throw leaveNotFound();
    if (count === 0) {
      throw new AppException('LEAVE_REQUEST_ALREADY_REVIEWED', '이미 처리된 휴가 신청입니다.', 409);
    }
    return request;
  }

  // ── 업무일지 ───────────────────────────────────────────

  // 하루 1건(근태관리 A-3) — 같은 날 다시 쓰면 덮어쓴다. (staffId, date) unique(log/093)가 최종 방어선이고,
  // 트랜잭션 advisory lock으로 같은 직원·날짜의 upsert를 직렬화해 동시 첫 작성이 unique 위반으로 실패하지 않게 한다(D33 결정 1).
  async upsertWorkLog(staffId: string, date: string, content: string): Promise<MockWorkLog> {
    const d = dateOf(date);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`worklog:${staffId}:${day(d)}`}))`;
      const existing = await tx.workLog.findFirst({ where: { staffId, date: d }, orderBy: { createdAt: 'asc' } });
      const log = existing
        ? await tx.workLog.update({ where: { id: existing.id }, data: { content } })
        : await tx.workLog.create({ data: { staffId, date: d, content } });
      return toMockWorkLog(log);
    });
  }

  async listWorkLogs(staffId: string, date?: string): Promise<MockWorkLog[]> {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const rows = await this.prisma.workLog.findMany({
      where: { staffId, date: date ? dateOf(date) : undefined },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toMockWorkLog);
  }

  // ADR-ATT-03 — 그 날짜에 그 직원이 소속돼 있던 지점. endDate는 배타적(파견 전환 당일은 새 지점, ADR-AUTH-01).
  private async branchIdForStaffOnDate(staffId: string, date: string): Promise<string | undefined> {
    const assignments = await this.prisma.staffAssignment.findMany({
      where: { staffId },
      select: { branchId: true, startDate: true, endDate: true },
    });
    return branchOnDate(assignments, date);
  }
}

// ── 판정 규칙(mock 구현 그대로) ─────────────────────────────

function branchOnDate(assignments: AssignmentSpan[], date: string): string | undefined {
  return assignments
    .filter((a) => day(a.startDate) <= date && (!a.endDate || date < day(a.endDate)))
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0]?.branchId;
}

// 같은 직원의 휴가 중 [startDate, endDate](양끝 포함)와 하루라도 겹치는 것이 있으면 409(ADR-ATT-05).
async function assertNoOverlappingLeave(
  tx: Tx,
  staffId: string,
  startDate: Date,
  endDate: Date,
  statuses: LeaveStatus[],
  exceptId?: string,
): Promise<void> {
  const clash = await tx.leaveRequest.findFirst({
    where: {
      staffId,
      status: { in: statuses },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { startDate: true, endDate: true, status: true },
  });
  if (clash) {
    throw new AppException(
      'LEAVE_REQUEST_OVERLAP',
      `이미 ${clash.status === 'APPROVED' ? '승인된' : '신청한'} 휴가(${day(clash.startDate)}~${day(clash.endDate)})와 기간이 겹칩니다.`,
      409,
    );
  }
}

// 지점 출근 기준시각(HH:mm) 대비 10분 초과. 기준시각이 없으면 판정하지 않는다. KST 시:분으로 비교.
function isLate(checkInAt: Date, standardCheckInTime: string | null): boolean {
  if (!standardCheckInTime) return false;
  const [h, m] = standardCheckInTime.split(':').map(Number);
  const { hours, minutes } = kstHoursMinutes(checkInAt);
  return hours * 60 + minutes > h * 60 + m + 10;
}

// 파트타임은 근무일이 주 단위로 고정되지 않아 판정 자체를 하지 않는다(근태관리 A-3).
function isWorkDay(staff: { employmentType: string | null; offDays: number[] }, dateStr: string): boolean {
  if (staff.employmentType === '파트타임') return false;
  return !staff.offDays.includes(dateOf(dateStr).getUTCDay());
}

// 근태관리 A-3 — 1년 미만 11일, 1년 이상 15일에서 2년마다 1일 가산(최대 25일). 입사 연도는 날짜 문자열에서(D33 결정 4).
function annualLeaveTotalDays(hireDate: Date, asOfYear: number): number {
  const yearsOfService = asOfYear - Number(day(hireDate).slice(0, 4));
  if (yearsOfService < 1) return 11;
  return Math.min(15 + Math.floor((yearsOfService - 1) / 2), 25);
}

// 근태관리 A-6 — 종료일 포함, 주말 제외는 Phase 2.
function leaveDays(startDate: string, endDate: string): number {
  return Math.floor((dateOf(endDate).getTime() - dateOf(startDate).getTime()) / 86_400_000) + 1;
}

function monthRange(month?: string): { gte: Date; lt: Date } | undefined {
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return undefined;
  const [y, m] = month.split('-').map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

function staffNotFound() {
  return new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
}

function leaveNotFound() {
  return new AppException('LEAVE_REQUEST_NOT_FOUND', '휴가 신청을 찾을 수 없습니다.', 404);
}

function alreadyCheckedIn() {
  return new AppException('ALREADY_CHECKED_IN', '오늘 이미 체크인했습니다.', 409);
}

// ── DB 행 → 이관 전 응답 형식 ─────────────────────────────

function toMockAttendance(r: AttendanceRecord): MockAttendanceRecord {
  return {
    id: r.id,
    staffId: r.staffId,
    branchId: r.branchId,
    date: day(r.date),
    checkInAt: r.checkInAt?.toISOString(),
    checkOutAt: r.checkOutAt?.toISOString(),
    status: r.status,
    note: r.note ?? undefined,
  };
}

function toMockLeave(r: LeaveRequest): MockLeaveRequest {
  return {
    id: r.id,
    staffId: r.staffId,
    type: r.type,
    startDate: day(r.startDate),
    endDate: day(r.endDate),
    days: r.days,
    reason: r.reason ?? undefined,
    status: r.status,
    approverId: r.approverId ?? undefined,
    reviewedAt: r.reviewedAt?.toISOString(),
  };
}

function toMockBalance(b: LeaveBalance): MockLeaveBalance {
  return { staffId: b.staffId, year: b.year, totalDays: b.totalDays, usedDays: b.usedDays };
}

function toMockWorkLog(l: WorkLog): MockWorkLog {
  return { id: l.id, staffId: l.staffId, date: day(l.date), content: l.content, createdAt: l.createdAt.toISOString() };
}
