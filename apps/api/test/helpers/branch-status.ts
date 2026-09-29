import { BranchContractStatus, PrismaClient } from '@prisma/client';

/**
 * 지점 계약 상태를 테스트에서 바꾼다 — D29 이후 계약 상태의 원천은 DB라 mock 사본을 바꿔도 소용없다.
 * 바꾼 값은 setup/after-env.ts가 매 테스트 뒤에 원래대로 되돌린다(워커 전용 DB라 다른 스위트와는 섞이지 않는다).
 */
let client: PrismaClient | undefined;
const originals = new Map<string, BranchContractStatus>();

function db(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

export async function setBranchStatus(branchId: string, status: BranchContractStatus): Promise<void> {
  if (!originals.has(branchId)) {
    const current = await db().branch.findUniqueOrThrow({ where: { id: branchId }, select: { contractStatus: true } });
    originals.set(branchId, current.contractStatus);
  }
  await db().branch.update({ where: { id: branchId }, data: { contractStatus: status } });
}

export async function restoreBranchStatuses(): Promise<void> {
  for (const [branchId, status] of originals) {
    await db().branch.update({ where: { id: branchId }, data: { contractStatus: status } });
  }
  originals.clear();
}

export async function disconnectTestDb(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}
