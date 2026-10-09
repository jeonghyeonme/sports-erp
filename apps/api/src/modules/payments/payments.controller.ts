import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { PaymentService } from './payment.service';
import { ReservationService } from '../reservations/reservation.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ok } from '../../common/http/api-response';
import { pageMeta, parsePage } from '../../common/http/pagination';

// 예약및결제 A-5·A-7 — 결제 승인은 예약 당사자 본인만, 결제(매출) 내역 조회는 BRANCH_ADMIN/SUPER_ADMIN 전용.
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly reservationService: ReservationService,
  ) {}

  @Post(':reservationId/mock-pay')
  @Roles('MEMBER')
  async mockPay(@Param('reservationId') reservationId: string, @CurrentUser() user: RequestUser) {
    const reservation = await this.reservationService.findById(reservationId);
    if (!reservation) {
      throw new AppException('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다.', 404);
    }
    if (reservation.memberId !== user.memberId) {
      throw new AppException('RESERVATION_SCOPE_VIOLATION', '본인 예약만 결제할 수 있습니다.', 403);
    }
    return ok(await this.paymentService.mockPay(reservationId));
  }

  @Get()
  @Roles('BRANCH_ADMIN', 'SUPER_ADMIN')
  async list(
    @Query('branchId') branchId: string | undefined,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @CurrentUser() user: RequestUser,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
  ) {
    const scopeBranchId = user.role === 'BRANCH_ADMIN' ? user.branchId : branchId;
    // D43·ADR-RSV-04 — offset 페이지네이션(page·limit, 상한 100), 날짜 필터는 DB 조건.
    const page = parsePage(pageQuery, limitQuery);
    const { items, total } = await this.paymentService.list({ branchId: scopeBranchId, dateFrom, dateTo }, page);
    return ok(items, pageMeta(page, total));
  }
}
