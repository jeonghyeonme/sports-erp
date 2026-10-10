import { Prisma } from '@prisma/client';
import { RequestUser } from '../common/interfaces/request-user.interface';

type Tx = Prisma.TransactionClient;

/**
 * D44 — 지금 기록하는 이벤트(ASSIGNMENT_ENDED는 인사정보관리 ADR-STF-07, PHONE_VIEWED는 D47).
 * 늘릴 때는 근거 ADR과 admin-web 변경 이력 화면의 문구를 함께 고친다.
 */
export type AuditAction = 'ROLE_CHANGED' | 'RESIGNED' | 'ASSIGNED' | 'ASSIGNMENT_ENDED' | 'PHONE_VIEWED';
export type AuditEntity = 'Staff' | 'Member';

/**
 * 변경 이력 한 건 — D44. 변경과 **같은 대화형 트랜잭션 안에서** 부른다(data-integrity 체크리스트):
 * 변경이 롤백되면 이력도 남지 않고, 이력 쓰기가 실패하면 변경도 롤백된다.
 * before/after에는 바뀐 필드만 넣는다 — 전화번호 같은 개인정보를 이력에 복사하지 않는다.
 */
export async function recordAudit(
  tx: Tx,
  entry: {
    actorId: string;
    entity: AuditEntity;
    entityId: string;
    action: AuditAction;
    before?: Prisma.InputJsonObject;
    after?: Prisma.InputJsonObject;
  },
): Promise<void> {
  await tx.auditLog.create({ data: entry });
}

/**
 * D47 — 상세 화면 전화번호(원문) 열람 기록. 관리자(SUPER_ADMIN·BRANCH_ADMIN)가 남의 상세를 열 때만 남긴다.
 * 본인 조회(회원 웹 내 정보·직원 본인)와 번호가 비어 있는 상세는 드러난 원문이 없어 남기지 않는다.
 * 응답 전에 쓴다 — 기록이 실패하면 상세도 실패한다(기록 없이 원문을 내보내지 않는다).
 * after에는 열람 당시 지점만 둔다(지점별로 거를 때 쓴다). 번호 자체는 넣지 않는다(D44 결정 4).
 */
export async function recordPhoneView(
  db: Tx,
  viewer: RequestUser,
  target: { entity: AuditEntity; id: string; branchId: string; phone?: string | null },
): Promise<void> {
  if (!target.phone) return;
  if (viewer.role !== 'SUPER_ADMIN' && viewer.role !== 'BRANCH_ADMIN') return;
  if (target.entity === 'Staff' && viewer.staffId === target.id) return;
  await recordAudit(db, {
    actorId: viewer.accountId,
    entity: target.entity,
    entityId: target.id,
    action: 'PHONE_VIEWED',
    after: { branchId: target.branchId },
  });
}
