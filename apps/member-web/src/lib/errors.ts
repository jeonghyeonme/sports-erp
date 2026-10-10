import { AxiosError } from 'axios';
import { ApiEnvelope } from './types';

// 공통 에러 포맷({ success:false, error:{ code, message } }, system-overview §4)의 error.code로 문구를 고른다.
// 서버 message는 관리자 화면 기준 문장이라 회원에게 그대로 보이지 않고, 모르는 code일 때만 쓴다.
// log/098 — 관리자 웹(admin-web lib/error-hints.ts, log/089)처럼 "무엇이 안 됐는지"(message)와 "어떻게 하면 되는지"(hint)를
// 나눠 두고, 화면에는 message 아래 "해결: …" 한 줄로 보인다. hint가 없으면 message만 보인다.
const MESSAGES: Record<string, { message: string; hint?: string }> = {
  // 로그인·계정
  INVALID_CREDENTIALS: { message: '이메일 또는 비밀번호가 맞지 않습니다.', hint: '대소문자를 구분합니다. 다시 확인해 주세요.' },
  ACCOUNT_INACTIVE: { message: '이용할 수 없는 계정입니다.', hint: '등록한 지점에 계정 상태를 문의해 주세요.' },
  // 계약 종료 지점 차단(CLAUDE.md 불변식) — 과거 예약 조회는 그대로 된다.
  BRANCH_TERMINATED: {
    message: '이 지점은 위탁운영 계약이 끝나 새 예약·가입을 받지 않습니다.',
    hint: '지난 예약은 내 예약에서 볼 수 있습니다.',
  },
  SLOT_FULL: { message: '정원이 다 찼습니다.', hint: '다른 회차를 골라 주세요.' },
  SLOT_ALREADY_STARTED: { message: '이미 시작했거나 지난 회차입니다.', hint: '다른 회차를 골라 주세요.' }, // ADR-RSV-05
  ALREADY_RESERVED: { message: '이미 예약한 회차입니다.', hint: '내 예약에서 확인하세요.' },
  PROGRAM_NOT_RUNNING: { message: '지금은 운영하지 않는 프로그램입니다.', hint: '예약하기에서 다른 프로그램을 골라 주세요.' },
  NOT_RESERVABLE: { message: '회차 예약을 받지 않는 프로그램입니다.', hint: '수강 신청은 지점에 문의해 주세요.' },
  SLOT_NOT_FOUND: { message: '회차를 찾을 수 없습니다.', hint: '아래로 당겨 목록을 새로고침해 주세요.' },
  MEMBER_BRANCH_MISMATCH: { message: '다른 지점의 프로그램입니다.', hint: '등록한 지점의 프로그램만 예약할 수 있습니다.' },
  RESERVATION_NOT_FOUND: { message: '예약을 찾을 수 없습니다.', hint: '내 예약을 새로고침해 주세요.' },
  RESERVATION_NOT_CANCELLABLE: {
    message: '이미 취소됐거나 끝난 예약이라 취소할 수 없습니다.',
    hint: '내 예약을 새로고침해 상태를 확인하세요.',
  },
  PAYMENT_NOT_PENDING: { message: '이미 결제했거나 결제할 수 없는 예약입니다.', hint: '내 예약에서 상태를 확인하세요.' },
  POST_NOT_FOUND: { message: '공지를 찾을 수 없습니다.', hint: '삭제됐거나 볼 수 없는 공지입니다. 공지 목록으로 돌아가 주세요.' },
  MEMBER_FIELD_FORBIDDEN: { message: '이 항목은 지점에서만 바꿀 수 있습니다.', hint: '바꾸려면 등록한 지점에 요청해 주세요.' },
  // 비밀번호 변경(log/091) — 401이 아니라 400이라 세션 만료로 처리되지 않는다.
  CURRENT_PASSWORD_MISMATCH: { message: '현재 비밀번호가 맞지 않습니다.', hint: '대소문자를 구분합니다. 다시 확인해 주세요.' },
  DEMO_ACCOUNT_LOCKED: { message: '데모 계정은 비밀번호를 바꿀 수 없습니다.', hint: '여러 사람이 같이 쓰는 시연용 계정입니다.' },
  // 가입·연동(log/092, ADR-MEM-01·02)
  EMAIL_ALREADY_EXISTS: { message: '이미 가입된 이메일입니다.', hint: '로그인하거나 다른 이메일을 써 주세요.' },
  GUARDIAN_CONSENT_REQUIRED: {
    message: '만 19세 미만은 법정대리인 동의가 필요합니다.',
    hint: '동의 항목에 체크한 뒤 다시 가입해 주세요.',
  },
  MEMBER_LINK_MISMATCH: {
    message: '회원번호 또는 전화번호가 지점에 등록된 정보와 다릅니다.',
    hint: '등록할 때 받은 회원번호와 지점에 알려 준 전화번호를 확인해 주세요.',
  },
  MEMBER_ALREADY_LINKED: { message: '이미 앱 계정과 연결된 회원입니다.', hint: '그 계정으로 로그인해 주세요.' },
  LINK_ATTEMPTS_EXCEEDED: { message: '연동 시도가 너무 많습니다.', hint: '1시간 뒤에 다시 시도하거나 지점에 문의해 주세요.' },
  BRANCH_NOT_FOUND: { message: '지점을 찾을 수 없습니다.', hint: '지점을 다시 골라 주세요.' },
  // 서버 검증 문구(어느 칸이 왜 틀렸는지)는 회원에게도 그대로 읽히므로 message는 서버 것을 쓰고 hint만 붙인다.
  VALIDATION_ERROR: { message: '', hint: '입력한 내용을 확인하고 다시 시도해 주세요.' },
  // Worker(cloudflare-worker/src/index.ts)가 붙이는 코드 — 로그인 제한과 Lambda 동시 실행 상한(D37).
  RATE_LIMITED: { message: '요청이 너무 잦습니다.', hint: '1분쯤 기다렸다가 다시 시도하세요.' },
  SERVER_BUSY: { message: '이용자가 몰려 지금은 처리하지 못했습니다.', hint: '잠시 후 다시 시도하세요.' },
};

const NETWORK = { message: '네트워크에 연결할 수 없습니다.', hint: '와이파이나 데이터 연결을 확인하고 다시 시도하세요.' };

// refresh까지 실패해 세션이 끝났을 때(api.ts 인터셉터) — 화면은 로그인으로 돌아가며 이 문구를 보여 준다.
export const SESSION_EXPIRED_MESSAGE = '로그인이 만료됐습니다. 다시 로그인해 주세요.';

export function errorCode(err: unknown): string | undefined {
  return (err as AxiosError<ApiEnvelope<unknown>>)?.response?.data?.error?.code;
}

function withHint(message: string, hint?: string): string {
  return hint ? `${message}\n해결: ${hint}` : message;
}

/** 화면에 보일 오류 문구 — "무엇이 안 됐는지" 한 줄 + 있으면 "해결: …" 한 줄(줄바꿈은 CSS pre-line으로 보인다). */
export function describeError(err: unknown, fallback: string): string {
  const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
  const code = errorCode(err);
  const known = code ? MESSAGES[code] : undefined;
  const serverMessage = axiosErr?.response?.data?.error?.message;
  if (known) return withHint(known.message || serverMessage || fallback, known.hint);
  if (axiosErr?.isAxiosError && !axiosErr.response) return withHint(NETWORK.message, NETWORK.hint);
  if (axiosErr?.response?.status === 401) return SESSION_EXPIRED_MESSAGE;
  return serverMessage ?? fallback;
}
