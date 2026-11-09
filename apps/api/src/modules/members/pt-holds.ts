import { Prisma } from '@prisma/client';
import { ACTIVE_RESERVATION_STATUSES } from '../../prisma/integrity';

type Tx = Prisma.TransactionClient;

/**
 * 예약및결제 ADR-RSV-09 — PT 패키지의 "잡힌 횟수". PT 회차 예약은 만들 때 1회를 잡고(활성 예약),
 * 체크인 때 실제로 차감한다(usedSessions + 1). 그래서 쓸 수 있는 횟수 = 총 − 사용 − 잡힌 것.
 * 부르는 쪽은 그 패키지 행을 먼저 잠근다(lockPTSessions) — 예약 생성·"세션 사용"이 같은 행에서 줄을 선다.
 */
export async function heldByPTSession(tx: Tx, ptSessionIds: string[]): Promise<Map<string, number>> {
  if (ptSessionIds.length === 0) return new Map();
  const rows = await tx.reservation.groupBy({
    by: ['ptSessionId'],
    where: { ptSessionId: { in: ptSessionIds }, status: { in: [...ACTIVE_RESERVATION_STATUSES] } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.ptSessionId!, r._count._all]));
}

/** 패키지 행 락 — 한 회원·한 PT 프로그램의 패키지를 구매일 순으로 잠근다(오래된 패키지부터 쓴다). */
export async function lockPTSessions(
  tx: Tx,
  where: { memberId: string; programId: string } | { id: string },
): Promise<Array<{ id: string; totalSessions: number; usedSessions: number }>> {
  return 'id' in where
    ? tx.$queryRaw`SELECT "id", "totalSessions", "usedSessions" FROM "PTSession" WHERE "id" = ${where.id} FOR UPDATE`
    : tx.$queryRaw`
        SELECT "id", "totalSessions", "usedSessions" FROM "PTSession"
        WHERE "memberId" = ${where.memberId} AND "programId" = ${where.programId}
        ORDER BY "purchasedAt", "id" FOR UPDATE`;
}
