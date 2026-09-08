import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { MockDataService } from '../../mock-data/mock-data.service';
import { ok } from '../../common/http/api-response';

// 05문서 §7 — STAFF는 회원 관리 API 접근 불가(403), SUPER_ADMIN/BRANCH_ADMIN만 조회
@Controller('members')
@Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
@UseGuards(BranchScopeGuard)
export class MembersController {
  constructor(private readonly mockData: MockDataService) {}

  @Get()
  list(@Query('branchId') branchId?: string) {
    const members = branchId
      ? this.mockData.members.filter((m) => m.branchId === branchId)
      : this.mockData.members;
    return ok(
      members.map((m) => ({
        ...m,
        branchName: this.mockData.findBranchById(m.branchId)?.name,
        assignedStaffName: m.assignedStaffId
          ? this.mockData.staff.find((s) => s.id === m.assignedStaffId)?.name
          : undefined,
      })),
    );
  }
}
