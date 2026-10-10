import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** D44 — 지금 기록하는 이벤트(ASSIGNMENT_ENDED는 인사정보관리 ADR-STF-07). 늘릴 때는 근거 ADR과 admin-web 변경 이력 화면의 문구를 함께 고친다. */
export type AuditAction = 'ROLE_CHANGED' | 'RESIGNED' | 'ASSIGNED' | 'ASSIGNMENT_ENDED';

/**
 * 변경 이력 한 건 — D44. 변경과 **같은 대화형 트랜잭션 안에서** 부른다(data-integrity 체크리스트):
 * 변경이 롤백되면 이력도 남지 않고, 이력 쓰기가 실패하면 변경도 롤백된다.
 * before/after에는 바뀐 필드만 넣는다 — 전화번호 같은 개인정보를 이력에 복사하지 않는다.
 */
export async function recordAudit(
  tx: Tx,
  entry: {
    actorId: string;
    entity: 'Staff';
    entityId: string;
    action: AuditAction;
    before?: Prisma.InputJsonObject;
    after?: Prisma.InputJsonObject;
  },
): Promise<void> {
  await tx.auditLog.create({ data: entry });
}
