import { CsvColumn } from './csv';
import { AssetRow, AttendanceSummaryRow, DocumentRow, MemberRow, PaymentRow, ProgramRow, StaffRow } from './types';
import {
  ASSET_CATEGORY_LABEL,
  ASSET_STATUS_LABEL,
  ASSET_TYPE_LABEL,
  DOCUMENT_CATEGORY_LABEL,
  MEMBER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  PRICING_LABEL,
  PROGRAM_STATUS_LABEL,
} from './status-labels';

// M6 — CSV로 내보내는 열. 화면 표와 같은 열이고, 전화번호는 목록 API가 준 마스킹 값 그대로다(ADR-MEM-04).


export const MEMBER_COLUMNS: CsvColumn<MemberRow>[] = [
  { label: '지점', value: (m) => m.branchName },
  { label: '회원번호', value: (m) => m.memberNo },
  { label: '이름', value: (m) => m.name },
  { label: '연락처(마스킹)', value: (m) => m.phone },
  { label: '담당 직원', value: (m) => m.assignedStaffName ?? '회원권만(미배정)' },
  { label: '상태', value: (m) => MEMBER_STATUS_LABEL[m.status] ?? m.status },
  { label: '가입일', value: (m) => m.joinedAt },
];

export const ATTENDANCE_SUMMARY_COLUMNS: CsvColumn<AttendanceSummaryRow>[] = [
  { label: '이름', value: (s) => s.name },
  { label: '정상', value: (s) => s.normal },
  { label: '지각', value: (s) => s.late },
  { label: '결근', value: (s) => s.absent },
  { label: '조퇴', value: (s) => s.earlyLeave },
  { label: '휴가', value: (s) => s.onLeave },
];

const kst = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', hour12: false }).slice(0, 16) : '';

export const PAYMENT_COLUMNS: CsvColumn<PaymentRow>[] = [
  { label: '회원', value: (p) => p.memberName },
  { label: '프로그램', value: (p) => p.programName },
  { label: '구분', value: (p) => (p.kind === 'PT_PACKAGE' ? 'PT 패키지 구매' : '회차 예약') },
  { label: '공급가액', value: (p) => p.supplyAmount },
  { label: '부가세', value: (p) => p.vat },
  { label: '합계', value: (p) => p.amount },
  { label: '상태', value: (p) => PAYMENT_STATUS_LABEL[p.status] ?? p.status },
  { label: '승인번호', value: (p) => p.mockApprovalNo },
  { label: '승인 시각(KST)', value: (p) => kst(p.approvedAt) },
  { label: '환불 시각(KST)', value: (p) => kst(p.refundedAt) },
];

// ADR-AUTH-09 — 직원·자산·문서·프로그램. 직원 연락처·이메일과 문서 파일 주소는 넣지 않는다(파일 밖으로 내보내지 않는 값).
const STAFF_STATUS_LABEL: Record<NonNullable<StaffRow['status']>, string> = { ACTIVE: '재직', ON_LEAVE: '휴직', RESIGNED: '퇴사' };

export const STAFF_COLUMNS: CsvColumn<StaffRow>[] = [
  { label: '지점', value: (s) => s.branchName },
  { label: '직원코드', value: (s) => s.staffCode },
  { label: '이름', value: (s) => s.name },
  { label: '직급', value: (s) => s.position },
  { label: '고용형태', value: (s) => s.employmentType },
  { label: '입사일', value: (s) => s.hireDate },
  { label: '퇴사일', value: (s) => s.resignDate },
  { label: '상태', value: (s) => (s.status ? STAFF_STATUS_LABEL[s.status] : '') },
];

export const ASSET_COLUMNS: CsvColumn<AssetRow>[] = [
  { label: '지점', value: (a) => a.branchName },
  { label: '자산코드', value: (a) => a.assetCode },
  { label: '품명', value: (a) => a.name },
  { label: '분류', value: (a) => ASSET_CATEGORY_LABEL[a.category] ?? a.category },
  { label: '구분', value: (a) => ASSET_TYPE_LABEL[a.assetType] ?? a.assetType },
  { label: '수량', value: (a) => a.quantity },
  { label: '취득일', value: (a) => a.acquiredAt },
  { label: '취득가액', value: (a) => a.acquisitionCost },
  { label: '위치', value: (a) => a.location },
  { label: '상태', value: (a) => ASSET_STATUS_LABEL[a.status] ?? a.status },
];

export const DOCUMENT_COLUMNS: CsvColumn<DocumentRow>[] = [
  { label: '지점', value: (d) => d.branchName ?? '본사 공통' },
  { label: '제목', value: (d) => d.title },
  { label: '분류', value: (d) => DOCUMENT_CATEGORY_LABEL[d.category] ?? d.category },
  { label: '대상 직원', value: (d) => d.relatedStaffName },
  { label: '보존기한', value: (d) => d.retentionUntil },
  { label: '등록자', value: (d) => d.uploadedByName },
  { label: '등록일(KST)', value: (d) => kst(d.createdAt) },
];

export const PROGRAM_COLUMNS: CsvColumn<ProgramRow>[] = [
  { label: '지점', value: (p) => p.branchName },
  { label: '프로그램명', value: (p) => p.name },
  { label: '종목', value: (p) => p.category },
  { label: '이용방식', value: (p) => PRICING_LABEL[p.pricingType] ?? p.pricingType },
  { label: '가격', value: (p) => p.price },
  { label: '강사', value: (p) => p.instructorName },
  { label: '상태', value: (p) => PROGRAM_STATUS_LABEL[p.status] ?? p.status },
  { label: '시작일', value: (p) => p.startDate },
];
