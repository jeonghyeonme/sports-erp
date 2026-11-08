import { Prisma } from '@prisma/client';
import { todayKst } from '../../common/date/kst-date';
import { PrismaService } from '../../prisma/prisma.service';

export interface MonthlyPerformance {
  month: string; // YYYY-MM (KST)
  revenue: number; // 회차 결제 순매출 = 그달 승인액 − 그달 환불액
  refunded: number;
  reservations: number; // 그달 회차의 예약(취소 제외)
  completed: number; // 그달 회차의 이용 완료(체크인)
  newMembers: number; // 그달 가입
}

/**
 * 지점 운영 실적 — 최근 N개월(이번 달 포함, KST 달력월). log/125 F3: 갱신 임박 지점을 열어도 갱신 판단 근거
 * (사업 구조의 "운영 데이터 → 계약 판단")가 화면에 없었다. 지표마다 달 단위 GROUP BY 한 번이라 쿼리는 4개다
 * (월마다 나눠 세면 12개 — 풀러 모드에선 왕복 수가 곧 지연이다, D48).
 * 매출은 회차 예약 결제(Payment)만 센다. 수강·PT 패키지 판매는 결제 기록이 없어 빠진다.
 */
export async function branchPerformance(prisma: PrismaService, branchId: string, months = 3): Promise<MonthlyPerformance[]> {
  return performance(prisma, branchId, months);
}

/** D75(log/208) — 전사(모든 지점) 월별 실적. 본사 대시보드 추이. 지표·기준은 지점별과 같다. */
export async function companyPerformance(prisma: PrismaService, months: number): Promise<MonthlyPerformance[]> {
  return performance(prisma, null, months);
}

/** 최근 N개월 달 키(YYYY-MM, KST) — 이번 달이 마지막. */
export function monthKeys(months: number): string[] {
  const today = todayKst();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

/** D75(log/208) — 차트가 보는 최대 기간: 지난 12개월 + 이번 달(진행 중). */
export const PERFORMANCE_MAX_MONTHS = 13;
export function parseMonths(q: string | undefined, fallback: number): number {
  const n = Math.trunc(Number(q));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, PERFORMANCE_MAX_MONTHS) : fallback;
}

async function performance(prisma: PrismaService, branchId: string | null, months: number): Promise<MonthlyPerformance[]> {
  const today = todayKst();
  const keys = monthKeys(months);
  const firstDay = `${keys[0]}-01`;
  // branchId가 null이면 전사(모든 지점) — 조건 조각만 바꾼다.
  const programBranch = branchId === null ? Prisma.sql`TRUE` : Prisma.sql`g."branchId" = ${branchId}`;
  const memberBranch = branchId === null ? Prisma.sql`TRUE` : Prisma.sql`"branchId" = ${branchId}`;
  // 결제 시각은 UTC로 저장된다 — KST 달 경계는 9시간 앞이다.
  const fromInstant = new Date(`${firstDay}T00:00:00+09:00`);
  const fromDate = new Date(`${firstDay}T00:00:00Z`); // @db.Date 열 비교용

  type Row = { month: string; n: bigint | number | null };
  const branchSlots = Prisma.sql`
    JOIN "Reservation" r ON r."id" = p."reservationId"
    JOIN "ScheduleSlot" s ON s."id" = r."scheduleSlotId"
    JOIN "Program" g ON g."id" = s."programId"`;
  const [approved, refunded, reservations, members] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT to_char(p."approvedAt" + interval '9 hours', 'YYYY-MM') AS month, SUM(p."amount") AS n
      FROM "Payment" p ${branchSlots}
      WHERE ${programBranch} AND p."approvedAt" >= ${fromInstant} AND p."status" IN ('APPROVED', 'REFUNDED')
      GROUP BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT to_char(p."refundedAt" + interval '9 hours', 'YYYY-MM') AS month, SUM(p."amount") AS n
      FROM "Payment" p ${branchSlots}
      WHERE ${programBranch} AND p."refundedAt" >= ${fromInstant} AND p."status" = 'REFUNDED'
      GROUP BY 1`,
    prisma.$queryRaw<Array<{ month: string; total: bigint; completed: bigint }>>`
      SELECT to_char(s."date", 'YYYY-MM') AS month,
             COUNT(*) FILTER (WHERE r."status" <> 'CANCELLED') AS total,
             COUNT(*) FILTER (WHERE r."status" = 'COMPLETED') AS completed
      FROM "Reservation" r
      JOIN "ScheduleSlot" s ON s."id" = r."scheduleSlotId"
      JOIN "Program" g ON g."id" = s."programId"
      WHERE ${programBranch} AND s."date" >= ${fromDate} AND s."date" <= ${new Date(`${today}T00:00:00Z`)}
      GROUP BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT to_char("joinedAt", 'YYYY-MM') AS month, COUNT(*) AS n
      FROM "Member"
      WHERE ${memberBranch} AND "joinedAt" >= ${fromDate}
      GROUP BY 1`,
  ]);
  const num = (rows: Row[], month: string) => Number(rows.find((r) => r.month === month)?.n ?? 0);
  return keys.map((month) => {
    const resv = reservations.find((r) => r.month === month);
    const refundedAmount = num(refunded, month);
    return {
      month,
      revenue: num(approved, month) - refundedAmount,
      refunded: refundedAmount,
      reservations: Number(resv?.total ?? 0),
      completed: Number(resv?.completed ?? 0),
      newMembers: num(members, month),
    };
  });
}

export interface BranchMonthRevenue {
  branchId: string;
  branchName: string;
  contractStatus: string;
  revenue: number; // 그달 순매출(승인 − 환불)
}

/**
 * D75(log/208) — 한 달(YYYY-MM, KST)의 지점별 순매출. 본사 대시보드의 지점 비교(큰 것부터). 매출이 없는 지점도 0으로 넣는다.
 * 기준은 월별 실적과 같다(승인액 − 같은 달 환불액, 회차 결제만).
 */
export async function branchRevenueForMonth(prisma: PrismaService, month: string): Promise<BranchMonthRevenue[]> {
  const from = new Date(`${month}-01T00:00:00+09:00`);
  const next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 7);
  const to = new Date(`${next}-01T00:00:00+09:00`);
  type Row = { branchId: string; n: bigint | number | null };
  const [branches, approved, refunded] = await Promise.all([
    prisma.branch.findMany({ select: { id: true, name: true, contractStatus: true } }),
    prisma.$queryRaw<Row[]>`
      SELECT g."branchId", SUM(p."amount") AS n
      FROM "Payment" p
      JOIN "Reservation" r ON r."id" = p."reservationId"
      JOIN "ScheduleSlot" s ON s."id" = r."scheduleSlotId"
      JOIN "Program" g ON g."id" = s."programId"
      WHERE p."approvedAt" >= ${from} AND p."approvedAt" < ${to} AND p."status" IN ('APPROVED', 'REFUNDED')
      GROUP BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT g."branchId", SUM(p."amount") AS n
      FROM "Payment" p
      JOIN "Reservation" r ON r."id" = p."reservationId"
      JOIN "ScheduleSlot" s ON s."id" = r."scheduleSlotId"
      JOIN "Program" g ON g."id" = s."programId"
      WHERE p."refundedAt" >= ${from} AND p."refundedAt" < ${to} AND p."status" = 'REFUNDED'
      GROUP BY 1`,
  ]);
  const sum = (rows: Row[], id: string) => Number(rows.find((r) => r.branchId === id)?.n ?? 0);
  return branches
    .map((b) => ({ branchId: b.id, branchName: b.name, contractStatus: b.contractStatus, revenue: sum(approved, b.id) - sum(refunded, b.id) }))
    .sort((a, b) => b.revenue - a.revenue || a.branchName.localeCompare(b.branchName, 'ko'));
}
