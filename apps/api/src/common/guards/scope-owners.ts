import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * D46 — 지점 단위 리소스의 "주인"을 id 하나로 가볍게 읽는다(필요한 열만 select).
 * 컨트롤러마다 있던 findXOrThrow + assert*가 하던 일을 BranchScopeGuard가 여기서 한 번에 한다.
 * - branchId: 소유 지점. null은 문서의 "전사 문서"뿐이다(shared).
 * - memberId / staffId: "본인" 판정용 — MEMBER는 회원·예약을, STAFF는 직원·휴가를 본인 것만 다룬다.
 */
export type ScopedKind =
  | 'member'
  | 'staff'
  | 'program'
  | 'facility'
  | 'instructor'
  | 'asset'
  | 'document'
  | 'reservation'
  | 'leaveRequest';

export interface ScopeOwner {
  branchId: string | null;
  memberId?: string;
  staffId?: string;
}

interface KindInfo {
  label: string;
  notFound: [code: string, message: string];
  violation: string;
  /** branchId가 null이면 모든 지점에 공개(전사 문서). */
  shared?: boolean;
}

// 코드는 이관 전 컨트롤러가 내던 값 그대로다 — admin-web 오류 해결 문구(lib/error-hints.ts)가 이 코드를 본다.
export const SCOPED_KINDS: Record<ScopedKind, KindInfo> = {
  member: { label: '회원', notFound: ['MEMBER_NOT_FOUND', '회원을 찾을 수 없습니다.'], violation: 'MEMBER_SCOPE_VIOLATION' },
  staff: { label: '직원', notFound: ['STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.'], violation: 'STAFF_SCOPE_VIOLATION' },
  program: { label: '프로그램', notFound: ['PROGRAM_NOT_FOUND', '프로그램을 찾을 수 없습니다.'], violation: 'PROGRAM_SCOPE_VIOLATION' },
  facility: { label: '시설', notFound: ['FACILITY_NOT_FOUND', '시설을 찾을 수 없습니다.'], violation: 'FACILITY_SCOPE_VIOLATION' },
  instructor: { label: '강사', notFound: ['INSTRUCTOR_NOT_FOUND', '강사를 찾을 수 없습니다.'], violation: 'INSTRUCTOR_SCOPE_VIOLATION' },
  asset: { label: '자산', notFound: ['ASSET_NOT_FOUND', '자산을 찾을 수 없습니다.'], violation: 'ASSET_SCOPE_VIOLATION' },
  document: {
    label: '문서',
    notFound: ['DOCUMENT_NOT_FOUND', '문서를 찾을 수 없습니다.'],
    violation: 'DOCUMENT_SCOPE_VIOLATION',
    shared: true,
  },
  reservation: { label: '예약', notFound: ['RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다.'], violation: 'RESERVATION_SCOPE_VIOLATION' },
  leaveRequest: {
    label: '휴가 신청',
    notFound: ['LEAVE_REQUEST_NOT_FOUND', '휴가 신청을 찾을 수 없습니다.'],
    violation: 'ATTENDANCE_SCOPE_VIOLATION',
  },
};

@Injectable()
export class ScopeOwners {
  constructor(private readonly prisma: PrismaService) {}

  async find(kind: ScopedKind, id: string): Promise<ScopeOwner | null> {
    const p = this.prisma;
    const branchOnly = (row: { branchId: string } | null) => (row ? { branchId: row.branchId } : null);
    switch (kind) {
      case 'member': {
        const row = await p.member.findUnique({ where: { id }, select: { branchId: true } });
        return row ? { branchId: row.branchId, memberId: id } : null;
      }
      case 'staff': {
        const row = await p.staff.findUnique({ where: { id }, select: { branchId: true } });
        return row ? { branchId: row.branchId, staffId: id } : null;
      }
      case 'program':
        return branchOnly(await p.program.findUnique({ where: { id }, select: { branchId: true } }));
      case 'facility':
        return branchOnly(await p.facility.findUnique({ where: { id }, select: { branchId: true } }));
      case 'instructor':
        return branchOnly(await p.instructor.findUnique({ where: { id }, select: { branchId: true } }));
      case 'asset':
        return branchOnly(await p.asset.findUnique({ where: { id }, select: { branchId: true } }));
      case 'document': {
        const row = await p.document.findFirst({ where: { id, deletedAt: null }, select: { branchId: true } });
        return row ? { branchId: row.branchId } : null;
      }
      case 'reservation': {
        const row = await p.reservation.findUnique({
          where: { id },
          select: { memberId: true, scheduleSlot: { select: { program: { select: { branchId: true } } } } },
        });
        return row ? { branchId: row.scheduleSlot.program.branchId, memberId: row.memberId } : null;
      }
      case 'leaveRequest': {
        // 근태관리 A-7 — 휴가 신청은 신청자의 "현재" 소속 지점 관리자가 처리한다.
        const row = await p.leaveRequest.findUnique({
          where: { id },
          select: { staffId: true, staff: { select: { branchId: true } } },
        });
        return row ? { branchId: row.staff.branchId, staffId: row.staffId } : null;
      }
    }
  }
}
