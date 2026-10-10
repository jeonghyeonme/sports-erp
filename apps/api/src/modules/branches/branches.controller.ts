import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchScopeExempt } from '../../common/decorators/scoped-resource.decorator';
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

  // 회원관리 ADR-MEM-05 — 회원 웹 가입 화면의 지점 선택용 공개 목록(로그인 전이라 GET /branches를 못 부른다, log/092).
  // 이름·지역만 내보낸다(계약상대방·기간·인원은 본사 데이터). 계약 종료 지점은 가입을 막으므로(BRANCH_TERMINATED) 뺀다.
  @Public()
  @Get('public')
  async publicList() {
    const rows = await this.prisma.branch.findMany({
      where: { contractStatus: { not: 'TERMINATED' } },
      select: { id: true, name: true, region: true },
      orderBy: [{ region: 'asc' }, { name: 'asc' }],
    });
    return ok(rows);
  }

  // D29 — 지점·계약 정보는 DB에서. D32 — 회원·직원·진행중 프로그램 건수도 전부 DB 집계다.
  @Get()
  async list(@CurrentUser() user: RequestUser) {
    const branches = await this.branchService.listVisibleTo(user);
    const counts = await this.branchService.counts(branches.map((b) => b.id));
    return ok(branches.map((b) => ({ ...BranchService.toContractView(b), ...counts.get(b.id)! })));
  }

  // 강사프로그램게시 A-5 — 지점별 진행중 프로그램 현황판
  @Get(':branchId/programs/summary')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @BranchScopeExempt('경로 파라미터가 branchId라 전역 BranchScopeGuard의 branchId 검사가 본다')
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
