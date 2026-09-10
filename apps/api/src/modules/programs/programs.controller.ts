import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { MockDataService } from '../../mock-data/mock-data.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ok } from '../../common/http/api-response';
import { UpdateProgramStatusDto } from './dto/update-program-status.dto';

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

  // 07문서 §5 상태 전이(§3-2 표의 허용 전이만 통과, 위반 시 409) — BRANCH_ADMIN 본인 지점만(§7).
  @Patch(':id/status')
  @Roles('BRANCH_ADMIN')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProgramStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    const program = this.mockData.findProgramById(id);
    if (!program) {
      throw new AppException('PROGRAM_NOT_FOUND', '프로그램을 찾을 수 없습니다.', 404);
    }
    if (program.branchId !== user.branchId) {
      throw new AppException(
        'PROGRAM_SCOPE_VIOLATION',
        '다른 지점의 프로그램은 수정할 수 없습니다.',
        403,
      );
    }
    const updated = this.mockData.updateProgramStatus(id, dto.status);
    return ok({ ...updated, branchName: this.mockData.findBranchById(updated.branchId)?.name });
  }
}
