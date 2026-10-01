import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { toKstDateString } from '../../common/date/kst-date';
import { PrismaService } from '../../prisma/prisma.service';
import { MockPayment } from '../../mock-data/mock-data.types';
import { ReservationService, ReservationView, splitVat, toMockPayment } from '../reservations/reservation.service';

export type PaymentView = MockPayment & { memberName?: string; programName?: string; branchName?: string };

/** 결제(모의) — D32. 원천은 DB. */
@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationService: ReservationService,
  ) {}

  /**
   * 예약및결제 A-5 POST /payments/:reservationId/mock-pay — 예약 당사자 본인만(컨트롤러가 먼저 확인).
   * 결제 승인과 예약 확정을 한 트랜잭션에서, "PENDING일 때만" 바꿔 두 번 눌러도 한 번만 승인된다.
   */
  async mockPay(reservationId: string): Promise<{ reservation: ReservationView; payment: MockPayment }> {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { reservationId } });
      if (!payment || payment.status !== 'PENDING') throw notPending();
      // 예약및결제 A-6 부가세 분리 — 생성 시점에 이미 나눴지만 승인 시점 금액으로 다시 확정한다(같은 계산).
      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          ...splitVat(payment.amount),
          status: 'APPROVED',
          mockApprovalNo: `MOCK-${randomUUID().slice(0, 8).toUpperCase()}`,
          approvedAt: new Date(),
        },
      });
      if (count === 0) throw notPending();
      await tx.reservation.update({ where: { id: reservationId }, data: { status: 'CONFIRMED' } });
    });
    const reservation = (await this.reservationService.findById(reservationId))!;
    return { reservation: stripContext(reservation), payment: reservation.payment! };
  }

  /**
   * 예약및결제 A-5 GET /payments — 지점 범위는 컨트롤러가 정한다. 날짜 필터는 KST 날짜로 비교한다(D32 결정 5 —
   * 예전 mock은 approvedAt ISO 문자열 앞 10자리, 즉 UTC 날짜로 비교했다). 미승인 건은 날짜 필터에서 빠지지 않는다.
   */
  async list(filter: { branchId?: string; dateFrom?: string; dateTo?: string }): Promise<PaymentView[]> {
    const rows = await this.prisma.payment.findMany({
      where: filter.branchId ? { reservation: { scheduleSlot: { program: { branchId: filter.branchId } } } } : undefined,
      include: {
        member: { select: { name: true } },
        reservation: { include: { scheduleSlot: { include: { program: { include: { branch: { select: { name: true } } } } } } } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows
      .filter((p) => {
        const day = p.approvedAt ? toKstDateString(p.approvedAt) : undefined;
        if (filter.dateFrom && day && day < filter.dateFrom) return false;
        if (filter.dateTo && day && day > filter.dateTo) return false;
        return true;
      })
      .map((p) => {
        const program = p.reservation.scheduleSlot.program;
        return { ...toMockPayment(p), memberName: p.member.name, programName: program.name, branchName: program.branch.name };
      });
  }
}

function notPending(): AppException {
  return new AppException('PAYMENT_NOT_PENDING', '결제 대기 상태가 아닙니다.', 409);
}

/** 예전 응답의 reservation은 조인 없는 예약 필드만이었다 — 같은 형태로 돌려준다. */
function stripContext(view: ReservationView) {
  return {
    id: view.id,
    memberId: view.memberId,
    scheduleSlotId: view.scheduleSlotId,
    status: view.status,
    createdAt: view.createdAt,
    cancelledAt: view.cancelledAt,
    cancelReason: view.cancelReason,
  } as ReservationView;
}
