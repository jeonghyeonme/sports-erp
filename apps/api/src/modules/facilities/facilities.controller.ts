import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { FacilityService } from './facility.service';
import { AppException } from '../../common/exceptions/app.exception';
import { MockFacility } from '../../mock-data/mock-data.types';
import { ok } from '../../common/http/api-response';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import { ManualCongestionDto } from './dto/manual-congestion.dto';

// 혼잡도관리 A-7 — 회원 포함 모든 역할이 조회 가능, 등록/수정/수동 보정은 BRANCH_ADMIN 본인 지점만.
@Controller('facilities')
@UseGuards(BranchScopeGuard)
export class FacilitiesController {
  constructor(private readonly facilityService: FacilityService) {}

  // ADR-FAC-02 — 운영 중단(isActive=false)된 시설은 기본 목록에서 제외한다(소프트 삭제 원칙).
  // ?isActive=false를 명시하면 반대로 비활성 시설만 돌려준다 — 재활성화 화면(admin-web)이 이걸로 목록을 채운다.
  @Get()
  async list(@Query('branchId') branchId?: string, @Query('isActive') isActiveQuery?: string) {
    return ok(await this.facilityService.list({ branchId, isActive: isActiveQuery !== 'false' }));
  }

  @Post()
  @Roles('BRANCH_ADMIN')
  async create(@Body() dto: CreateFacilityDto, @CurrentUser() user: RequestUser) {
    if (!user.branchId) {
      throw new AppException('BRANCH_REQUIRED', '소속 지점이 없는 계정입니다.', 403);
    }
    return ok(await this.facilityService.create(user.branchId, dto));
  }

  @Patch(':id')
  @Roles('BRANCH_ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateFacilityDto, @CurrentUser() user: RequestUser) {
    this.assertOwnBranch(await this.findFacilityOrThrow(id), user);
    return ok(await this.facilityService.update(id, dto));
  }

  // 혼잡도관리 A-6·A-5 "수동 보정"(source=MANUAL) — Phase 2 자동계산 스케줄러가 생기기 전까지는
  // 이 값이 조회 API의 최신값으로 그대로 노출된다.
  @Post(':id/congestion/manual')
  @Roles('BRANCH_ADMIN')
  async correctCongestion(
    @Param('id') id: string,
    @Body() dto: ManualCongestionDto,
    @CurrentUser() user: RequestUser,
  ) {
    this.assertOwnBranch(await this.findFacilityOrThrow(id), user);
    return ok(await this.facilityService.setManualCongestion(id, dto.currentCount));
  }

  private async findFacilityOrThrow(id: string): Promise<MockFacility> {
    const facility = await this.facilityService.findById(id);
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
