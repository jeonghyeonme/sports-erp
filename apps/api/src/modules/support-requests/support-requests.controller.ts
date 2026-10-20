import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedResource } from '../../common/decorators/scoped-resource.decorator';
import { AppException } from '../../common/exceptions/app.exception';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ok } from '../../common/http/api-response';
import { pageMeta, parsePage } from '../../common/http/pagination';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { UpdateSupportStatusDto } from './dto/update-support-status.dto';
import { SupportRequestService } from './support-request.service';
import { Permission } from '../../common/permissions/permission.decorator';

// D56 — 업무지원 요청(현장→본사). 요청은 지점 관리자, 처리는 본사. 지점 범위는 전역 BranchScopeGuard(D46):
// branchId 쿼리는 지점 관리자에게 본인 지점으로 고정되고, :id는 @ScopedResource('supportRequest')가 본다.
@Controller('support-requests')
export class SupportRequestsController {
  constructor(private readonly requests: SupportRequestService) {}

  @Post()
  @Roles('BRANCH_ADMIN')
  @Permission('support', 'CREATE')
  async create(@Body() dto: CreateSupportRequestDto, @CurrentUser() user: RequestUser) {
    if (!user.branchId) throw new AppException('BRANCH_REQUIRED', '소속 지점이 없는 계정입니다.', 403);
    return ok(await this.requests.create({ accountId: user.accountId, branchId: user.branchId }, dto));
  }

  @Get()
  @Roles('BRANCH_ADMIN', 'SUPER_ADMIN')
  @Permission('support', 'READ')
  async list(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
  ) {
    const page = parsePage(pageQuery, limitQuery);
    const { items, total } = await this.requests.list({ branchId, status }, page);
    return ok(items, pageMeta(page, total));
  }

  @Get(':id')
  @Roles('BRANCH_ADMIN', 'SUPER_ADMIN')
  @ScopedResource('supportRequest')
  @Permission('support', 'READ')
  async detail(@Param('id') id: string) {
    return ok(await this.requests.findById(id));
  }

  // 처리(처리중·완료·반려)는 본사만 — 지점은 자기 요청을 스스로 닫지 않는다.
  @Patch(':id/status')
  @Roles('SUPER_ADMIN')
  @ScopedResource('supportRequest')
  async changeStatus(@Param('id') id: string, @Body() dto: UpdateSupportStatusDto, @CurrentUser() user: RequestUser) {
    return ok(await this.requests.changeStatus(id, user.accountId, dto));
  }
}
