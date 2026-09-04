import { Controller, Get, NotFoundException, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { MockDataService } from '../../mock-data/mock-data.service';
import { ok } from '../../common/http/api-response';

@Controller('staff')
export class StaffController {
  constructor(private readonly mockData: MockDataService) {}

  // 01문서 §7 — STAFF는 타 직원 레코드를 조회할 수 없어 이 목록 API 대상이 아니다.
  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @UseGuards(BranchScopeGuard)
  list(@Query('branchId') branchId?: string) {
    const staff = branchId
      ? this.mockData.staff.filter((s) => s.branchId === branchId)
      : this.mockData.staff;
    return ok(staff);
  }

  // STAFF 본인 레코드만 셀프서비스로 조회(02문서 §7) — 동료 직원 정보는 노출하지 않는다.
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    const staff = this.mockData.staff.find((s) => s.id === user.staffId);
    if (!staff) {
      throw new NotFoundException({ code: 'STAFF_NOT_FOUND', message: '연결된 직원 레코드가 없습니다.' });
    }
    return ok(staff);
  }
}
