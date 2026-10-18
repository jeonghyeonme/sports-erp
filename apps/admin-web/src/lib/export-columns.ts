import { CsvColumn } from './csv';
import { AttendanceSummaryRow, MemberRow, PaymentRow } from './types';
import { MEMBER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from './status-labels';

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
  { label: '공급가액', value: (p) => p.supplyAmount },
  { label: '부가세', value: (p) => p.vat },
  { label: '합계', value: (p) => p.amount },
  { label: '상태', value: (p) => PAYMENT_STATUS_LABEL[p.status] ?? p.status },
  { label: '승인번호', value: (p) => p.mockApprovalNo },
  { label: '승인 시각(KST)', value: (p) => kst(p.approvedAt) },
  { label: '환불 시각(KST)', value: (p) => kst(p.refundedAt) },
];
