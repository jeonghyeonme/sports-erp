import { Prisma } from '@prisma/client';
import { recordAudit } from '../../prisma/audit';

// staff.service.ts와 같은 규칙 — @db.Date 컬럼에 KST 날짜를 그대로 넣는다.
const dateOf = (d: string) => new Date(`${d}T00:00:00Z`);

// 이 파일은 BranchService가 가져다 쓴다. staff.service.ts에 두면 branch.service → staff.service → document.service →
// BranchService로 import가 순환해 DI가 깨지므로, 무거운 의존이 없는 별도 파일로 둔다.

/**
 * 계약 종료 지점의 진행 중 파견 일괄 종료 — ADR-STF-07(entities.md §2-1 "파견 직원").
 * `BranchService.changeContractStatus`가 TERMINATED로 바꾼 **같은 트랜잭션 안에서** 부른다.
 * 직원마다 퇴사(ADR-STF-06)와 같은 방식으로 정리한다: 파견 endDate=오늘, 담당 회원 해제, 강사 프로필 연결 해제.
 * Staff.branchId는 그대로 둔다(NOT NULL, 본사 행 없음) — 활성 파견이 없는 재직 직원이 곧 "재배치 대기"이고,
 * 본사가 발령하면 종료 지점에서 빼내는 발령은 허용된다(ADR-STF-05). 계정은 건드리지 않는다(퇴사가 아니다).
 */
export async function endAssignmentsAtTerminatedBranch(
  tx: Prisma.TransactionClient,
  branchId: string,
  actorAccountId: string,
  today: string,
): Promise<{
  endedStaff: Array<{ id: string; staffCode: string; name: string }>;
  unassignedMembers: Array<{ id: string; name: string; staffId: string }>;
}> {
  const open = await tx.staffAssignment.findMany({
    where: { branchId, endDate: null },
    include: { staff: { select: { id: true, staffCode: true, name: true } } },
    orderBy: { staff: { staffCode: 'asc' } },
  });
  const staffIds = open.map((a) => a.staffId);
  if (staffIds.length === 0) return { endedStaff: [], unassignedMembers: [] };

  await tx.staffAssignment.updateMany({ where: { id: { in: open.map((a) => a.id) } }, data: { endDate: dateOf(today) } });
  const released = await tx.member.findMany({
    where: { assignedStaffId: { in: staffIds } },
    select: { id: true, name: true, assignedStaffId: true },
    orderBy: { memberNo: 'asc' },
  });
  await tx.member.updateMany({ where: { id: { in: released.map((m) => m.id) } }, data: { assignedStaffId: null } });
  await tx.instructor.updateMany({ where: { staffId: { in: staffIds } }, data: { staffId: null, isActive: false } });
  for (const a of open) {
    // D44 — 직원별 이력. 처리자는 계약 상태를 바꾼 본사 관리자다.
    await recordAudit(tx, {
      actorId: actorAccountId,
      entity: 'Staff',
      entityId: a.staffId,
      action: 'ASSIGNMENT_ENDED',
      before: { branchId },
      after: {
        reason: 'BRANCH_TERMINATED',
        endDate: today,
        releasedMemberCount: released.filter((m) => m.assignedStaffId === a.staffId).length,
      },
    });
  }
  return {
    endedStaff: open.map((a) => a.staff),
    unassignedMembers: released.map((m) => ({ id: m.id, name: m.name, staffId: m.assignedStaffId! })),
  };
}
