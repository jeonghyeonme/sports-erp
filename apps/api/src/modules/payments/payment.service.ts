import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { PageRequest } from '../../common/http/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { lockBranchForShare, lockReservation } from '../../prisma/integrity';
import { todayKst, toKstDateString } from '../../common/date/kst-date';
import { MockPayment } from '../../fixtures/mock-data.types';
import { ReservationService, ReservationView, splitVat, toMockPayment } from '../reservations/reservation.service';

import { kstDayRange } from '../../common/date/kst-date';

export type PaymentView = MockPayment & { memberName?: string; programName?: string; branchName?: string; kind?: 'RESERVATION' | 'PT_PACKAGE' };

export type PTPurchase = {
  ptSession: { id: string; programId: string; programName: string; totalSessions: number; usedSessions: number; remainingSessions: number; purchasedAt: string };
  payment: MockPayment;
};

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
   * R1(docs/log/123) — 취소와 같은 순서(예약 → 결제)로 예약 행을 먼저 잠근다. 예전엔 결제 행을 먼저 잡고 예약을
   * 나중에 잡아, 예약 → 결제 순서인 취소와 겹치면 교착(40P01)으로 한쪽이 500을 받았다. 취소가 먼저 끝났으면
   * 락 뒤에 읽는 결제가 이미 FAILED라 409다.
   */
  async mockPay(reservationId: string): Promise<{ reservation: ReservationView; payment: MockPayment }> {
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockReservation(tx, reservationId))) throw notPending();
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
   * 예약및결제 ADR-RSV-09 POST /payments/pt-packages — 회원 앱 PT 패키지 구매(모의 결제, 즉시 승인).
   * 패키지(횟수·가격)는 프로그램에 정해진 하나(Program.ptPackageSessions·price)이고 금액은 서버가 정한다(A-7).
   * PT 잔여 횟수와 결제를 한 트랜잭션에서 만든다 — 결제만 있고 횟수가 없는 상태가 남지 않는다.
   * 현장 판매(관리자 등록, 결제 행 없음)는 그대로다. 앱 구매 취소·환불은 범위 밖(현장 처리).
   */
  async purchasePTPackage(memberId: string, programId: string): Promise<PTPurchase> {
    const ids = await this.prisma.$transaction(async (tx) => {
      const program = await tx.program.findUnique({ where: { id: programId } });
      if (!program) throw new AppException('PROGRAM_NOT_FOUND', '프로그램을 찾을 수 없습니다.', 404);
      const member = await tx.member.findUnique({ where: { id: memberId }, select: { branchId: true } });
      // DI-02 — 회원은 자기 지점의 프로그램만(예약과 같은 코드·상태).
      if (!member || member.branchId !== program.branchId) {
        throw new AppException('MEMBER_BRANCH_MISMATCH', '본인이 등록된 지점의 프로그램만 구매할 수 있습니다.', 403);
      }
      // D70 — 계약 종료 지점의 신규 활동 차단은 쓰기 트랜잭션 안 지점 행 공유 락으로 판정한다.
      if ((await lockBranchForShare(tx, program.branchId))?.contractStatus === 'TERMINATED') {
        throw new AppException('BRANCH_TERMINATED', '위탁계약이 종료된 지점에서는 구매할 수 없습니다.', 409);
      }
      if (program.pricingType !== 'PT_PACKAGE' || !program.ptPackageSessions || program.price <= 0) {
        throw new AppException('PT_PACKAGE_NOT_PURCHASABLE', '앱에서 구매할 수 있는 PT 패키지가 아닙니다.', 400);
      }
      if (program.status !== 'RUNNING') {
        throw new AppException('PROGRAM_NOT_RUNNING', '진행중인 프로그램이 아닙니다.', 409);
      }
      const ptSession = await tx.pTSession.create({
        data: {
          memberId,
          programId,
          totalSessions: program.ptPackageSessions,
          usedSessions: 0,
          purchasedAt: new Date(`${todayKst()}T00:00:00Z`),
        },
      });
      const payment = await tx.payment.create({
        data: {
          ptSessionId: ptSession.id,
          memberId,
          amount: program.price,
          ...splitVat(program.price),
          method: 'MOCK_CARD',
          status: 'APPROVED',
          mockApprovalNo: `MOCK-${randomUUID().slice(0, 8).toUpperCase()}`,
          approvedAt: new Date(),
        },
      });
      return { ptSessionId: ptSession.id, paymentId: payment.id };
    });
    const pt = await this.prisma.pTSession.findUniqueOrThrow({ where: { id: ids.ptSessionId }, include: { program: { select: { name: true } } } });
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: ids.paymentId } });
    return {
      ptSession: {
        id: pt.id,
        programId: pt.programId,
        programName: pt.program.name,
        totalSessions: pt.totalSessions,
        usedSessions: pt.usedSessions,
        remainingSessions: pt.totalSessions - pt.usedSessions,
        purchasedAt: toKstDateString(pt.purchasedAt),
      },
      payment: toMockPayment(payment),
    };
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
    // ADR-RSV-09 — 결제는 회차 예약 또는 PT 패키지 구매(앱) 중 하나에 붙는다. 지점은 둘 중 붙은 쪽의 프로그램으로 본다.
    const where: Prisma.PaymentWhereInput = {
      AND: [
        filter.branchId
          ? {
              OR: [
                { reservation: { scheduleSlot: { program: { branchId: filter.branchId } } } },
                { ptSession: { program: { branchId: filter.branchId } } },
              ],
            }
          : {},
        approvedAt ? { OR: [{ approvedAt: null }, { approvedAt }] } : {},
      ],
    };
    const [total, rows] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: {
          member: { select: { name: true } },
          reservation: { include: { scheduleSlot: { include: { program: { include: { branch: { select: { name: true } } } } } } } },
          ptSession: { include: { program: { include: { branch: { select: { name: true } } } } } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: page.skip,
        take: page.pageSize,
      }),
    ]);
    const items = rows.map((p): PaymentView => {
      const program = (p.reservation?.scheduleSlot.program ?? p.ptSession?.program)!;
      return {
        ...toMockPayment(p),
        memberName: p.member.name,
        programName: program.name,
        branchName: program.branch.name,
        kind: p.ptSessionId ? 'PT_PACKAGE' : 'RESERVATION',
      };
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
