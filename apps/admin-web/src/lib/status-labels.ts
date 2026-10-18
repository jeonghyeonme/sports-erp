import { MemberRow, PaymentStatus } from './types';

// log/125 F8 — 화면마다 영어 코드(ACTIVE·APPROVED 등)를 그대로 보이던 곳이 있었다. 여러 화면이 같이 쓰는 표시 이름은 여기 둔다.
export const MEMBER_STATUS_LABEL: Record<MemberRow['status'], string> = { ACTIVE: '활성', DORMANT: '휴면', WITHDRAWN: '탈퇴' };

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: '결제 대기',
  APPROVED: '승인',
  FAILED: '실패',
  REFUNDED: '환불',
};
