import { BranchContractStatus } from './types';

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

// 계약 종료일까지 남은(또는 지난) 일수를 사람이 읽는 문구로. contractEndAt이 없으면 상시계약으로 본다.
export function contractRemainingLabel(contractEndAt?: string): string {
  if (!contractEndAt) return '상시 계약';
  const diffDays = Math.ceil((new Date(contractEndAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (diffDays >= 0) return `${diffDays}일 남음`;
  return `${Math.abs(diffDays)}일 경과`;
}
