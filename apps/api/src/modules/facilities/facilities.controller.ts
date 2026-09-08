import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { MockDataService } from '../../mock-data/mock-data.service';
import { ok } from '../../common/http/api-response';

// 08문서 §6 — 회원은 조회만, BRANCH_ADMIN은 본인 지점만 관리
@Controller('facilities')
@UseGuards(BranchScopeGuard)
export class FacilitiesController {
  constructor(private readonly mockData: MockDataService) {}

  @Get()
  list(@Query('branchId') branchId?: string) {
    const facilities = branchId
      ? this.mockData.facilities.filter((f) => f.branchId === branchId)
      : this.mockData.facilities;
    return ok(
      facilities.map((f) => ({ ...f, branchName: this.mockData.findBranchById(f.branchId)?.name })),
    );
  }
}
