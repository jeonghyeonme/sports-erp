import { BranchContractStatus, CodeSequenceKind, Prisma } from '@prisma/client';
import { todayKst } from '../common/date/kst-date';

/**
 * 데이터 정합성 공용 헬퍼 — docs/architecture/data-integrity.md DI-03.
 *
 * 둘 다 **대화형 트랜잭션(prisma.$transaction(async (tx) => ...)) 안에서만** 부른다. 락은 트랜잭션이
 * 끝날 때 풀리므로, 트랜잭션 밖에서 부르면 잠그자마자 풀려 아무것도 보호하지 못한다.
 * 도메인을 MockDataService에서 Prisma로 옮길 때 mock의 "개수+1" 채번과 무잠금 정원 검사를
 * 이 함수들로 바꾼다(각 도메인이 따로 구현하면 같은 결함을 도메인마다 다르게 다시 만든다 — ADR-STF-02).
 */

type Tx = Prisma.TransactionClient;

const PAD = 3;

/**
 * 채번 — ADR-STF-02(지점별 시퀀스 행 + 행 락). 다음 순번을 원자적으로 받아 온다.
 *
 * 처음엔 "SELECT ... FOR UPDATE로 시퀀스 행을 잠그고 +1"로 설계했지만, 그 방식은 **그 prefix의 첫 채번**
 * (새 지점, 해가 바뀐 memberNo)에서 잠글 행이 아직 없어 두 트랜잭션이 동시에 통과한다 — ADR-RSV-01이
 * 논파한 팬텀 삽입과 같은 구멍이다. INSERT ... ON CONFLICT DO UPDATE는 행이 없으면 만들고, 있으면
 * 그 행을 잠근 채 증가시켜 두 경우 모두 한 문장으로 직렬화한다.
 */
export async function allocateSequence(
  tx: Tx,
  branchId: string,
  kind: CodeSequenceKind,
  prefix: string,
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ lastValue: number }>>`
    INSERT INTO "CodeSequence" ("branchId", "kind", "prefix", "lastValue")
    VALUES (${branchId}, ${kind}::"CodeSequenceKind", ${prefix}, 1)
    ON CONFLICT ("branchId", "kind", "prefix")
    DO UPDATE SET "lastValue" = "CodeSequence"."lastValue" + 1
    RETURNING "lastValue"`;
  return rows[0].lastValue;
}

/**
 * 예전 mock의 generateStaffCode/generateMemberNo/generateAssetCode(D36으로 mock 삭제)와 같은 형식을 만든다.
 * MEMBER의 연도는 todayKst() 기준 — mock은 new Date().getFullYear()(호스트 시간대)라 서버가 UTC면
 * 1월 1일 00:00~08:59 KST에 전년도 번호가 나온다(date-time-handling.md와 같은 뿌리).
 */
export async function allocateBranchCode(
  tx: Tx,
  branch: { id: string; code: string },
  kind: CodeSequenceKind,
): Promise<string> {
  const prefix =
    kind === 'STAFF' ? `${branch.code}-` : kind === 'MEMBER' ? `${branch.code}${todayKst().slice(0, 4)}` : `${branch.code}-A`;
  const seq = await allocateSequence(tx, branch.id, kind, prefix);
  const padded = String(seq).padStart(PAD, '0');
  return kind === 'MEMBER' ? `${prefix}-${padded}` : `${prefix}${padded}`;
}

/**
 * 회차 행 락 — ADR-RSV-01. 정원 검사(활성 예약 COUNT) 전에 회차 행을 FOR UPDATE로 잠근다.
 * 예약 행을 잠그는 방식(COUNT ... FOR UPDATE)은 예약이 0건인 신규 회차에서 잠글 대상이 없어
 * 동시 요청이 모두 통과한다. 회차 행은 예약 수와 무관하게 항상 있으므로 반드시 직렬화된다.
 * 없는 회차면 null.
 */
export async function lockScheduleSlot(
  tx: Tx,
  slotId: string,
): Promise<{ id: string; capacity: number } | null> {
  const rows = await tx.$queryRaw<Array<{ id: string; capacity: number }>>`
    SELECT "id", "capacity" FROM "ScheduleSlot" WHERE "id" = ${slotId} FOR UPDATE`;
  return rows[0] ?? null;
}

/** ADR-RSV-02와 같은 "활성 예약" 정의(부분 unique 인덱스의 WHERE 절과 동일). */
export const ACTIVE_RESERVATION_STATUSES = ['REQUESTED', 'CONFIRMED'] as const;

/**
 * 지점 행 공유 락 — ADR-STF-07. 채용·파견 발령이 대상 지점의 계약 상태를 읽을 때 쓴다.
 * 계약 종료 전이(`BranchService.changeContractStatus`)는 같은 행을 FOR UPDATE로 잠그므로 둘이 직렬화된다:
 * 발령이 먼저 잠그면 종료 전이는 발령 커밋을 기다렸다가 그 새 파견까지 종료하고, 종료가 먼저면 발령은 커밋된
 * TERMINATED를 읽고 409를 낸다. 락 없이 읽으면 "ACTIVE로 읽은 발령"이 종료 뒤에 커밋돼 종료 지점에 활성 파견이 남는다.
 * 공유 락이라 같은 지점으로의 발령끼리는 서로 막지 않는다. 없는 지점이면 null.
 */
export async function lockBranchForShare(
  tx: Tx,
  branchId: string,
): Promise<{ id: string; code: string; contractStatus: BranchContractStatus } | null> {
  const rows = await tx.$queryRaw<Array<{ id: string; code: string; contractStatus: BranchContractStatus }>>`
    SELECT "id", "code", "contractStatus" FROM "Branch" WHERE "id" = ${branchId} FOR SHARE`;
  return rows[0] ?? null;
}
