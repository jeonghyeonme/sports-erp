import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { AppException } from '../../common/exceptions/app.exception';
import { ok } from '../../common/http/api-response';
import { maskPhones } from '../../common/privacy/mask-phone';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { AssignStaffDto } from './dto/assign-staff.dto';
import { StaffService, StaffView } from './staff.service';

@Controller('staff')
@UseGuards(BranchScopeGuard)
export class StaffController {
  // D30 — 원천은 DB(StaffService). 응답 형식은 이관 전(mock 직원 + branchName)과 같다.
  constructor(private readonly staffService: StaffService) {}

  // 인사정보관리 A-5 — 퇴사자는 기본적으로 숨기고(status!=RESIGNED), status를 명시하면 그 값만 조회(인사정보관리 A-6).
  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  async list(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('position') position?: string,
  ) {
    // ADR-MEM-04 — 직원 목록도 같은 규칙으로 연락처를 마스킹한다(상세·me는 원문, 인사정보관리 STF-T03).
    return ok(maskPhones(await this.staffService.list({ branchId, status, position })));
  }

  // STAFF 본인 레코드만 셀프서비스로 조회(인사정보관리 A-7) — 동료 직원 정보는 노출하지 않는다.
  @Get('me')
  async me(@CurrentUser() user: RequestUser) {
    const staff = user.staffId ? await this.staffService.findById(user.staffId) : null;
    if (!staff) {
      throw new AppException('STAFF_NOT_FOUND', '연결된 직원 레코드가 없습니다.', 404);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { branchName, ...rest } = staff; // 이관 전 응답 형식(branchName 없음) 유지
    return ok(rest);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'STAFF')
  async detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const staff = await this.findStaffOrThrow(id);
    this.assertReadable(staff, user);
    return ok(staff);
  }

  // 신규 채용 등록 — SUPER_ADMIN 전용(인사정보관리 §0, A-5·A-7). Staff는 Account와 1:1이라 로그인 계정도 같이 만든다.
  @Post()
  @Roles('SUPER_ADMIN')
  async hire(@Body() dto: CreateStaffDto, @CurrentUser() user: RequestUser) {
    return ok(await this.staffService.hire(dto, user.accountId));
  }

  @Patch(':id')
  @Roles('BRANCH_ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateStaffDto, @CurrentUser() user: RequestUser) {
    const staff = await this.findStaffOrThrow(id);
    this.assertCurrentBranch(staff, user);
    return ok(await this.staffService.update(id, dto));
  }

  @Patch(':id/resign')
  @Roles('BRANCH_ADMIN')
  async resign(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const staff = await this.findStaffOrThrow(id);
    this.assertCurrentBranch(staff, user);
    return ok(await this.staffService.resign(id, user.accountId));
  }

  // 파견 발령(재배치) — SUPER_ADMIN 전용(인사정보관리 A-5·A-7, 본사의 인력 배치 결정). 지점 범위 제한 없음.
  @Post(':id/assignments')
  @Roles('SUPER_ADMIN')
  async assign(@Param('id') id: string, @Body() dto: AssignStaffDto, @CurrentUser() user: RequestUser) {
    await this.findStaffOrThrow(id);
    // ADR-STF-04 — 파견으로 담당이 해제된 옛 지점 회원을 함께 돌려준다(본사가 즉시 인지).
    return ok(await this.staffService.assign(id, dto.branchId, user.accountId, dto.note));
  }

  // 파견 이력 조회 — "해당 지점 권한자 또는 SUPER_ADMIN"(인사정보관리 A-5). 현재 파견 지점 기준으로 판단.
  @Get(':id/assignments')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  async assignmentHistory(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const staff = await this.findStaffOrThrow(id);
    this.assertCurrentBranch(staff, user);
    return ok(await this.staffService.history(id));
  }

  private async findStaffOrThrow(id: string): Promise<StaffView> {
    const staff = await this.staffService.findById(id);
    if (!staff) {
      throw new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
    }
    return staff;
  }

  // 조회 범위(인사정보관리 A-7): SUPER_ADMIN 전체 / BRANCH_ADMIN 현재 파견 지점만 / STAFF 본인만.
  private assertReadable(staff: StaffView, user: RequestUser): void {
    if (user.role === 'SUPER_ADMIN') return;
    if (user.role === 'STAFF') {
      if (user.staffId === staff.id) return;
    } else if (user.branchId === staff.branchId) {
      return;
    }
    throw new AppException('STAFF_SCOPE_VIOLATION', '이 직원 정보에 접근할 권한이 없습니다.', 403);
  }

  // 쓰기(수정/퇴사)·이력 조회는 BRANCH_ADMIN 현재 파견 지점 한정 — SUPER_ADMIN 전용 라우트(hire/assign)는 이 검사를 타지 않는다.
  private assertCurrentBranch(staff: StaffView, user: RequestUser): void {
    if (user.role === 'SUPER_ADMIN') return;
    if (user.branchId !== staff.branchId) {
      throw new AppException('STAFF_SCOPE_VIOLATION', '이 직원 정보에 접근할 권한이 없습니다.', 403);
    }
  }

}
