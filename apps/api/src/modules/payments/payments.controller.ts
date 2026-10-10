import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaymentService } from './payment.service';
import { ScopedResource } from '../../common/decorators/scoped-resource.decorator';
import { ok } from '../../common/http/api-response';
import { pageMeta, parsePage } from '../../common/http/pagination';

// 예약및결제 A-5·A-7 — 결제 승인은 예약 당사자 본인만, 결제(매출) 내역 조회는 BRANCH_ADMIN/SUPER_ADMIN 전용.
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentService: PaymentService) {}

  // D46 — 예약 당사자 본인 확인은 전역 BranchScopeGuard가 한다(MEMBER는 예약을 본인 것만).
  @Post(':reservationId/mock-pay')
  @Roles('MEMBER')
  @ScopedResource('reservation', { param: 'reservationId' })
  async mockPay(@Param('reservationId') reservationId: string) {
    return ok(await this.paymentService.mockPay(reservationId));
  }

  @Get()
  @Roles('BRANCH_ADMIN', 'SUPER_ADMIN')
  async list(
    @Query('branchId') branchId: string | undefined,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
  ) {
    // BRANCH_ADMIN이면 가드(D46)가 branchId를 본인 지점으로 고정해 넘긴다(다른 지점 지정은 403).
    // D43·ADR-RSV-04 — offset 페이지네이션(page·limit, 상한 100), 날짜 필터는 DB 조건.
    const page = parsePage(pageQuery, limitQuery);
    const { items, total } = await this.paymentService.list({ branchId, dateFrom, dateTo }, page);
    return ok(items, pageMeta(page, total));
  }
}
