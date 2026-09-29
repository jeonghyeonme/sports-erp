import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { ok } from '../../common/http/api-response';
import { PrismaService } from '../../prisma/prisma.service';
import { toMockProgram } from '../programs/program.service';
import { BranchService } from './branch.service';

@Controller('branches')
export class BranchesController {
  constructor(
    private readonly branchService: BranchService,
    private readonly prisma: PrismaService,
  ) {}

  // D29 — 지점·계약 정보는 DB에서. D32 — 회원·직원·진행중 프로그램 건수도 전부 DB 집계다.
  @Get()
  async list(@CurrentUser() user: RequestUser) {
    const branches = await this.branchService.listVisibleTo(user);
    const counts = await this.branchService.counts(branches.map((b) => b.id));
    return ok(branches.map((b) => ({ ...BranchService.toContractView(b), ...counts.get(b.id)! })));
  }

  // 07문서 §5 — 지점별 진행중 프로그램 현황판
  @Get(':branchId/programs/summary')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @UseGuards(BranchScopeGuard)
  async programsSummary(@Param('branchId') branchId: string) {
    const programs = (await this.prisma.program.findMany({ where: { branchId }, orderBy: { id: 'asc' } })).map(toMockProgram);
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
