import { AxiosError } from 'axios';
import { ApiEnvelope } from './types';

// 공통 에러 포맷({ success:false, error:{ code, message } }, system-overview §4)의 error.code로 문구를 고른다.
// 서버 message는 관리자 화면 기준 문장이라 회원에게 그대로 보이지 않고, 모르는 code일 때만 쓴다.
const MESSAGES: Record<string, string> = {
  // 계약 종료 지점 차단(CLAUDE.md 불변식) — 과거 예약 조회는 그대로 된다.
  BRANCH_TERMINATED: '이 지점은 위탁운영 계약이 끝나 새 예약을 받지 않습니다. 지난 예약은 내 예약에서 볼 수 있습니다.',
  SLOT_FULL: '정원이 다 찼습니다. 다른 회차를 골라 주세요.',
  SLOT_ALREADY_STARTED: '이미 시작했거나 지난 회차입니다. 다른 회차를 골라 주세요.', // ADR-RSV-05
  ALREADY_RESERVED: '이미 예약한 회차입니다. 내 예약에서 확인하세요.',
  PROGRAM_NOT_RUNNING: '지금은 운영하지 않는 프로그램입니다.',
  NOT_RESERVABLE: '회차 예약을 받지 않는 프로그램입니다.',
  SLOT_NOT_FOUND: '회차를 찾을 수 없습니다. 목록을 새로고침해 주세요.',
  MEMBER_BRANCH_MISMATCH: '등록한 지점의 프로그램만 예약할 수 있습니다.',
  RESERVATION_NOT_FOUND: '예약을 찾을 수 없습니다.',
  RESERVATION_NOT_CANCELLABLE: '이미 취소됐거나 끝난 예약이라 취소할 수 없습니다.',
  POST_NOT_FOUND: '공지를 찾을 수 없습니다. 삭제됐거나 볼 수 없는 공지입니다.',
  MEMBER_FIELD_FORBIDDEN: '이 항목은 지점에서만 바꿀 수 있습니다.',
  PAYMENT_NOT_PENDING: '이미 결제했거나 결제할 수 없는 예약입니다. 내 예약에서 상태를 확인하세요.',
  // Worker(cloudflare-worker/src/index.ts)가 붙이는 코드 — 로그인 제한과 Lambda 동시 실행 상한(D37).
  RATE_LIMITED: '요청이 너무 잦습니다. 잠시 후 다시 시도하세요.',
  SERVER_BUSY: '이용자가 몰려 지금은 처리하지 못했습니다. 잠시 후 다시 시도하세요.',
};

// refresh까지 실패해 세션이 끝났을 때(api.ts 인터셉터) — 화면은 로그인으로 돌아가며 이 문구를 보여 준다.
export const SESSION_EXPIRED_MESSAGE = '로그인이 만료됐습니다. 다시 로그인해 주세요.';

export function errorCode(err: unknown): string | undefined {
  return (err as AxiosError<ApiEnvelope<unknown>>)?.response?.data?.error?.code;
}

export function describeError(err: unknown, fallback: string): string {
  const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
  const code = errorCode(err);
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (axiosErr?.isAxiosError && !axiosErr.response) return '네트워크에 연결할 수 없습니다. 연결을 확인하고 다시 시도하세요.';
  if (axiosErr?.response?.status === 401) return SESSION_EXPIRED_MESSAGE;
  return axiosErr?.response?.data?.error?.message ?? fallback;
}
