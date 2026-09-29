import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { StaffService } from '../staff/staff.service';
import { ok } from '../../common/http/api-response';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';

// 01문서 §7 권한 매트릭스 — 본사(SUPER_ADMIN)만 지점 직원의 권한(STAFF/BRANCH_ADMIN)을 제어할 수 있다.
@Controller('permissions')
@Roles('SUPER_ADMIN')
export class PermissionsController {
  // D30 — 계정·직원의 원천은 DB. 전환은 다음 요청부터 반영된다(JwtStrategy가 매 요청 계정을 다시 읽음, ADR-AUTH-01).
  constructor(private readonly staffService: StaffService) {}

  @Get('staff')
  async listStaff() {
    return ok(await this.staffService.listWithRole());
  }

  @Patch('staff/:staffId/role')
  async updateRole(@Param('staffId') staffId: string, @Body() dto: UpdateStaffRoleDto) {
    return ok(await this.staffService.updateRole(staffId, dto.role));
  }
}
