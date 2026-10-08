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
import {
  MockAttendanceRecord,
  MockLeaveBalance,
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
    const request = await this.prisma.leaveRequest.create({
      data: {
        staffId,
        type: input.type,
        startDate: dateOf(input.startDate),
        endDate: dateOf(input.endDate),
        days,
        reason: input.reason,
      },
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

  async leaveRequestStaffId(id: string): Promise<string> {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id }, select: { staffId: true } });
    if (!request) throw leaveNotFound();
    return request.staffId;
  }

  // ADR-ATT-01 — 승인 시점에만 차감, ANNUAL만 잔여에 반영. "PENDING일 때만" 바꾸는 조건부 갱신과
  // 잔여 증가를 한 트랜잭션으로 묶어, 동시 승인이 와도 한 번만 차감된다(data-integrity §6).
  async approveLeaveRequest(id: string, approverId: string): Promise<MockLeaveRequest> {
    return this.prisma.$transaction(async (tx) => {
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

  // 하루 1건(근태관리 A-3) — 같은 날 다시 쓰면 덮어쓴다. WorkLog에는 (staffId, date) unique가 없어서
  // 트랜잭션 advisory lock으로 같은 직원·날짜의 upsert를 직렬화한다(D33 결정 1 — unique 추가는 스키마 변경이라 후속).
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

  // ── 권한 검사용 ────────────────────────────────────────

  async staffBranchId(staffId: string): Promise<string | undefined> {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId }, select: { branchId: true } });
    return staff?.branchId;
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
