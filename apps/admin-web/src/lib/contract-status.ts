import { AuditLogRow, BranchContractStatus, ContractFileKind } from './types';

export const CONTRACT_STATUS_LABEL: Record<BranchContractStatus, string> = {
  ACTIVE: '계약 정상',
  RENEWAL_DUE: '갱신 임박',
  EXPIRED: '계약 만료',
  TERMINATED: '계약 종료',
};

// 대시보드/지점 상세에서 공통으로 쓰는 "조치가 필요한 지점" 우선순위 — 만료 > 갱신임박 > 정상 > 종료.
export const CONTRACT_STATUS_RANK: Record<BranchContractStatus, number> = {
  EXPIRED: 0,
  RENEWAL_DUE: 1,
  ACTIVE: 2,
  TERMINATED: 3,
};

// 계약 종료일까지 남은(또는 지난) 일수를 사람이 읽는 문구로. 일수는 서버가 KST로 계산한다(D68).
// D69 결정 5 — 종료일이 지나도 상태는 그대로이고 "기간 종료"로 표시만 한다(종료 확정은 본사가 해지 합의서로).
export function contractRemainingLabel(contractDaysLeft: number): string {
  if (contractDaysLeft >= 0) return `${contractDaysLeft}일 남음`;
  return `기간 종료(${Math.abs(contractDaysLeft)}일 경과)`;
}

// D68 — 계약 이력(변경 이력 entity 'Branch') — 지점 등록이 첫 줄. 지점 상세의 계약 이력과 변경 이력 화면이 같은 문구를 쓴다.
// D69 — 계약 파일 올리기·교체와 열람 기록이 더해졌다.
export const CONTRACT_ACTION_LABEL: Record<string, string> = {
  BRANCH_CREATED: '지점 등록',
  CONTRACT_RENEWED: '계약 갱신',
  CONTRACT_CORRECTED: '계약 정보 정정',
  CONTRACT_STATUS_CHANGED: '계약 상태 변경',
  CONTRACT_FILE_UPLOADED: '계약 파일 등록',
  CONTRACT_FILE_REPLACED: '계약 파일 교체',
  CONTRACT_FILE_VIEWED: '계약 파일 열람',
};

export const CONTRACT_FILE_KIND_LABEL: Record<ContractFileKind, string> = {
  CONTRACT: '계약서',
  TERMINATION_AGREEMENT: '해지 합의서',
};

const CONTRACT_FIELD_LABEL: Record<string, string> = {
  contractPartner: '상대방',
  contractStartAt: '시작일',
  contractEndAt: '종료일',
};

export function describeContractChange(r: AuditLogRow): string {
  const before = r.before ?? {};
  const after = r.after ?? {};
  const status = (v: unknown) => CONTRACT_STATUS_LABEL[v as BranchContractStatus] ?? String(v);
  const field = (k: string) => `${CONTRACT_FIELD_LABEL[k] ?? k} ${String(before[k] ?? '없음')} → ${String(after[k] ?? '없음')}`;
  const round = (v: Record<string, unknown>) => (v.roundNo ? `${String(v.roundNo)}회차 · ` : '');
  if (r.action === 'BRANCH_CREATED') {
    return `코드 ${String(after.code)} · ${String(after.contractPartner)} · ${String(after.contractStartAt)} ~ ${String(after.contractEndAt ?? '-')}`;
  }
  if (r.action === 'CONTRACT_STATUS_CHANGED') return `${round(after)}${status(before.contractStatus)} → ${status(after.contractStatus)}`;
  if (r.action === 'CONTRACT_RENEWED') {
    return `${String(before.roundNo ?? '')}→${String(after.roundNo ?? '')}회차 · ${String(after.contractPartner ?? '')} · ${String(
      after.contractStartAt ?? '',
    )} ~ ${String(after.contractEndAt)} · ${status(before.contractStatus)} → ${status(after.contractStatus)}`;
  }
  if (r.action === 'CONTRACT_CORRECTED') {
    return round(after) + Object.keys(after).filter((k) => k !== 'roundNo').map(field).join(' · ');
  }
  if (r.action.startsWith('CONTRACT_FILE_')) {
    return `${round(after)}${CONTRACT_FILE_KIND_LABEL[after.kind as ContractFileKind] ?? String(after.kind)} · ${String(after.fileName)}`;
  }
  return '-';
}
