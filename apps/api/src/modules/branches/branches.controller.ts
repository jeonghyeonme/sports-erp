import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchScopeExempt, ScopedResource } from '../../common/decorators/scoped-resource.decorator';
import { ok } from '../../common/http/api-response';
import { PrismaService } from '../../prisma/prisma.service';
import { toMockProgram } from '../programs/program.service';
import { BranchService } from './branch.service';
import { ChangeContractStatusDto } from './dto/change-contract-status.dto';
import { RenewContractDto } from './dto/renew-contract.dto';
import { CorrectContractDto } from './dto/correct-contract.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { SetContractFileDto } from './dto/contract-file.dto';
import { RequestUploadDto } from '../posts/dto/attachment.dto';
import { ContractFileService } from './contract-file.service';
import { branchPerformance } from './branch-performance';
import { Permission } from '../../common/permissions/permission.decorator';

@Controller('branches')
export class BranchesController {
  constructor(
    private readonly branchService: BranchService,
    private readonly contractFiles: ContractFileService,
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
  @Permission('branch', 'READ')
  async list(@CurrentUser() user: RequestUser) {
    const branches = await this.branchService.listVisibleTo(user);
    const counts = await this.branchService.counts(branches.map((b) => b.id));
    return ok(branches.map((b) => ({ ...BranchService.toContractView(b), ...counts.get(b.id)! })));
  }

  // D68 결정 5 — 신규 지점 등록(새 위탁계약). 본사 전용, 지점 코드 중복은 409.
  @Post()
  @Roles('SUPER_ADMIN')
  async create(@Body() dto: CreateBranchDto, @CurrentUser() user: RequestUser) {
    const branch = await this.branchService.createBranch(dto, user.accountId);
    return ok({ ...branch, memberCount: 0, staffCount: 0, runningProgramCount: 0 });
  }

  // ADR-STF-07 — 계약 상태 변경은 본사 전용. TERMINATED 전이 시 그 지점의 진행 중 파견을 같은 트랜잭션에서 종료한다.
  @Patch(':branchId/contract-status')
  @Roles('SUPER_ADMIN')
  async changeContractStatus(
    @Param('branchId') branchId: string,
    @Body() dto: ChangeContractStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return ok(await this.branchService.changeContractStatus(branchId, dto.status, user.accountId));
  }

  // D69 — 계약 파일 업로드 URL(본사 전용). 브라우저가 저장소에 먼저 올리고, 갱신·지점 등록·파일 올리기에 그 경로를 싣는다.
  @Post('contract-files/upload-url')
  @Roles('SUPER_ADMIN')
  async requestContractUpload(@Body() dto: RequestUploadDto) {
    return ok(await this.contractFiles.requestUpload(dto));
  }

  // D69 결정 3 — 계약 갱신(본사 전용) = 새 회차. 새 계약서·상대방·기간, 상태는 정상으로. 종료 지점은 409.
  @Post(':branchId/contract/renewals')
  @Roles('SUPER_ADMIN')
  async renewContract(
    @Param('branchId') branchId: string,
    @Body() dto: RenewContractDto,
    @CurrentUser() user: RequestUser,
  ) {
    return ok(await this.branchService.renewContract(branchId, dto, user.accountId));
  }

  // D68 결정 2·D69 결정 4 — 계약 정보 정정(본사 전용). 진행 중인 회차의 오타 수정이라 상태는 그대로다.
  @Patch(':branchId/contract')
  @Roles('SUPER_ADMIN')
  async correctContract(
    @Param('branchId') branchId: string,
    @Body() dto: CorrectContractDto,
    @CurrentUser() user: RequestUser,
  ) {
    return ok(await this.branchService.correctContract(branchId, dto, user.accountId));
  }

  // D69 결정 2 — 계약 회차 목록(최근 회차부터, 파일 포함). 지점 관리자는 자기 지점만 열람(전역 가드).
  @Get(':branchId/contract/rounds')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @BranchScopeExempt('경로 파라미터가 branchId라 전역 BranchScopeGuard의 branchId 검사가 본다')
  @Permission('branch', 'READ')
  async contractRounds(@Param('branchId') branchId: string) {
    return ok(await this.contractFiles.listRounds(branchId));
  }

  // D69 결정 4·5 — 진행 중 회차에 계약서 올리기·교체, 종료 확정 전 해지 합의서 올리기(본사 전용). 종료 지점은 409.
  @Post(':branchId/contract/files')
  @Roles('SUPER_ADMIN')
  async setContractFile(
    @Param('branchId') branchId: string,
    @Body() dto: SetContractFileDto,
    @CurrentUser() user: RequestUser,
  ) {
    return ok(await this.branchService.setContractFile(branchId, dto, user.accountId));
  }

  // D69 결정 6·8 — 계약 파일 열람(60초 URL). 본사와 자기 지점 관리자, 열 때마다 열람 기록이 남는다.
  @Get(':branchId/contract/files/:fileId/download')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @ScopedResource('contractFile', { param: 'fileId' })
  @Permission('branch', 'READ')
  async downloadContractFile(
    @Param('branchId') branchId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return ok(await this.contractFiles.downloadUrl(branchId, fileId, user));
  }

  // log/125 F3 — 지점 운영 실적(최근 3개월, 월별). 본사가 계약 갱신 판단에 쓴다. 지점 관리자는 자기 지점만(전역 가드).
  @Get(':branchId/performance')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @BranchScopeExempt('경로 파라미터가 branchId라 전역 BranchScopeGuard의 branchId 검사가 본다')
  @Permission('branch', 'READ')
  async performance(@Param('branchId') branchId: string) {
    return ok(await branchPerformance(this.prisma, branchId));
  }

  // 강사프로그램게시 A-5 — 지점별 진행중 프로그램 현황판
  @Get(':branchId/programs/summary')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @BranchScopeExempt('경로 파라미터가 branchId라 전역 BranchScopeGuard의 branchId 검사가 본다')
  @Permission('branch', 'READ')
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
