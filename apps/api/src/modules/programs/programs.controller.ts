import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { MockDataService } from '../../mock-data/mock-data.service';
import { ok } from '../../common/http/api-response';

// 07문서 §7 — 회원 포함 모든 역할이 조회 가능(본인 소속 지점 기준 필터 기본 적용)
@Controller('programs')
@UseGuards(BranchScopeGuard)
export class ProgramsController {
  constructor(private readonly mockData: MockDataService) {}

  @Get()
  list(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('pricingType') pricingType?: string,
  ) {
    let programs = this.mockData.programs;
    if (branchId) programs = programs.filter((p) => p.branchId === branchId);
    if (status) programs = programs.filter((p) => p.status === status);
    if (pricingType) programs = programs.filter((p) => p.pricingType === pricingType);
    return ok(
      programs.map((p) => ({ ...p, branchName: this.mockData.findBranchById(p.branchId)?.name })),
    );
  }
}
