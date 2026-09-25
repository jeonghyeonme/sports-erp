import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { MockDataService } from '../../mock-data/mock-data.service';
import { AppException } from '../../common/exceptions/app.exception';
import { MockFacility } from '../../mock-data/mock-data.types';
import { ok } from '../../common/http/api-response';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import { ManualCongestionDto } from './dto/manual-congestion.dto';

// 08문서 §8 — 회원 포함 모든 역할이 조회 가능, 등록/수정/수동 보정은 BRANCH_ADMIN 본인 지점만.
@Controller('facilities')
@UseGuards(BranchScopeGuard)
export class FacilitiesController {
  constructor(private readonly mockData: MockDataService) {}

  // ADR-FAC-02 — 운영 중단(isActive=false)된 시설은 기본 목록에서 제외한다(소프트 삭제 원칙).
  // ?isActive=false를 명시하면 반대로 비활성 시설만 돌려준다 — 재활성화 화면(admin-web)이 이걸로 목록을 채운다.
  @Get()
  list(@Query('branchId') branchId?: string, @Query('isActive') isActiveQuery?: string) {
    const wantActive = isActiveQuery !== 'false';
    let facilities = this.mockData.facilities.filter((f) => f.isActive === wantActive);
    if (branchId) facilities = facilities.filter((f) => f.branchId === branchId);
    return ok(facilities.map((f) => this.toListItem(f)));
  }

  @Post()
  @Roles('BRANCH_ADMIN')
  create(@Body() dto: CreateFacilityDto, @CurrentUser() user: RequestUser) {
    if (!user.branchId) {
      throw new AppException('BRANCH_REQUIRED', '소속 지점이 없는 계정입니다.', 403);
    }
    return ok(this.toListItem(this.mockData.createFacility(user.branchId, dto)));
  }

  @Patch(':id')
  @Roles('BRANCH_ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateFacilityDto, @CurrentUser() user: RequestUser) {
    this.assertOwnBranch(this.findFacilityOrThrow(id), user);
    return ok(this.toListItem(this.mockData.updateFacility(id, dto)));
  }

  // 08문서 §4·§6 "수동 보정"(source=MANUAL) — Phase 2 자동계산 스케줄러가 생기기 전까지는
  // 이 값이 조회 API의 최신값으로 그대로 노출된다.
  @Post(':id/congestion/manual')
  @Roles('BRANCH_ADMIN')
  correctCongestion(
    @Param('id') id: string,
    @Body() dto: ManualCongestionDto,
    @CurrentUser() user: RequestUser,
  ) {
    this.assertOwnBranch(this.findFacilityOrThrow(id), user);
    return ok(this.toListItem(this.mockData.setManualCongestion(id, dto.currentCount)));
  }

  private toListItem(facility: MockFacility) {
    return { ...facility, branchName: this.mockData.findBranchById(facility.branchId)?.name };
  }

  private findFacilityOrThrow(id: string): MockFacility {
    const facility = this.mockData.findFacilityById(id);
    if (!facility) {
      throw new AppException('FACILITY_NOT_FOUND', '시설을 찾을 수 없습니다.', 404);
    }
    return facility;
  }

  private assertOwnBranch(facility: MockFacility, user: RequestUser): void {
    if (facility.branchId !== user.branchId) {
      throw new AppException('FACILITY_SCOPE_VIOLATION', '다른 지점의 시설은 관리할 수 없습니다.', 403);
    }
  }
}
