import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { MockDataService } from '../../mock-data/mock-data.service';
import { AppException } from '../../common/exceptions/app.exception';
import { MockStaff } from '../../mock-data/mock-data.types';
import { ok } from '../../common/http/api-response';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { AssignStaffDto } from './dto/assign-staff.dto';

@Controller('staff')
@UseGuards(BranchScopeGuard)
export class StaffController {
  constructor(private readonly mockData: MockDataService) {}

  // 02문서 §5 — 퇴사자는 기본적으로 숨기고(status!=RESIGNED), status를 명시하면 그 값만 조회(§6).
  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  list(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('position') position?: string,
  ) {
    let staff = branchId
      ? this.mockData.staff.filter((s) => s.branchId === branchId)
      : this.mockData.staff;
    staff = status ? staff.filter((s) => s.status === status) : staff.filter((s) => s.status !== 'RESIGNED');
    if (position) staff = staff.filter((s) => s.position === position);
    return ok(staff.map((s) => this.toListItem(s)));
  }

  // STAFF 본인 레코드만 셀프서비스로 조회(02문서 §7) — 동료 직원 정보는 노출하지 않는다.
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    const staff = user.staffId ? this.mockData.findStaffById(user.staffId) : undefined;
    if (!staff) {
      throw new AppException('STAFF_NOT_FOUND', '연결된 직원 레코드가 없습니다.', 404);
    }
    return ok(staff);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'STAFF')
  detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const staff = this.findStaffOrThrow(id);
    this.assertReadable(staff, user);
    return ok(this.toListItem(staff));
  }

  // 신규 채용 등록 — SUPER_ADMIN 전용(§1, §5·§7). Staff는 Account와 1:1이라 로그인 계정도 같이 만든다.
  @Post()
  @Roles('SUPER_ADMIN')
  hire(@Body() dto: CreateStaffDto, @CurrentUser() user: RequestUser) {
    const staff = this.mockData.hireStaff(dto, user.accountId);
    return ok(this.toListItem(staff));
  }

  @Patch(':id')
  @Roles('BRANCH_ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto, @CurrentUser() user: RequestUser) {
    const staff = this.findStaffOrThrow(id);
    this.assertCurrentBranch(staff, user);
    const updated = this.mockData.updateStaff(id, dto);
    return ok(this.toListItem(updated));
  }

  @Patch(':id/resign')
  @Roles('BRANCH_ADMIN')
  resign(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const staff = this.findStaffOrThrow(id);
    this.assertCurrentBranch(staff, user);
    const updated = this.mockData.resignStaff(id);
    return ok(this.toListItem(updated));
  }

  // 파견 발령(재배치) — SUPER_ADMIN 전용(§5·§7, 본사의 인력 배치 결정). 지점 범위 제한 없음.
  @Post(':id/assignments')
  @Roles('SUPER_ADMIN')
  assign(@Param('id') id: string, @Body() dto: AssignStaffDto, @CurrentUser() user: RequestUser) {
    this.findStaffOrThrow(id);
    const updated = this.mockData.assignStaff(id, dto.branchId, user.accountId, dto.note);
    return ok(this.toListItem(updated));
  }

  // 파견 이력 조회 — "해당 지점 권한자 또는 SUPER_ADMIN"(§5). 현재 파견 지점 기준으로 판단.
  @Get(':id/assignments')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  assignmentHistory(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const staff = this.findStaffOrThrow(id);
    this.assertCurrentBranch(staff, user);
    return ok(this.mockData.staffAssignmentHistory(id));
  }

  private findStaffOrThrow(id: string): MockStaff {
    const staff = this.mockData.findStaffById(id);
    if (!staff) {
      throw new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
    }
    return staff;
  }

  // 조회 범위(§7): SUPER_ADMIN 전체 / BRANCH_ADMIN 현재 파견 지점만 / STAFF 본인만.
  private assertReadable(staff: MockStaff, user: RequestUser): void {
    if (user.role === 'SUPER_ADMIN') return;
    if (user.role === 'STAFF') {
      if (user.staffId === staff.id) return;
    } else if (user.branchId === staff.branchId) {
      return;
    }
    throw new AppException('STAFF_SCOPE_VIOLATION', '이 직원 정보에 접근할 권한이 없습니다.', 403);
  }

  // 쓰기(수정/퇴사)·이력 조회는 BRANCH_ADMIN 현재 파견 지점 한정 — SUPER_ADMIN 전용 라우트(hire/assign)는 이 검사를 타지 않는다.
  private assertCurrentBranch(staff: MockStaff, user: RequestUser): void {
    if (user.role === 'SUPER_ADMIN') return;
    if (user.branchId !== staff.branchId) {
      throw new AppException('STAFF_SCOPE_VIOLATION', '이 직원 정보에 접근할 권한이 없습니다.', 403);
    }
  }

  private toListItem(staff: MockStaff) {
    return { ...staff, branchName: this.mockData.findBranchById(staff.branchId)?.name };
  }
}
