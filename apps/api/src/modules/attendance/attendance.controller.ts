import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { MockDataService } from '../../mock-data/mock-data.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ok } from '../../common/http/api-response';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { ConfirmAbsencesDto } from './dto/confirm-absences.dto';

// 03문서 §7 — BRANCH_ADMIN도 Staff 레코드를 가지므로(01문서 §3.1) 본인 근태/휴가/업무일지는
// STAFF와 동일하게 셀프서비스한다. "본인 지점 조회 + 휴가 승인"은 그 위에 얹히는 관리 권한이다.
@Controller()
export class AttendanceController {
  constructor(private readonly mockData: MockDataService) {}

  @Post('attendance/check-in')
  @Roles('BRANCH_ADMIN', 'STAFF')
  checkIn(@CurrentUser() user: RequestUser) {
    return ok(this.mockData.checkIn(this.requireStaffId(user)));
  }

  @Post('attendance/check-out')
  @Roles('BRANCH_ADMIN', 'STAFF')
  checkOut(@CurrentUser() user: RequestUser) {
    return ok(this.mockData.checkOut(this.requireStaffId(user)));
  }

  // 03문서 §5 GET /attendance?staffId=&month= — staffId 생략 시 본인 기준(SUPER_ADMIN 제외).
  @Get('attendance')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'STAFF')
  list(@Query('staffId') staffId: string | undefined, @Query('month') month: string | undefined, @CurrentUser() user: RequestUser) {
    const targetStaffId = staffId ?? this.requireStaffId(user);
    this.assertStaffScope(targetStaffId, user);
    let records = this.mockData.attendanceRecords.filter((r) => r.staffId === targetStaffId);
    if (month) records = records.filter((r) => r.date.startsWith(month));
    return ok(records);
  }

  // 03문서 §5 GET /attendance/summary?branchId=&month= — BRANCH_ADMIN은 본인 지점 고정.
  @Get('attendance/summary')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  summary(@Query('branchId') branchId: string | undefined, @Query('month') month: string, @CurrentUser() user: RequestUser) {
    const targetBranchId = user.role === 'SUPER_ADMIN' ? branchId : user.branchId;
    if (!targetBranchId) {
      throw new AppException('BRANCH_REQUIRED', 'branchId가 필요합니다.', 400);
    }
    return ok(this.mockData.attendanceSummary(targetBranchId, month));
  }

  // ADR-ATT-02(domains/근태관리.md) — 스케줄러 없이 결근을 표현하는 미리보기(저장 안 함).
  // "이번 달 근태 현황판"에서 확정 전 잠정 결근 수를 보여주는 용도. BRANCH_ADMIN 본인 지점 고정,
  // SUPER_ADMIN은 summary와 동일하게 조회만 가능(현장 운영 비개입 원칙, 03문서 §7).
  @Get('attendance/absence-preview')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  absencePreview(@Query('branchId') branchId: string | undefined, @Query('month') month: string, @CurrentUser() user: RequestUser) {
    const targetBranchId = user.role === 'SUPER_ADMIN' ? branchId : user.branchId;
    if (!targetBranchId) {
      throw new AppException('BRANCH_REQUIRED', 'branchId가 필요합니다.', 400);
    }
    return ok(this.mockData.previewAbsences(targetBranchId, month));
  }

  // ADR-ATT-02 — 결근 확정. 되돌리기 어려운 인사 조치라 BRANCH_ADMIN만(SUPER_ADMIN도 불가,
  // ADR-AUTH-02·03문서 §7 "SUPER_ADMIN은 현장 운영에 직접 개입하지 않는다"와 같은 원칙).
  @Post('attendance/absence-confirm')
  @Roles('BRANCH_ADMIN')
  confirmAbsences(@Body() dto: ConfirmAbsencesDto, @CurrentUser() user: RequestUser) {
    if (!user.branchId) {
      throw new AppException('BRANCH_REQUIRED', '소속 지점이 없는 계정입니다.', 403);
    }
    return ok(this.mockData.confirmAbsences(user.branchId, dto.month, dto.note));
  }

  @Post('leave-requests')
  @Roles('BRANCH_ADMIN', 'STAFF')
  createLeaveRequest(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: RequestUser) {
    const { request, warning } = this.mockData.requestLeave(this.requireStaffId(user), dto);
    return ok(request, warning ? { warning } : undefined);
  }

  // 03문서 §4 "휴가 승인함" 화면이 필요로 하는 목록 조회 — §5 API 표에 빠져 있던 엔드포인트를 채운다.
  @Get('leave-requests')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'STAFF')
  listLeaveRequests(
    @Query('staffId') staffId: string | undefined,
    @Query('status') status: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    let requests = this.mockData.leaveRequests;
    if (staffId) {
      this.assertStaffScope(staffId, user);
      requests = requests.filter((r) => r.staffId === staffId);
    } else if (user.role === 'STAFF') {
      requests = requests.filter((r) => r.staffId === user.staffId);
    } else if (user.role === 'BRANCH_ADMIN') {
      const branchStaffIds = new Set(
        this.mockData.staff.filter((s) => s.branchId === user.branchId).map((s) => s.id),
      );
      requests = requests.filter((r) => branchStaffIds.has(r.staffId));
    }
    if (status) requests = requests.filter((r) => r.status === status);
    return ok(requests);
  }

  @Patch('leave-requests/:id/approve')
  @Roles('BRANCH_ADMIN')
  approveLeaveRequest(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    this.assertStaffScope(this.findLeaveRequestStaffId(id), user);
    return ok(this.mockData.approveLeaveRequest(id, user.accountId));
  }

  @Patch('leave-requests/:id/reject')
  @Roles('BRANCH_ADMIN')
  rejectLeaveRequest(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    this.assertStaffScope(this.findLeaveRequestStaffId(id), user);
    return ok(this.mockData.rejectLeaveRequest(id, user.accountId));
  }

  @Get('leave-balance/:staffId')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'STAFF')
  leaveBalance(@Param('staffId') staffId: string, @CurrentUser() user: RequestUser) {
    this.assertStaffScope(staffId, user);
    return ok(this.mockData.leaveBalance(staffId));
  }

  @Post('work-logs')
  @Roles('BRANCH_ADMIN', 'STAFF')
  createWorkLog(@Body() dto: CreateWorkLogDto, @CurrentUser() user: RequestUser) {
    return ok(this.mockData.upsertWorkLog(this.requireStaffId(user), dto.date, dto.content));
  }

  // 03문서 §5 GET /work-logs?staffId=&date= — "관리자는 본인 지점 전 직원 업무일지 열람 가능"(§6).
  @Get('work-logs')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'STAFF')
  listWorkLogs(
    @Query('staffId') staffId: string | undefined,
    @Query('date') date: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    const targetStaffId = staffId ?? this.requireStaffId(user);
    this.assertStaffScope(targetStaffId, user);
    let logs = this.mockData.workLogs.filter((l) => l.staffId === targetStaffId);
    if (date) logs = logs.filter((l) => l.date === date);
    return ok(logs);
  }

  // STAFF/BRANCH_ADMIN 라우트에만 붙지만, RequestUser.staffId가 optional 타입이라 방어적으로 확인한다.
  private requireStaffId(user: RequestUser): string {
    if (!user.staffId) {
      throw new AppException('STAFF_RECORD_REQUIRED', '연결된 직원 레코드가 없는 계정입니다.', 403);
    }
    return user.staffId;
  }

  // 03문서 §7: SUPER_ADMIN 전체 / BRANCH_ADMIN 본인 지점 / STAFF 본인만.
  private assertStaffScope(targetStaffId: string, user: RequestUser): void {
    if (user.role === 'SUPER_ADMIN') return;
    if (user.role === 'STAFF') {
      if (user.staffId === targetStaffId) return;
      throw new AppException('ATTENDANCE_SCOPE_VIOLATION', '본인 데이터만 조회할 수 있습니다.', 403);
    }
    const staff = this.mockData.findStaffById(targetStaffId);
    if (!staff || staff.branchId !== user.branchId) {
      throw new AppException('ATTENDANCE_SCOPE_VIOLATION', '본인 지점 직원의 데이터만 조회할 수 있습니다.', 403);
    }
  }

  private findLeaveRequestStaffId(id: string): string {
    const request = this.mockData.leaveRequests.find((r) => r.id === id);
    if (!request) {
      throw new AppException('LEAVE_REQUEST_NOT_FOUND', '휴가 신청을 찾을 수 없습니다.', 404);
    }
    return request.staffId;
  }
}
