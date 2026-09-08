interface BranchScoped {
  branchId: string;
  branchName?: string;
}

export interface BranchGroup<T> {
  branchId: string;
  branchName: string;
  rows: T[];
}

// 지점 횡단 목록(회원/직원/프로그램/시설)을 지점별 섹션으로 묶는다.
// BRANCH_ADMIN/STAFF처럼 API가 이미 한 지점으로 필터링해서 내려주면 그룹도 자연히 하나만 남는다.
export function groupByBranch<T extends BranchScoped>(rows: T[]): BranchGroup<T>[] {
  const groups = new Map<string, BranchGroup<T>>();
  for (const row of rows) {
    const existing = groups.get(row.branchId);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(row.branchId, {
        branchId: row.branchId,
        branchName: row.branchName ?? row.branchId,
        rows: [row],
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.branchName.localeCompare(b.branchName, 'ko'));
}
