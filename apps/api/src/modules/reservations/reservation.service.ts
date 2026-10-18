import { Injectable } from '@nestjs/common';
import { Payment, PaymentStatus, Prisma, Reservation, ReservationStatus, ScheduleSlot } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { todayKst, toKstDateString } from '../../common/date/kst-date';
import { PageRequest } from '../../common/http/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { ACTIVE_RESERVATION_STATUSES, lockReservation, lockScheduleSlot } from '../../prisma/integrity';
import { BranchService } from '../branches/branch.service';
import { MockPayment, MockReservation, MockScheduleSlot } from '../../fixtures/mock-data.types';

export type ReservationView = MockReservation & {
  slot?: MockScheduleSlot;
  programId?: string;
  programName?: string;
  branchId?: string;
  branchName?: string;
  memberName?: string;
  payment?: MockPayment;
};

const RESERVATION_STATUSES: ReservationStatus[] = ['REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
const ACTIVE = [...ACTIVE_RESERVATION_STATUSES] as ReservationStatus[];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const withContext = {
  scheduleSlot: { include: { program: { include: { branch: { select: { name: true } } } } } },
  member: { select: { name: true } },
  payment: true,
} as const;
type ReservationRow = Prisma.ReservationGetPayload<{ include: typeof withContext }>;

/**
 * 예약 — D32. 원천은 DB. 정원 검사는 회차 행 락 위에서 한다(ADR-RSV-01, D28 lockScheduleSlot) —
 * mock 시절 "단일 스레드라 락이 필요 없다"는 가정이 여기서 끝난다.
 */
@Injectable()
export class ReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchService: BranchService,
  ) {}

  async findById(id: string): Promise<ReservationView | null> {
    const row = await this.prisma.reservation.findUnique({ where: { id }, include: withContext });
    return row ? toView(row) : null;
  }

  /** 예약및결제 A-5·A-7 — 범위(회원 본인·지점·회원 지정)는 컨트롤러가 정해서 넘긴다. */
  /** D43 — 쪽 단위 + total, 최근 예약부터(B8 사용자 결정, log/088). 회원 웹 "내 예약"도 이 순서로 받는다. */
  async list(
    filter: { memberId?: string; branchId?: string; status?: string; dateFrom?: string; dateTo?: string },
    page: PageRequest,
  ): Promise<{ items: ReservationView[]; total: number }> {
    if (filter.status && !RESERVATION_STATUSES.includes(filter.status as ReservationStatus)) return { items: [], total: 0 };
    // ADR-RSV-08 — 회차 날짜(KST, ScheduleSlot.date) 범위. 형식이 틀리면 빈 목록(다른 목록의 "모르는 필터 값"과 같다).
    if ([filter.dateFrom, filter.dateTo].some((d) => d !== undefined && !(DATE_ONLY.test(d) && !Number.isNaN(Date.parse(d))))) {
      return { items: [], total: 0 };
    }
    const byDate = filter.dateFrom !== undefined || filter.dateTo !== undefined;
    const date: Prisma.DateTimeFilter | undefined = byDate
      ? {
          ...(filter.dateFrom ? { gte: new Date(`${filter.dateFrom}T00:00:00Z`) } : {}),
          ...(filter.dateTo ? { lte: new Date(`${filter.dateTo}T00:00:00Z`) } : {}),
        }
      : undefined;
    const where: Prisma.ReservationWhereInput = {
      memberId: filter.memberId,
      status: filter.status as ReservationStatus | undefined,
      scheduleSlot:
        filter.branchId || date ? { program: filter.branchId ? { branchId: filter.branchId } : undefined, date } : undefined,
    };
    const [total, rows] = await Promise.all([
      this.prisma.reservation.count({ where }),
      this.prisma.reservation.findMany({
        where,
        include: withContext,
        // 날짜로 거르면 현장 순서(회차 시각순), 아니면 예전처럼 최근 예약부터(B8).
        orderBy: byDate
          ? [{ scheduleSlot: { date: 'asc' } }, { scheduleSlot: { startTime: 'asc' } }, { id: 'asc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: page.skip,
        take: page.pageSize,
      }),
    ]);
    return { items: rows.map(toView), total };
  }

  /**
   * 예약및결제 A-5 POST /reservations. 검사 순서는 예전 mock 그대로(에러 코드 우선순위가 테스트로 고정돼 있음):
   * 회차 → 프로그램 → 예약형 여부 → 진행중 → 회원 지점(DI-02) → 계약 종료 → 지난 회차(ADR-RSV-05) → 중복(ADR-RSV-02) → 정원(ADR-RSV-01).
   * 정원·중복은 회차 행을 잠근 트랜잭션 안에서 센다 — 동시 요청이 같은 마지막 좌석을 둘 다 잡지 못한다.
   */
  async create(memberId: string, scheduleSlotId: string): Promise<{ reservation: ReservationView; payment?: MockPayment }> {
    const gate = await this.branchService.loadGate();
    const reservationId = await this.withDuplicateGuard(() =>
      this.prisma.$transaction(async (tx) => {
        const locked = await lockScheduleSlot(tx, scheduleSlotId);
        if (!locked) throw new AppException('SLOT_NOT_FOUND', '회차를 찾을 수 없습니다.', 404);
        const slot = await tx.scheduleSlot.findUniqueOrThrow({ where: { id: scheduleSlotId }, include: { program: true } });
        const program = slot.program;
        if (program.pricingType !== 'PAID_SESSION') {
          throw new AppException('NOT_RESERVABLE', '예약 가능한 프로그램이 아닙니다.', 400);
        }
        if (program.status !== 'RUNNING') {
          throw new AppException('PROGRAM_NOT_RUNNING', '진행중인 프로그램이 아닙니다.', 409);
        }
        // DI-02 — 회원은 자기가 등록된 지점의 프로그램만 예약한다(CLAUDE.md 지점 격리).
        const member = await tx.member.findUnique({ where: { id: memberId }, select: { branchId: true } });
        if (!member || member.branchId !== program.branchId) {
          throw new AppException('MEMBER_BRANCH_MISMATCH', '본인이 등록된 지점의 프로그램만 예약할 수 있습니다.', 403);
        }
        if (gate.isTerminated(program.branchId)) {
          throw new AppException('BRANCH_TERMINATED', '위탁계약이 종료된 지점에는 예약할 수 없습니다.', 409);
        }
        // ADR-RSV-05 — 이미 시작했거나 지난 회차는 예약하지 않는다. 회차 날짜·시각은 KST라 +09:00으로 해석한다(D32 결정 5).
        if (kstSlotStart(slot).getTime() <= Date.now()) {
          throw new AppException('SLOT_ALREADY_STARTED', '이미 시작했거나 지난 회차는 예약할 수 없습니다.', 409);
        }
        const duplicate = await tx.reservation.findFirst({
          where: { memberId, scheduleSlotId, status: { in: ACTIVE } },
          select: { id: true },
        });
        if (duplicate) throw alreadyReserved();
        const booked = await tx.reservation.count({ where: { scheduleSlotId, status: { in: ACTIVE } } });
        if (booked >= locked.capacity) {
          throw new AppException('SLOT_FULL', '정원이 가득 찼습니다.', 409);
        }

        const paid = program.price > 0;
        const reservation = await tx.reservation.create({
          data: { memberId, scheduleSlotId, status: paid ? 'REQUESTED' : 'CONFIRMED' },
        });
        if (paid) {
          // 서버가 Program 가격을 재조회해 결제금액을 결정한다(클라이언트 금액 신뢰 안 함, 예약및결제 A-7).
          // 공급가액·부가세도 생성 시점에 나눈다 — mock은 PENDING 동안 0/0으로 뒀는데, D28 CHECK
          // (Payment_amount_split_ck: supplyAmount + vat = amount)가 그 상태를 거부해 D32에서 드러났다.
          await tx.payment.create({
            data: {
              reservationId: reservation.id,
              memberId,
              amount: program.price,
              ...splitVat(program.price),
              method: 'MOCK_CARD',
              status: 'PENDING',
            },
          });
        }
        return reservation.id;
      }),
    );
    const view = (await this.findById(reservationId))!;
    return { reservation: view, payment: view.payment };
  }

  /**
   * 예약및결제 A-6 취소/환불 — 회차 시작 cancellationDeadlineHours(기본 24) 전 취소만 전액 환불.
   * D32 결정 5 — 회차 날짜·시각은 KST라 "+09:00"을 붙여 해석한다(예전 mock은 호스트 시간대로 해석해
   * UTC 서버에서 마감을 9시간 늦게 봤다).
   */
  async cancel(id: string, cancelReason?: string): Promise<ReservationView> {
    await this.prisma.$transaction(async (tx) => {
      // R1(docs/log/123) — 결제 승인과 같은 순서로 예약 행을 먼저 잠그고, 결제 상태는 락 뒤에 읽는다.
      // 락 전에 읽으면 그사이 커밋된 승인(APPROVED)을 모른 채 FAILED로 덮어써 "승인된 돈이 실패·환불 없음"이 됐다.
      if (!(await lockReservation(tx, id))) throw new AppException('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다.', 404);
      const reservation = await tx.reservation.findUniqueOrThrow({
        where: { id },
        include: { payment: true, scheduleSlot: { include: { program: { include: { branch: true } } } } },
      });
      const { count } = await tx.reservation.updateMany({
        where: { id, status: { in: ACTIVE } },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason },
      });
      if (count === 0) {
        throw new AppException('RESERVATION_NOT_CANCELLABLE', '취소할 수 없는 예약 상태입니다.', 409);
      }
      const payment = reservation.payment;
      // 결제 상태는 읽은 상태일 때만 바꾼다 — 락을 거치지 않는 쓰기가 생겨도 덮어쓰지 않고 롤백한다.
      const changePayment = async (from: PaymentStatus, data: Prisma.PaymentUpdateManyMutationInput) => {
        const changed = await tx.payment.updateMany({ where: { id: payment!.id, status: from }, data });
        if (changed.count === 0) {
          throw new AppException('RESERVATION_NOT_CANCELLABLE', '결제 상태가 바뀌었습니다. 다시 시도해 주세요.', 409);
        }
      };
      if (payment?.status === 'PENDING') {
        await changePayment('PENDING', { status: 'FAILED' });
      } else if (payment?.status === 'APPROVED') {
        const slot = reservation.scheduleSlot;
        const deadlineHours = slot.program.branch.cancellationDeadlineHours ?? 24;
        if (kstSlotStart(slot).getTime() - Date.now() >= deadlineHours * 60 * 60 * 1000) {
          await changePayment('APPROVED', { status: 'REFUNDED', refundedAt: new Date() });
        }
        // 마감 이내 취소는 환불 없이 Payment.status=APPROVED가 그대로 남는다(예약및결제 A-6 "환불 불가").
      }
    });
    return (await this.findById(id))!;
  }

  // 예약및결제 A-5 PATCH /reservations/:id/check-in — 확정된 예약만, 회차 당일(KST)만(ADR-RSV-08).
  async checkIn(id: string): Promise<ReservationView> {
    const target = await this.prisma.reservation.findUnique({ where: { id }, select: { scheduleSlot: { select: { date: true } } } });
    if (!target) throw new AppException('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다.', 404);
    if (toKstDateString(target.scheduleSlot.date) !== todayKst()) {
      throw new AppException('CHECK_IN_NOT_TODAY', '체크인은 회차 당일에만 할 수 있습니다.', 409);
    }
    const { count } = await this.prisma.reservation.updateMany({
      where: { id, status: 'CONFIRMED' },
      data: { status: 'COMPLETED' },
    });
    if (count === 0) {
      throw new AppException('RESERVATION_NOT_CONFIRMED', '확정된 예약만 체크인할 수 있습니다.', 409);
    }
    return (await this.findById(id))!;
  }

  // ADR-RSV-02 — 앱 검사를 동시에 통과한 두 요청은 활성 예약 부분 unique 인덱스가 막는다.
  private async withDuplicateGuard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw alreadyReserved();
      throw e;
    }
  }
}

/** 예약및결제 A-6 부가세 분리 — 실제 낸 금액에서 공급가액/부가세를 역산한다(세율 10%). */
export function splitVat(amount: number): { supplyAmount: number; vat: number } {
  const supplyAmount = Math.round(amount / 1.1);
  return { supplyAmount, vat: amount - supplyAmount };
}

/** 회차 시작 시각 — 날짜(KST 달력 날짜)와 HH:mm을 KST로 해석한다. 취소 마감(A-6)과 지난 회차 판정(ADR-RSV-05)이 같이 쓴다. */
function kstSlotStart(slot: Pick<ScheduleSlot, 'date' | 'startTime'>): Date {
  return new Date(`${toKstDateString(slot.date)}T${slot.startTime}:00+09:00`);
}

function alreadyReserved(): AppException {
  return new AppException('ALREADY_RESERVED', '이미 이 회차를 예약했습니다.', 409);
}

export function toMockSlot(row: ScheduleSlot): MockScheduleSlot {
  return {
    id: row.id,
    programId: row.programId,
    date: toKstDateString(row.date),
    startTime: row.startTime,
    endTime: row.endTime,
    capacity: row.capacity,
  };
}

export function toMockPayment(row: Payment): MockPayment {
  return {
    id: row.id,
    reservationId: row.reservationId,
    memberId: row.memberId,
    amount: row.amount,
    supplyAmount: row.supplyAmount,
    vat: row.vat,
    method: row.method as MockPayment['method'], // FREE는 스키마에만 있고 앱이 만들지 않는다(무료 회차는 결제 행 없이 CONFIRMED)
    status: row.status,
    mockApprovalNo: row.mockApprovalNo ?? undefined,
    approvedAt: row.approvedAt?.toISOString(),
    refundedAt: row.refundedAt?.toISOString(),
  };
}

export function toMockReservation(row: Reservation): MockReservation {
  return {
    id: row.id,
    memberId: row.memberId,
    scheduleSlotId: row.scheduleSlotId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString(),
    cancelReason: row.cancelReason ?? undefined,
  };
}

function toView(row: ReservationRow): ReservationView {
  const program = row.scheduleSlot.program;
  return {
    ...toMockReservation(row),
    slot: toMockSlot(row.scheduleSlot),
    programId: program.id,
    programName: program.name,
    branchId: program.branchId,
    branchName: program.branch.name,
    memberName: row.member.name,
    payment: row.payment ? toMockPayment(row.payment) : undefined,
  };
}
