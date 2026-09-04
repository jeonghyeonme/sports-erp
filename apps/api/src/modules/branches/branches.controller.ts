import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { MockDataService } from '../../mock-data/mock-data.service';
import { ok } from '../../common/http/api-response';

@Controller('branches')
export class BranchesController {
  constructor(private readonly mockData: MockDataService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    const branches =
      user.role === 'SUPER_ADMIN'
        ? this.mockData.branches
        : this.mockData.branches.filter((b) => b.id === user.branchId);
    return ok(branches.map((b) => this.mockData.branchSummary(b.id)));
  }

  // 07문서 §5 — 지점별 진행중 프로그램 현황판
  @Get(':branchId/programs/summary')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @UseGuards(BranchScopeGuard)
  programsSummary(@Param('branchId') branchId: string) {
    const programs = this.mockData.programs.filter((p) => p.branchId === branchId);
    const byStatus = {
      PREPARING: programs.filter((p) => p.status === 'PREPARING').length,
      RUNNING: programs.filter((p) => p.status === 'RUNNING').length,
      PAUSED: programs.filter((p) => p.status === 'PAUSED').length,
      ENDED: programs.filter((p) => p.status === 'ENDED').length,
    };
    return ok({
      branchId,
      byStatus,
      runningPrograms: programs.filter((p) => p.status === 'RUNNING'),
    });
  }
}
