import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { AppException } from '../../common/exceptions/app.exception';
import { ScopedResource } from '../../common/decorators/scoped-resource.decorator';
import { ok } from '../../common/http/api-response';
import { pageMeta, parsePage } from '../../common/http/pagination';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateAssetStatusDto } from './dto/update-asset-status.dto';
import { AssetService } from './asset.service';

// 자원문서관리 A-5·A-7 — SUPER_ADMIN은 전체, BRANCH_ADMIN은 본인 지점만. MEMBER·STAFF는 접근 불가.
// D35 — 원천은 DB(AssetService). D46 — 지점 범위(branchId·:id 소유)는 전역 BranchScopeGuard가 본다.
@Controller('assets')
@Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
export class AssetsController {
  constructor(private readonly assets: AssetService) {}

  @Get()
  async list(
    @CurrentUser() user: RequestUser,
    @Query('branchId') branchId?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('assetType') assetType?: string,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
  ) {
    const page = parsePage(pageQuery, limitQuery);
    // BRANCH_ADMIN이면 가드가 branchId를 본인 지점으로 고정해 넘긴다(다른 지점 지정은 403).
    if (user.role === 'BRANCH_ADMIN' && !branchId) return ok([], pageMeta(page, 0));
    // D43 — offset 페이지네이션(page·limit, 상한 100).
    const { items, total } = await this.assets.list({ branchId, category, status, assetType }, page);
    return ok(items, pageMeta(page, total));
  }

  @Post()
  async create(@Body() dto: CreateAssetDto, @CurrentUser() user: RequestUser) {
    const branchId = user.role === 'BRANCH_ADMIN' ? user.branchId : dto.branchId;
    if (!branchId) {
      throw new AppException('BRANCH_REQUIRED', '자산을 등록할 지점을 지정해야 합니다.', 400);
    }
    return ok(await this.assets.create({ ...dto, branchId }));
  }

  @Patch(':id')
  @ScopedResource('asset')
  async update(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return ok(await this.assets.update(id, dto));
  }

  @Patch(':id/status')
  @ScopedResource('asset')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateAssetStatusDto) {
    return ok(await this.assets.updateStatus(id, dto.status));
  }
}
