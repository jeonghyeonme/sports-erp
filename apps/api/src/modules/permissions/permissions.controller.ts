import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { MockDataService } from '../../mock-data/mock-data.service';
import { ok } from '../../common/http/api-response';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';

// 01문서 §7 권한 매트릭스 — 본사(SUPER_ADMIN)만 지점 직원의 권한(STAFF/BRANCH_ADMIN)을 제어할 수 있다.
@Controller('permissions')
@Roles('SUPER_ADMIN')
export class PermissionsController {
  constructor(private readonly mockData: MockDataService) {}

  @Get('staff')
  listStaff() {
    return ok(this.mockData.staffWithRole());
  }

  @Patch('staff/:staffId/role')
  updateRole(@Param('staffId') staffId: string, @Body() dto: UpdateStaffRoleDto) {
    return ok(this.mockData.updateStaffRole(staffId, dto.role));
  }
}
