import { Injectable } from '@nestjs/common';
import { PermissionAction } from '@prisma/client';
import { todayKst } from '../../common/date/kst-date';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { PermissionService } from '../../common/permissions/permission.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface InboxItem {
  key: string;
  label: string;
  count: number;
  link: string;
}

// 혼잡도를 이 시간보다 오래 안 고친 운영 시설은 "다시 입력"할 일이다(RFP 30분 이내 반영 — admin-web STALE_MINUTES와 같은 값).
const CONGESTION_STALE_MS = 30 * 60 * 1000;
// 문서 보존기한 알림과 같은 창(GET /documents/retention-alerts 기본 30일).
const RETENTION_DAYS = 30;

type Check = { key: string; label: string; link: string; permission?: [string, PermissionAction]; count: () => Promise<number> };

/**
 * D61 — 처리 대기함. 역할마다 "지금 내가 처리할 일"의 건수만 센다(목록은 각 화면이 보여 준다).
 * 지점 관리자·직원은 자기 지점·본인 범위로만 센다(D46과 같은 범위), 세부 권한(D60)으로 조회가 꺼진 항목은 뺀다.
 * 요청 한 번에 count 쿼리 3~4개를 병렬로 — 대시보드 첫 화면에서 한 번 부른다.
 */
@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
  ) {}

  async forUser(user: RequestUser): Promise<InboxItem[]> {
    const checks = this.checksFor(user);
    const allowed = await Promise.all(
      checks.map((c) => (c.permission ? this.permissions.allows(user, c.permission[0], c.permission[1]) : true)),
    );
    const visible = checks.filter((_, i) => allowed[i]);
    const counts = await Promise.all(visible.map((c) => c.count()));
    return visible.map((c, i) => ({ key: c.key, label: c.label, link: c.link, count: counts[i] }));
  }

  private checksFor(user: RequestUser): Check[] {
    const today = new Date(`${todayKst()}T00:00:00Z`);
    if (user.role === 'SUPER_ADMIN') {
      const retentionLimit = new Date(today.getTime() + RETENTION_DAYS * 86_400_000);
      return [
        {
          key: 'support',
          label: '처리할 업무지원 요청',
          link: '/support-requests',
          count: () => this.prisma.supportRequest.count({ where: { status: { in: ['REQUESTED', 'IN_PROGRESS'] } } }),
        },
        {
          key: 'contract',
          label: '계약 갱신 임박·만료 지점',
          link: '/',
          count: () => this.prisma.branch.count({ where: { contractStatus: { in: ['RENEWAL_DUE', 'EXPIRED'] } } }),
        },
        {
          key: 'unassigned',
          label: '재배치 대기 직원',
          link: '/staff',
          // ADR-STF-08 — 활성 파견이 없는 재직 직원(StaffService.list unassigned와 같은 조건)
          count: () =>
            this.prisma.staff.count({ where: { status: { not: 'RESIGNED' }, assignments: { none: { endDate: null } } } }),
        },
        {
          key: 'retention',
          label: `보존기한 ${RETENTION_DAYS}일 이내 문서`,
          link: '/documents',
          count: () =>
            this.prisma.document.count({ where: { deletedAt: null, retentionUntil: { not: null, lte: retentionLimit } } }),
        },
      ];
    }
    const branchId = user.branchId;
    if (!branchId) return [];
    if (user.role === 'BRANCH_ADMIN') {
      return [
        {
          key: 'leave',
          label: '승인 대기 휴가',
          link: '/attendance',
          permission: ['leave', 'READ'],
          count: () => this.prisma.leaveRequest.count({ where: { status: 'PENDING', staff: { branchId } } }),
        },
        {
          key: 'changeRequest',
          label: '승인 대기 인사 변경 신청',
          link: '/staff',
          permission: ['staff', 'READ'],
          count: () => this.prisma.staffProfileChangeRequest.count({ where: { status: 'PENDING', staff: { branchId } } }),
        },
        {
          key: 'checkIn',
          label: '오늘 체크인 대기 예약',
          link: '/reservations',
          permission: ['reservation', 'READ'],
          count: () =>
            this.prisma.reservation.count({
              where: { status: 'CONFIRMED', scheduleSlot: { date: today, program: { branchId } } },
            }),
        },
        {
          key: 'congestion',
          label: '혼잡도 30분 넘게 미갱신 시설',
          link: '/facilities',
          permission: ['facility', 'READ'],
          count: () =>
            this.prisma.facility.count({
              where: {
                branchId,
                isActive: true,
                OR: [{ lastUpdatedAt: null }, { lastUpdatedAt: { lt: new Date(Date.now() - CONGESTION_STALE_MS) } }],
              },
            }),
        },
      ];
    }
    if (user.role === 'STAFF' && user.staffId) {
      const staffId = user.staffId;
      return [
        {
          key: 'checkInToday',
          label: '오늘 출근 체크 전',
          link: '/attendance',
          count: async () => ((await this.needsCheckIn(staffId, today)) ? 1 : 0),
        },
        {
          key: 'myLeave',
          label: '처리 대기 중인 내 휴가 신청',
          link: '/attendance',
          count: () => this.prisma.leaveRequest.count({ where: { staffId, status: 'PENDING' } }),
        },
      ];
    }
    return [];
  }

  // 오늘이 근무일(정기 휴무·승인된 휴가가 아님)인데 근태 기록이 없으면 출근 체크할 일이다.
  private async needsCheckIn(staffId: string, today: Date): Promise<boolean> {
    const [staff, record, leave] = await Promise.all([
      this.prisma.staff.findUnique({ where: { id: staffId }, select: { offDays: true, status: true } }),
      this.prisma.attendanceRecord.findFirst({ where: { staffId, date: today }, select: { id: true } }),
      this.prisma.leaveRequest.findFirst({
        where: { staffId, status: 'APPROVED', startDate: { lte: today }, endDate: { gte: today } },
        select: { id: true },
      }),
    ]);
    if (!staff || staff.status !== 'ACTIVE' || record || leave) return false;
    return !staff.offDays.includes(today.getUTCDay());
  }
}
