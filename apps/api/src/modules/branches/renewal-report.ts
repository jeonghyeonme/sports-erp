import { toKstDateString, todayKst } from '../../common/date/kst-date';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { companyPerformance, branchPerformance, MonthlyPerformance, PERFORMANCE_MAX_MONTHS } from './branch-performance';

/**
 * D81 — 계약 갱신용 영업 리포트(본사 전용, 지점 하나). 갱신 협상 때 "이 현장을 우리가 이렇게 운영했다"를 보여 줄 근거를
 * 한 장에 모은다. 새로 쌓는 데이터는 없다 — 계약 회차(D69), 운영 실적(D75와 같은 집계), 회원·프로그램·시설·혼잡도 이력·
 * 업무지원·파견 기록을 읽어 계산만 한다(스키마 변경 없음). 조항 변경 제안 메모는 넣지 않는다(사용자 결정 2026-11-16).
 */
export interface RenewalReport {
  generatedAt: string; // YYYY-MM-DD(KST)
  branch: { id: string; name: string; region: string | null; contractStatus: string };
  contract: {
    current: { roundNo: number; partner: string; startAt: string; endAt: string; daysLeft: number };
    rounds: Array<{ roundNo: number; partner: string; startAt: string; endAt: string; terminatedAt: string | null }>;
    renewals: number; // 1회차 뒤 갱신 횟수
    firstStartAt: string; // 이 현장을 맡은 첫날
    servedDays: number; // 첫날부터 오늘(또는 끝난 날)까지
  };
  performance: {
    months: MonthlyPerformance[]; // 지난 12개월 + 이번 달(진행 중)
    last12: Totals; // 다 끝난 지난 12개월 합계
    recent6: Totals; // 최근 6개월(다 끝난 달)
    prior6: Totals; // 그 앞 6개월
    completionRate: number | null; // 지난 12개월 이용 완료 ÷ 예약(%)
    companyAverage12: Totals; // 전사 지난 12개월 합계 ÷ 지점 수
    branchCount: number;
  };
  quality: {
    members: { active: number; dormant: number; withdrawn: number };
    programs: { running: number; categories: number };
    facilities: { active: number; averageLevel90d: number | null }; // 혼잡도 이력(최근 90일) 평균 단계 1~5
    support: { total: number; done: number; rejected: number; open: number; averageResolveDays: number | null }; // 지난 12개월 요청
    staff: { current: number; arrived12: number; left12: number }; // 지금 파견 인원, 지난 12개월 새로 온·떠난 파견
  };
}

export interface Totals {
  revenue: number;
  reservations: number;
  completed: number;
  newMembers: number;
}

const DAY_MS = 86_400_000;
const sum = (rows: MonthlyPerformance[]): Totals => ({
  revenue: rows.reduce((a, r) => a + r.revenue, 0),
  reservations: rows.reduce((a, r) => a + r.reservations, 0),
  completed: rows.reduce((a, r) => a + r.completed, 0),
  newMembers: rows.reduce((a, r) => a + r.newMembers, 0),
});
const dateOnly = (d: string) => new Date(`${d}T00:00:00Z`);
const daysBetween = (from: string, to: string) => Math.round((dateOnly(to).getTime() - dateOnly(from).getTime()) / DAY_MS);

export async function renewalReport(prisma: PrismaService, branchId: string): Promise<RenewalReport> {
  const today = todayKst();
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { contractRounds: { orderBy: { roundNo: 'asc' } } },
  });
  if (!branch) throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
  const rounds = branch.contractRounds;
  if (rounds.length === 0) throw new AppException('BRANCH_NOT_FOUND', '계약 회차가 없는 지점입니다.', 404);
  const current = rounds[rounds.length - 1];

  // 12개월 경계 — 다 끝난 지난 12개월의 첫날(KST). 이번 달은 진행 중이라 합계에서 뺀다.
  const yearAgo = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 13, 1)).toISOString().slice(0, 10);
  const yearAgoInstant = new Date(`${yearAgo}T00:00:00+09:00`);
  const ninetyDaysAgo = new Date(Date.now() - 90 * DAY_MS);

  const [months, company, branchCount, memberGroups, running, categories, facilities, levelAvg, support, staffNow, arrived, left] =
    await Promise.all([
      branchPerformance(prisma, branchId, PERFORMANCE_MAX_MONTHS),
      companyPerformance(prisma, PERFORMANCE_MAX_MONTHS),
      prisma.branch.count(),
      prisma.member.groupBy({ by: ['status'], where: { branchId }, _count: { _all: true } }),
      prisma.program.count({ where: { branchId, status: 'RUNNING' } }),
      prisma.program.findMany({ where: { branchId, status: 'RUNNING' }, select: { category: true }, distinct: ['category'] }),
      prisma.facility.count({ where: { branchId, isActive: true } }),
      prisma.congestionSnapshot.aggregate({ where: { facility: { branchId }, recordedAt: { gte: ninetyDaysAgo } }, _avg: { level: true } }),
      prisma.supportRequest.findMany({
        where: { branchId, createdAt: { gte: yearAgoInstant } },
        select: { status: true, createdAt: true, resolvedAt: true },
      }),
      prisma.staffAssignment.count({ where: { branchId, endDate: null } }),
      prisma.staffAssignment.count({ where: { branchId, startDate: { gte: dateOnly(yearAgo) } } }),
      prisma.staffAssignment.count({ where: { branchId, endDate: { gte: dateOnly(yearAgo) } } }),
    ]);

  const finished = months.slice(0, -1); // 이번 달(진행 중) 제외
  const last12 = sum(finished);
  const companyLast12 = sum(company.slice(0, -1));
  const per = (n: number) => Math.round(n / Math.max(branchCount, 1));
  const resolved = support.filter((s) => s.resolvedAt && (s.status === 'DONE' || s.status === 'REJECTED'));
  const memberCount = (status: string) => memberGroups.find((g) => g.status === status)?._count._all ?? 0;
  const firstStartAt = toKstDateString(rounds[0].startAt);
  const servedUntil = current.terminatedAt ? toKstDateString(current.terminatedAt) : today;

  return {
    generatedAt: today,
    branch: { id: branch.id, name: branch.name, region: branch.region, contractStatus: branch.contractStatus },
    contract: {
      current: {
        roundNo: current.roundNo,
        partner: current.partner,
        startAt: toKstDateString(current.startAt),
        endAt: toKstDateString(current.endAt),
        daysLeft: daysBetween(today, toKstDateString(current.endAt)),
      },
      rounds: rounds.map((r) => ({
        roundNo: r.roundNo,
        partner: r.partner,
        startAt: toKstDateString(r.startAt),
        endAt: toKstDateString(r.endAt),
        terminatedAt: r.terminatedAt ? toKstDateString(r.terminatedAt) : null,
      })),
      renewals: rounds.length - 1,
      firstStartAt,
      servedDays: Math.max(0, daysBetween(firstStartAt, servedUntil)),
    },
    performance: {
      months,
      last12,
      recent6: sum(finished.slice(-6)),
      prior6: sum(finished.slice(-12, -6)),
      completionRate: last12.reservations > 0 ? Math.round((last12.completed / last12.reservations) * 1000) / 10 : null,
      companyAverage12: {
        revenue: per(companyLast12.revenue),
        reservations: per(companyLast12.reservations),
        completed: per(companyLast12.completed),
        newMembers: per(companyLast12.newMembers),
      },
      branchCount,
    },
    quality: {
      members: { active: memberCount('ACTIVE'), dormant: memberCount('DORMANT'), withdrawn: memberCount('WITHDRAWN') },
      programs: { running, categories: categories.length },
      facilities: {
        active: facilities,
        averageLevel90d: levelAvg._avg.level === null ? null : Math.round(levelAvg._avg.level * 10) / 10,
      },
      support: {
        total: support.length,
        done: support.filter((s) => s.status === 'DONE').length,
        rejected: support.filter((s) => s.status === 'REJECTED').length,
        open: support.filter((s) => s.status === 'REQUESTED' || s.status === 'IN_PROGRESS').length,
        averageResolveDays:
          resolved.length === 0
            ? null
            : Math.round((resolved.reduce((a, s) => a + (s.resolvedAt!.getTime() - s.createdAt.getTime()), 0) / resolved.length / DAY_MS) * 10) / 10,
      },
      staff: { current: staffNow, arrived12: arrived, left12: left },
    },
  };
}
