import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { MockDataService } from '../../mock-data/mock-data.service';
import { AppException } from '../../common/exceptions/app.exception';
import { MockPayment } from '../../mock-data/mock-data.types';
import { ok } from '../../common/http/api-response';

// 06문서 §5·§7 — 결제 승인은 예약 당사자 본인만, 결제(매출) 내역 조회는 BRANCH_ADMIN/SUPER_ADMIN 전용.
@Controller('payments')
export class PaymentsController {
  constructor(private readonly mockData: MockDataService) {}

  @Post(':reservationId/mock-pay')
  @Roles('MEMBER')
  mockPay(@Param('reservationId') reservationId: string, @CurrentUser() user: RequestUser) {
    const reservation = this.mockData.findReservationById(reservationId);
    if (!reservation) {
      throw new AppException('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다.', 404);
    }
    if (reservation.memberId !== user.memberId) {
      throw new AppException('RESERVATION_SCOPE_VIOLATION', '본인 예약만 결제할 수 있습니다.', 403);
    }
    const { reservation: updated, payment } = this.mockData.mockPay(reservationId);
    return ok({ reservation: updated, payment });
  }

  @Get()
  @Roles('BRANCH_ADMIN', 'SUPER_ADMIN')
  list(
    @Query('branchId') branchId: string | undefined,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    const scopeBranchId = user.role === 'BRANCH_ADMIN' ? user.branchId : branchId;
    let payments = this.mockData.payments;
    if (scopeBranchId) {
      payments = payments.filter((p) => this.branchIdOf(p) === scopeBranchId);
    }
    if (dateFrom) payments = payments.filter((p) => !p.approvedAt || p.approvedAt.slice(0, 10) >= dateFrom);
    if (dateTo) payments = payments.filter((p) => !p.approvedAt || p.approvedAt.slice(0, 10) <= dateTo);
    return ok(payments.map((p) => this.toListItem(p)));
  }

  private branchIdOf(payment: MockPayment): string | undefined {
    const reservation = this.mockData.findReservationById(payment.reservationId);
    const slot = reservation ? this.mockData.findScheduleSlotById(reservation.scheduleSlotId) : undefined;
    const program = slot ? this.mockData.findProgramById(slot.programId) : undefined;
    return program?.branchId;
  }

  private toListItem(payment: MockPayment) {
    const member = this.mockData.findMemberById(payment.memberId);
    const reservation = this.mockData.findReservationById(payment.reservationId);
    const slot = reservation ? this.mockData.findScheduleSlotById(reservation.scheduleSlotId) : undefined;
    const program = slot ? this.mockData.findProgramById(slot.programId) : undefined;
    return {
      ...payment,
      memberName: member?.name,
      programName: program?.name,
      branchName: program ? this.mockData.findBranchById(program.branchId)?.name : undefined,
    };
  }
}
