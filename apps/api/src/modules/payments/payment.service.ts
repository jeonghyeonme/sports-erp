import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { kstDayRange } from '../../common/date/kst-date';
import { PageRequest } from '../../common/http/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { MockPayment } from '../../fixtures/mock-data.types';
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
   * 예약및결제 A-5 GET /payments — 지점 범위는 컨트롤러가 정한다. ADR-RSV-04(D43) — 날짜 필터를 DB 조건으로 내리고
   * 쪽 단위로 자른다. 날짜는 KST 하루 경계로 approvedAt 범위를 만든다(kstDayRange, D32 결정 5).
   * 미승인 건(approvedAt 없음)은 예전처럼 날짜 필터에서 빠지지 않는다 — `approvedAt IS NULL OR 범위`.
   * 최근 결제부터 보인다(B8 사용자 결정).
   */
  async list(
    filter: { branchId?: string; dateFrom?: string; dateTo?: string },
    page: PageRequest,
  ): Promise<{ items: PaymentView[]; total: number }> {
    const from = filter.dateFrom ? kstDayRange(filter.dateFrom) : undefined;
    const to = filter.dateTo ? kstDayRange(filter.dateTo) : undefined;
    // 형식이 틀린 날짜는 빈 목록 — 다른 목록의 "모르는 필터 값이면 빈 목록"과 같다(500을 내지 않는다).
    if (from === null || to === null) return { items: [], total: 0 };
    const approvedAt: Prisma.DateTimeNullableFilter | undefined =
      from || to ? { ...(from ? { gte: from.start } : {}), ...(to ? { lt: to.end } : {}) } : undefined;
    const where: Prisma.PaymentWhereInput = {
      reservation: filter.branchId ? { scheduleSlot: { program: { branchId: filter.branchId } } } : undefined,
      OR: approvedAt ? [{ approvedAt: null }, { approvedAt }] : undefined,
    };
    const [total, rows] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: {
          member: { select: { name: true } },
          reservation: { include: { scheduleSlot: { include: { program: { include: { branch: { select: { name: true } } } } } } } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: page.skip,
        take: page.pageSize,
      }),
    ]);
    const items = rows.map((p) => {
      const program = p.reservation.scheduleSlot.program;
      return { ...toMockPayment(p), memberName: p.member.name, programName: program.name, branchName: program.branch.name };
    });
    return { items, total };
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
