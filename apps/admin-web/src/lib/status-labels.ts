import {
  AssetCategory,
  AssetStatus,
  AssetType,
  DocumentCategory,
  MemberRow,
  PaymentStatus,
  PricingType,
  ProgramStatus,
} from './types';

// log/125 F8 — 화면마다 영어 코드(ACTIVE·APPROVED 등)를 그대로 보이던 곳이 있었다. 여러 화면이 같이 쓰는 표시 이름은 여기 둔다.
export const MEMBER_STATUS_LABEL: Record<MemberRow['status'], string> = { ACTIVE: '활성', DORMANT: '휴면', WITHDRAWN: '탈퇴' };

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: '결제 대기',
  APPROVED: '승인',
  FAILED: '실패',
  REFUNDED: '환불',
};

// ADR-AUTH-09 — 화면과 CSV가 같이 쓰도록 각 화면에서 옮겨 왔다(log/203).
export const ASSET_CATEGORY_LABEL: Record<AssetCategory, string> = {
  EXERCISE_EQUIPMENT: '운동기구',
  SAFETY_EQUIPMENT: '안전설비',
  OFFICE_FURNITURE: '사무비품',
  OTHER: '기타',
};

export const ASSET_TYPE_LABEL: Record<AssetType, string> = { FIXED_ASSET: '고정자산', CONSUMABLE: '소모품' };

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  NORMAL: '정상',
  REPAIRING: '수리중',
  DISPOSAL_PENDING: '폐기대상',
  DISPOSED: '폐기됨',
};

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  HR_RECORD: '인사서류',
  MANUAL: '매뉴얼',
  OTHER: '기타',
};

export const PRICING_LABEL: Record<PricingType, string> = {
  FREE_ACCESS: '자유이용',
  PAID_SESSION: '회차 예약',
  PT_PACKAGE: 'PT 패키지',
};

export const PROGRAM_STATUS_LABEL: Record<ProgramStatus, string> = {
  PREPARING: '준비중',
  RUNNING: '진행중',
  PAUSED: '휴강',
  ENDED: '종료',
};
