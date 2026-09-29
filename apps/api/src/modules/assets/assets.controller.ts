import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { AppException } from '../../common/exceptions/app.exception';
import { ok } from '../../common/http/api-response';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateAssetStatusDto } from './dto/update-asset-status.dto';
import { AssetService, AssetView } from './asset.service';

// 1-10문서 §4-5·§4-7 — SUPER_ADMIN은 전체, BRANCH_ADMIN은 본인 지점만. MEMBER·STAFF는 접근 불가.
// D35 — 원천은 DB(AssetService).
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
  ) {
    let targetBranchId = branchId;
    if (user.role === 'BRANCH_ADMIN') {
      if (branchId && branchId !== user.branchId) {
        throw new AppException('BRANCH_SCOPE_VIOLATION', '다른 지점의 데이터에는 접근할 수 없습니다.', 403);
      }
      if (!user.branchId) return ok([]);
      targetBranchId = user.branchId;
    }
    return ok(await this.assets.list({ branchId: targetBranchId, category, status, assetType }));
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
  async update(@Param('id') id: string, @Body() dto: UpdateAssetDto, @CurrentUser() user: RequestUser) {
    this.assertCanManage(await this.assets.findById(id), user);
    return ok(await this.assets.update(id, dto));
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateAssetStatusDto, @CurrentUser() user: RequestUser) {
    this.assertCanManage(await this.assets.findById(id), user);
    return ok(await this.assets.updateStatus(id, dto.status));
  }

  private assertCanManage(asset: AssetView, user: RequestUser): void {
    if (user.role === 'BRANCH_ADMIN' && asset.branchId !== user.branchId) {
      throw new AppException('ASSET_SCOPE_VIOLATION', '다른 지점의 자산은 관리할 수 없습니다.', 403);
    }
  }
}
