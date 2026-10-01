import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { AttendanceService } from './attendance.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ok } from '../../common/http/api-response';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { ConfirmAbsencesDto } from './dto/confirm-absences.dto';

// 근태관리 A-7 — BRANCH_ADMIN도 Staff 레코드를 가지므로(architecture/system-overview.md §3.1) 본인 근태/휴가/업무일지는
// STAFF와 동일하게 셀프서비스한다. "본인 지점 조회 + 휴가 승인"은 그 위에 얹히는 관리 권한이다.
@Controller()
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('attendance/check-in')
  @Roles('BRANCH_ADMIN', 'STAFF')
  async checkIn(@CurrentUser() user: RequestUser) {
    return ok(await this.attendance.checkIn(this.requireStaffId(user)));
  }

  @Post('attendance/check-out')
  @Roles('BRANCH_ADMIN', 'STAFF')
  async checkOut(@CurrentUser() user: RequestUser) {
    return ok(await this.attendance.checkOut(this.requireStaffId(user)));
  }

  // 근태관리 A-5 GET /attendance?staffId=&month= — staffId 생략 시 본인 기준(SUPER_ADMIN 제외).
  @Get('attendance')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'STAFF')
  async list(@Query('staffId') staffId: string | undefined, @Query('month') month: string | undefined, @CurrentUser() user: RequestUser) {
    const targetStaffId = staffId ?? this.requireStaffId(user);
    await this.assertStaffScope(targetStaffId, user);
    return ok(await this.attendance.listAttendance(targetStaffId, month));
  }

  // 근태관리 A-5 GET /attendance/summary?branchId=&month= — BRANCH_ADMIN은 본인 지점 고정.
  @Get('attendance/summary')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  async summary(@Query('branchId') branchId: string | undefined, @Query('month') month: string, @CurrentUser() user: RequestUser) {
    const targetBranchId = user.role === 'SUPER_ADMIN' ? branchId : user.branchId;
    if (!targetBranchId) {
      throw new AppException('BRANCH_REQUIRED', 'branchId가 필요합니다.', 400);
    }
    return ok(await this.attendance.summary(targetBranchId, month));
  }

  // ADR-ATT-02(domains/근태관리.md) — 스케줄러 없이 결근을 표현하는 미리보기(저장 안 함).
  // "이번 달 근태 현황판"에서 확정 전 잠정 결근 수를 보여주는 용도. BRANCH_ADMIN 본인 지점 고정,
  // SUPER_ADMIN은 summary와 동일하게 조회만 가능(현장 운영 비개입 원칙, 근태관리 A-7).
  @Get('attendance/absence-preview')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  async absencePreview(@Query('branchId') branchId: string | undefined, @Query('month') month: string, @CurrentUser() user: RequestUser) {
    const targetBranchId = user.role === 'SUPER_ADMIN' ? branchId : user.branchId;
    if (!targetBranchId) {
      throw new AppException('BRANCH_REQUIRED', 'branchId가 필요합니다.', 400);
    }
    return ok(await this.attendance.previewAbsences(targetBranchId, month));
  }

  // ADR-ATT-02 — 결근 확정. 되돌리기 어려운 인사 조치라 BRANCH_ADMIN만(SUPER_ADMIN도 불가,
  // ADR-AUTH-02·근태관리 A-7 "SUPER_ADMIN은 현장 운영에 직접 개입하지 않는다"와 같은 원칙).
  @Post('attendance/absence-confirm')
  @Roles('BRANCH_ADMIN')
  async confirmAbsences(@Body() dto: ConfirmAbsencesDto, @CurrentUser() user: RequestUser) {
    if (!user.branchId) {
      throw new AppException('BRANCH_REQUIRED', '소속 지점이 없는 계정입니다.', 403);
    }
    return ok(await this.attendance.confirmAbsences(user.branchId, dto.month, dto.note));
  }

  @Post('leave-requests')
  @Roles('BRANCH_ADMIN', 'STAFF')
  async createLeaveRequest(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: RequestUser) {
    const { request, warning } = await this.attendance.requestLeave(this.requireStaffId(user), dto);
    return ok(request, warning ? { warning } : undefined);
  }

  // 근태관리 A-4 "휴가 승인함" 화면이 필요로 하는 목록 조회 — A-5 API 표에 빠져 있던 엔드포인트를 채운다.
  @Get('leave-requests')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'STAFF')
  async listLeaveRequests(
    @Query('staffId') staffId: string | undefined,
    @Query('status') status: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (staffId) {
      await this.assertStaffScope(staffId, user);
      return ok(await this.attendance.listLeaveRequests({ staffId, status }));
    }
    if (user.role === 'STAFF') {
      if (!user.staffId) return ok([]);
      return ok(await this.attendance.listLeaveRequests({ staffId: user.staffId, status }));
    }
    if (user.role === 'BRANCH_ADMIN') {
      // 지점 소속 직원(현재 소속 기준)의 신청만 — branchId 없는 관리자 계정이면 빈 목록.
      if (!user.branchId) return ok([]);
      return ok(await this.attendance.listLeaveRequests({ branchId: user.branchId, status }));
    }
    return ok(await this.attendance.listLeaveRequests({ status }));
  }

  @Patch('leave-requests/:id/approve')
  @Roles('BRANCH_ADMIN')
  async approveLeaveRequest(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.assertStaffScope(await this.attendance.leaveRequestStaffId(id), user);
    return ok(await this.attendance.approveLeaveRequest(id, user.accountId));
  }

  @Patch('leave-requests/:id/reject')
  @Roles('BRANCH_ADMIN')
  async rejectLeaveRequest(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.assertStaffScope(await this.attendance.leaveRequestStaffId(id), user);
    return ok(await this.attendance.rejectLeaveRequest(id, user.accountId));
  }

  @Get('leave-balance/:staffId')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'STAFF')
  async leaveBalance(@Param('staffId') staffId: string, @CurrentUser() user: RequestUser) {
    await this.assertStaffScope(staffId, user);
    return ok(await this.attendance.leaveBalance(staffId));
  }

  @Post('work-logs')
  @Roles('BRANCH_ADMIN', 'STAFF')
  async createWorkLog(@Body() dto: CreateWorkLogDto, @CurrentUser() user: RequestUser) {
    return ok(await this.attendance.upsertWorkLog(this.requireStaffId(user), dto.date, dto.content));
  }

  // 근태관리 A-5 GET /work-logs?staffId=&date= — "관리자는 본인 지점 전 직원 업무일지 열람 가능"(근태관리 A-6).
  @Get('work-logs')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'STAFF')
  async listWorkLogs(
    @Query('staffId') staffId: string | undefined,
    @Query('date') date: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    const targetStaffId = staffId ?? this.requireStaffId(user);
    await this.assertStaffScope(targetStaffId, user);
    return ok(await this.attendance.listWorkLogs(targetStaffId, date));
  }

  // STAFF/BRANCH_ADMIN 라우트에만 붙지만, RequestUser.staffId가 optional 타입이라 방어적으로 확인한다.
  private requireStaffId(user: RequestUser): string {
    if (!user.staffId) {
      throw new AppException('STAFF_RECORD_REQUIRED', '연결된 직원 레코드가 없는 계정입니다.', 403);
    }
    return user.staffId;
  }

  // 근태관리 A-7: SUPER_ADMIN 전체 / BRANCH_ADMIN 본인 지점 / STAFF 본인만.
  private async assertStaffScope(targetStaffId: string, user: RequestUser): Promise<void> {
    if (user.role === 'SUPER_ADMIN') return;
    if (user.role === 'STAFF') {
      if (user.staffId === targetStaffId) return;
      throw new AppException('ATTENDANCE_SCOPE_VIOLATION', '본인 데이터만 조회할 수 있습니다.', 403);
    }
    const branchId = await this.attendance.staffBranchId(targetStaffId);
    if (!branchId || branchId !== user.branchId) {
      throw new AppException('ATTENDANCE_SCOPE_VIOLATION', '본인 지점 직원의 데이터만 조회할 수 있습니다.', 403);
    }
  }
}
