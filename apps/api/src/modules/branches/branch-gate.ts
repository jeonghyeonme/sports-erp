/**
 * 계약 종료(TERMINATED) 지점 판정 — D29(2-1_기술결정사항.md) 결정 2.
 *
 * 계약 상태의 원천은 DB(Prisma Branch) 하나뿐이다. 아직 mock인 도메인의 쓰기 메서드는 동기라 DB를 직접 못 읽으므로,
 * 컨트롤러가 요청마다 BranchService.loadGate()로 종료 지점 집합을 한 번 읽어 이 객체를 넘긴다. mock 메서드는
 * 예전에 `branch.contractStatus === 'TERMINATED'`를 검사하던 **바로 그 자리**에서 isTerminated()를 불러,
 * 에러 판정 순서가 이관 전과 같다. 인자가 필수라 넘기지 않으면 컴파일 에러다.
 *
 * 한계: 읽은 뒤 쓰기 전 사이에 계약 상태가 바뀌는 경합은 막지 못한다(계약 상태 변경은 본사의 드문 수동 조치라 감수).
 * 도메인을 Prisma로 옮기면 그 도메인은 트랜잭션 안에서 지점을 직접 읽고 이 gate를 쓰지 않는다.
 */
export interface BranchGate {
  isTerminated(branchId: string): boolean;
}

export function branchGateFrom(terminatedBranchIds: Iterable<string>): BranchGate {
  const terminated = new Set(terminatedBranchIds);
  return { isTerminated: (branchId) => terminated.has(branchId) };
}
