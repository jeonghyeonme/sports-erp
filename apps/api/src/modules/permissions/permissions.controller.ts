import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { StaffService } from '../staff/staff.service';
import { ok } from '../../common/http/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';
import { AccountPermissionCellDto, RolePermissionCellDto } from './dto/permission-cell.dto';
import { PermissionAdminService } from './permission-admin.service';

// 권한관리 A-7 권한 매트릭스 — 본사(SUPER_ADMIN)만 지점 직원의 권한(STAFF/BRANCH_ADMIN)을 제어할 수 있다.
// D60 2단계 — 세부 권한(역할 기본값·개인 예외)도 본사만 바꾼다.
@Controller('permissions')
@Roles('SUPER_ADMIN')
export class PermissionsController {
  // D30 — 계정·직원의 원천은 DB. 전환은 다음 요청부터 반영된다(JwtStrategy가 매 요청 계정을 다시 읽음, ADR-AUTH-01).
  constructor(
    private readonly staffService: StaffService,
    private readonly admin: PermissionAdminService,
  ) {}

  @Get('staff')
  async listStaff() {
    return ok(await this.staffService.listWithRole());
  }

  @Patch('staff/:staffId/role')
  async updateRole(@Param('staffId') staffId: string, @Body() dto: UpdateStaffRoleDto, @CurrentUser() user: RequestUser) {
    // D44 — 처리자를 변경 이력에 남긴다.
    return ok(await this.staffService.updateRole(staffId, dto.role, user.accountId));
  }

  // ── D60 세부 권한 ──
  @Get('catalog')
  catalog() {
    return ok(this.admin.catalog());
  }

  @Get('roles')
  async roleMatrix() {
    return ok(await this.admin.roleMatrix());
  }

  @Put('roles/:role')
  async setRoleCell(@Param('role') role: string, @Body() dto: RolePermissionCellDto, @CurrentUser() user: RequestUser) {
    return ok(await this.admin.setRoleCell(role, dto, user.accountId));
  }

  @Get('staff/:staffId/overrides')
  async staffMatrix(@Param('staffId') staffId: string) {
    return ok(await this.admin.staffMatrix(staffId));
  }

  @Put('staff/:staffId/overrides')
  async setStaffCell(@Param('staffId') staffId: string, @Body() dto: AccountPermissionCellDto, @CurrentUser() user: RequestUser) {
    return ok(await this.admin.setStaffCell(staffId, dto, user.accountId));
  }
}
