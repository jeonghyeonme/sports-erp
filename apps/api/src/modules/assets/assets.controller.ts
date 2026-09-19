import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { MockDataService } from '../../mock-data/mock-data.service';
import { AppException } from '../../common/exceptions/app.exception';
import { MockAsset } from '../../mock-data/mock-data.types';
import { ok } from '../../common/http/api-response';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateAssetStatusDto } from './dto/update-asset-status.dto';

// 1-10문서 §4-5·§4-7 — SUPER_ADMIN은 전체, BRANCH_ADMIN은 본인 지점만. MEMBER·STAFF는 접근 불가.
@Controller('assets')
@Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
export class AssetsController {
  constructor(private readonly mockData: MockDataService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query('branchId') branchId?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('assetType') assetType?: string,
  ) {
    let assets = this.mockData.assets;
    if (user.role === 'BRANCH_ADMIN') {
      if (branchId && branchId !== user.branchId) {
        throw new AppException('BRANCH_SCOPE_VIOLATION', '다른 지점의 데이터에는 접근할 수 없습니다.', 403);
      }
      assets = assets.filter((a) => a.branchId === user.branchId);
    } else if (branchId) {
      assets = assets.filter((a) => a.branchId === branchId);
    }
    if (category) assets = assets.filter((a) => a.category === category);
    if (status) assets = assets.filter((a) => a.status === status);
    if (assetType) assets = assets.filter((a) => a.assetType === assetType);
    return ok(assets.map((a) => this.toListItem(a)));
  }

  @Post()
  create(@Body() dto: CreateAssetDto, @CurrentUser() user: RequestUser) {
    const branchId = user.role === 'BRANCH_ADMIN' ? user.branchId : dto.branchId;
    if (!branchId) {
      throw new AppException('BRANCH_REQUIRED', '자산을 등록할 지점을 지정해야 합니다.', 400);
    }
    return ok(this.toListItem(this.mockData.createAsset({ ...dto, branchId })));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAssetDto, @CurrentUser() user: RequestUser) {
    this.assertCanManage(this.findAssetOrThrow(id), user);
    return ok(this.toListItem(this.mockData.updateAsset(id, dto)));
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateAssetStatusDto, @CurrentUser() user: RequestUser) {
    this.assertCanManage(this.findAssetOrThrow(id), user);
    return ok(this.toListItem(this.mockData.updateAssetStatus(id, dto.status)));
  }

  private toListItem(asset: MockAsset) {
    return { ...asset, branchName: this.mockData.findBranchById(asset.branchId)?.name };
  }

  private findAssetOrThrow(id: string): MockAsset {
    const asset = this.mockData.findAssetById(id);
    if (!asset) {
      throw new AppException('ASSET_NOT_FOUND', '자산을 찾을 수 없습니다.', 404);
    }
    return asset;
  }

  private assertCanManage(asset: MockAsset, user: RequestUser): void {
    if (user.role === 'BRANCH_ADMIN' && asset.branchId !== user.branchId) {
      throw new AppException('ASSET_SCOPE_VIOLATION', '다른 지점의 자산은 관리할 수 없습니다.', 403);
    }
  }
}
