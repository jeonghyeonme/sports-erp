import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ScopedResource } from '../../common/decorators/scoped-resource.decorator';
import { FacilityService } from './facility.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ok } from '../../common/http/api-response';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import { ManualCongestionDto } from './dto/manual-congestion.dto';

// 혼잡도관리 A-7 — 회원 포함 모든 역할이 조회 가능, 등록/수정/수동 보정은 BRANCH_ADMIN 본인 지점만.
// D46 — 지점 범위(branchId·:id 소유)는 전역 BranchScopeGuard가 본다.
@Controller('facilities')
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
  @ScopedResource('facility')
  async update(@Param('id') id: string, @Body() dto: UpdateFacilityDto) {
    return ok(await this.facilityService.update(id, dto));
  }

  // 혼잡도관리 A-6·A-5 "수동 보정"(source=MANUAL) — Phase 2 자동계산 스케줄러가 생기기 전까지는
  // 이 값이 조회 API의 최신값으로 그대로 노출된다.
  @Post(':id/congestion/manual')
  @Roles('BRANCH_ADMIN')
  @ScopedResource('facility')
  async correctCongestion(@Param('id') id: string, @Body() dto: ManualCongestionDto) {
    return ok(await this.facilityService.setManualCongestion(id, dto.currentCount));
  }
}
