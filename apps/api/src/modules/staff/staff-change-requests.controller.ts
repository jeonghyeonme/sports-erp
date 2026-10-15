import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedResource } from '../../common/decorators/scoped-resource.decorator';
import { AppException } from '../../common/exceptions/app.exception';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ok } from '../../common/http/api-response';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { StaffChangeRequestService } from './staff-change-request.service';

// 인사정보관리 ADR-STF-09(D11) — 직원 본인 신청 → 지점 관리자 1단계 승인. `/staff/:id`와 경로가 겹치지 않게 따로 둔다.
// 범위: 승인·반려·취소는 @ScopedResource('staffChangeRequest')(신청자의 현재 지점, STAFF는 본인 것만, D46).
@Controller('staff-change-requests')
export class StaffChangeRequestsController {
  constructor(private readonly requests: StaffChangeRequestService) {}

  // 지점 관리자는 정보를 직접 고친다(PATCH /staff/:id) — 신청은 STAFF만(사용자 결정 2026-10-15).
  @Post()
  @Roles('STAFF')
  async create(@Body() dto: CreateChangeRequestDto, @CurrentUser() user: RequestUser) {
    return ok(await this.requests.create(requireStaffId(user), dto.field, dto.newValue));
  }

  @Get('mine')
  @Roles('STAFF')
  async mine(@CurrentUser() user: RequestUser) {
    return ok(await this.requests.listMine(requireStaffId(user)));
  }

  // 신청함 — 지점 관리자는 자기 지점, 본사는 전체 조회.
  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  async list(@CurrentUser() user: RequestUser, @Query('status') status?: string) {
    if (user.role === 'BRANCH_ADMIN' && !user.branchId) return ok([]);
    return ok(await this.requests.listForReview({ branchId: user.role === 'BRANCH_ADMIN' ? user.branchId : undefined, status }));
  }

  @Delete(':id')
  @Roles('STAFF')
  @ScopedResource('staffChangeRequest')
  async cancel(@Param('id') id: string) {
    return ok(await this.requests.cancel(id));
  }

  @Patch(':id/approve')
  @Roles('BRANCH_ADMIN')
  @ScopedResource('staffChangeRequest')
  async approve(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return ok(await this.requests.approve(id, { accountId: user.accountId }));
  }

  @Patch(':id/reject')
  @Roles('BRANCH_ADMIN')
  @ScopedResource('staffChangeRequest')
  async reject(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return ok(await this.requests.reject(id, { accountId: user.accountId }));
  }
}

function requireStaffId(user: RequestUser): string {
  if (!user.staffId) throw new AppException('STAFF_NOT_FOUND', '연결된 직원 레코드가 없습니다.', 404);
  return user.staffId;
}
