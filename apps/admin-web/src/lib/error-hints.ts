// 화면별 도움말(log/089) — api 오류 코드(error.code) → "어떻게 하면 되는지" 한 줄.
// 서버 message는 "무엇이 안 됐는지"를 말하고, 여기 문구는 그 다음 행동을 말한다. 오류 문구 아래 줄(apiErrorMessage)과
// 화면 도움말 패널의 "자주 나는 오류" 목록이 이 표 하나를 같이 쓴다 — 문구를 고칠 곳이 한 곳이다.
// 표에 없는 코드는 해결 줄 없이 서버 message만 보인다.
export const ERROR_HINTS: Record<string, string> = {
  // 인증·계정
  INVALID_CREDENTIALS: '이메일과 비밀번호를 다시 확인하세요. 대소문자를 구분합니다.',
  ACCOUNT_INACTIVE: '비활성 계정입니다. 본사 관리자에게 계정 상태 확인을 요청하세요.',
  INVALID_REFRESH_TOKEN: '로그인 세션이 끝났습니다. 다시 로그인하세요.',
  EMAIL_ALREADY_EXISTS: '이미 쓰고 있는 이메일입니다. 다른 이메일을 넣으세요(퇴사자 이메일은 다시 쓸 수 있습니다).',

  // 지점 격리 — 다른 지점 데이터
  BRANCH_SCOPE_VIOLATION: '자기 지점 데이터만 볼 수 있습니다. 다른 지점 일은 본사 관리자에게 요청하세요.',
  MEMBER_SCOPE_VIOLATION: '다른 지점 회원입니다. 회원 목록에서 자기 지점 회원을 다시 고르세요.',
  STAFF_SCOPE_VIOLATION: '다른 지점 직원입니다. 직원 목록에서 자기 지점 직원을 다시 고르세요.',
  PROGRAM_SCOPE_VIOLATION: '다른 지점 프로그램입니다. 자기 지점 프로그램을 고르세요.',
  INSTRUCTOR_SCOPE_VIOLATION: '다른 지점 강사입니다. 자기 지점 강사를 고르세요.',
  FACILITY_SCOPE_VIOLATION: '다른 지점 시설입니다. 자기 지점 시설을 고르세요.',
  RESERVATION_SCOPE_VIOLATION: '다른 지점(또는 다른 회원)의 예약입니다. 목록을 새로고침해 다시 고르세요.',
  ATTENDANCE_SCOPE_VIOLATION: '다른 지점 근태 기록입니다. 자기 지점 신청만 처리할 수 있습니다.',
  POST_SCOPE_VIOLATION: '이 글을 볼 수 있는 지점이 아닙니다. 게시판 목록으로 돌아가세요.',
  ASSET_SCOPE_VIOLATION: '다른 지점 자산입니다. 이관이 필요하면 본사 관리자에게 요청하세요.',
  DOCUMENT_SCOPE_VIOLATION: '이 문서를 볼 수 있는 지점이 아닙니다. 본사 관리자에게 요청하세요.',
  POST_FORBIDDEN_ROLE: '이 역할로는 이 게시판 작업을 할 수 없습니다. 본사 공지는 본사 관리자가 씁니다.',
  MEMBER_FIELD_FORBIDDEN: '이 역할로는 바꿀 수 없는 항목입니다. 지점 관리자에게 요청하세요.',
  BRANCH_REQUIRED: '지점을 먼저 고르세요.',

  // 계약 종료(TERMINATED) 지점
  BRANCH_TERMINATED: '위탁계약이 종료된 지점이라 새 등록·예약·작성·파견이 막혀 있습니다. 과거 기록 조회만 됩니다.',

  // 지점 불일치
  MEMBER_BRANCH_MISMATCH: '회원과 프로그램(또는 직원)의 지점이 다릅니다. 같은 지점 것을 고르세요.',
  STAFF_BRANCH_MISMATCH: '담당 직원이 이 회원의 지점에 파견돼 있지 않습니다. 같은 지점 직원을 고르세요.',
  PROGRAM_BRANCH_MISMATCH: '프로그램이 다른 지점 것입니다. 같은 지점 프로그램을 고르세요.',
  INSTRUCTOR_BRANCH_MISMATCH: '강사가 다른 지점 소속입니다. 같은 지점 강사를 고르세요.',
  FACILITY_BRANCH_MISMATCH: '시설이 다른 지점 것입니다. 같은 지점 시설을 고르세요.',

  // 찾을 수 없음 — 대개 다른 화면에서 지워졌거나 바뀐 경우
  BRANCH_NOT_FOUND: '지점이 없습니다. 대시보드에서 지점을 다시 고르세요.',
  MEMBER_NOT_FOUND: '회원이 없습니다. 회원 목록을 새로고침하세요.',
  STAFF_NOT_FOUND: '직원이 없습니다. 직원 목록을 새로고침하세요.',
  PROGRAM_NOT_FOUND: '프로그램이 없습니다. 프로그램 목록을 새로고침하세요.',
  INSTRUCTOR_NOT_FOUND: '강사가 없습니다. 강사 목록을 새로고침하세요.',
  FACILITY_NOT_FOUND: '시설이 없습니다. 시설 목록을 새로고침하세요.',
  RESERVATION_NOT_FOUND: '예약이 없습니다. 예약 목록을 새로고침하세요.',
  SLOT_NOT_FOUND: '회차가 없습니다. 프로그램을 다시 골라 회차 목록을 새로 받으세요.',
  POST_NOT_FOUND: '삭제된 글입니다. 게시판 목록으로 돌아가세요.',
  ASSET_NOT_FOUND: '자산이 없습니다. 자산 목록을 새로고침하세요.',
  DOCUMENT_NOT_FOUND: '삭제된 문서입니다. 문서함을 새로고침하세요.',
  LEAVE_REQUEST_NOT_FOUND: '휴가 신청이 없습니다. 근태관리 화면을 새로고침하세요.',
  PT_SESSION_NOT_FOUND: 'PT 패키지가 없습니다. 회원 상세를 새로고침하세요.',
  STAFF_RECORD_REQUIRED: '이 계정에 직원 기록이 연결돼 있지 않습니다. 본사 관리자에게 확인을 요청하세요.',
  STAFF_REQUIRED: '직원 계정만 할 수 있는 작업입니다.',
  MEMBER_REQUIRED: '회원 계정만 할 수 있는 작업입니다.',

  // 입력값
  VALIDATION_ERROR: '* 표시 항목을 채우고 형식(날짜 YYYY-MM-DD, 숫자 등)을 확인하세요.',
  INVALID_DATE_RANGE: '종료일이 시작일보다 앞설 수 없습니다. 날짜를 다시 고르세요.',
  INVALID_CAPACITY: '정원은 1 이상이어야 합니다.',
  INVALID_CURRENT_COUNT: '현재 인원은 0 이상, 정원 이하로 넣으세요.',
  INVALID_QUANTITY: '수량은 1 이상이어야 합니다.',
  RETENTION_UNTIL_REQUIRED: '이 분류의 문서는 보존기한이 필요합니다. 보존기한을 넣으세요.',

  // 상태 전환
  INVALID_STATUS_TRANSITION: '지금 상태에서는 그 상태로 바꿀 수 없습니다. 화면에 보이는 전환 버튼만 쓰세요.',
  STAFF_ALREADY_RESIGNED: '이미 퇴사 처리된 직원입니다.',
  LEAVE_REQUEST_ALREADY_REVIEWED: '이미 승인·반려된 신청입니다. 화면을 새로고침하세요.',

  // 근태
  ALREADY_CHECKED_IN: '오늘은 이미 체크인했습니다. 퇴근할 때 체크아웃을 누르세요.',
  ALREADY_CHECKED_OUT: '오늘은 이미 체크아웃했습니다. 정정이 필요하면 지점 관리자에게 요청하세요.',
  NOT_CHECKED_IN: '체크인을 먼저 하세요.',

  // 프로그램·예약·결제
  PROGRAM_NOT_RUNNING: '운영 중인 프로그램이 아닙니다. 프로그램 상태를 "운영 중"으로 바꾼 뒤 다시 하세요.',
  PROGRAM_CAPACITY_REQUIRED: '프로그램에 정원이 없습니다. 회차 정원을 직접 넣거나 프로그램 정원을 먼저 정하세요.',
  SLOT_NOT_APPLICABLE: '회차 예약형(PAID_SESSION) 프로그램만 회차를 둘 수 있습니다.',
  NOT_RESERVABLE: '예약할 수 없는 프로그램입니다. 회차 예약형 프로그램을 고르세요.',
  SLOT_ALREADY_STARTED: '이미 시작한 회차는 예약할 수 없습니다. 다음 회차를 고르세요.',
  SLOT_FULL: '정원이 찼습니다. 다른 회차를 고르세요.',
  ALREADY_RESERVED: '이미 예약한 회차입니다. 내 예약 목록에서 확인하세요.',
  RESERVATION_NOT_CANCELLABLE: '이미 취소됐거나 이용이 끝난 예약입니다. 목록을 새로고침하세요.',
  RESERVATION_NOT_CONFIRMED: '확정(결제 완료)된 예약만 체크인할 수 있습니다. 결제부터 확인하세요.',
  PAYMENT_NOT_PENDING: '이미 결제됐거나 취소된 예약입니다. 목록을 새로고침하세요.',
  PT_SESSION_EXHAUSTED: '남은 PT 세션이 없습니다. 새 PT 패키지를 등록하세요.',

  // 회원 연동(회원 웹)
  GUARDIAN_CONSENT_REQUIRED: '만 19세 미만 회원은 법정대리인 동의 확인란을 체크해야 등록됩니다.',
  MEMBER_ALREADY_LINKED: '이미 다른 계정과 연동된 회원입니다.',
  MEMBER_LINK_MISMATCH: '이름·연락처가 등록 정보와 다릅니다. 지점에 등록된 정보를 확인하세요.',
  LINK_ATTEMPTS_EXCEEDED: '연동 시도가 너무 많습니다. 잠시 뒤 다시 하거나 지점에 문의하세요.',

  // 서버·네트워크
  RATE_LIMITED: '요청이 너무 잦습니다. 잠시 뒤 다시 하세요.',
  SERVER_BUSY: '요청이 몰렸습니다. 잠시 뒤 다시 하세요.',
  UPSTREAM_UNAVAILABLE: '서버가 깨어나는 중이거나 잠시 닿지 않습니다. 몇 초 뒤 다시 하세요.',
  INTERNAL_ERROR: '서버 오류입니다. 같은 작업을 한 번 더 하고, 계속되면 관리자에게 알리세요.',
  FORBIDDEN_ORIGIN: '정해진 주소로만 접속할 수 있습니다. 북마크한 주소로 다시 들어오세요.',
};

export function errorHint(code: string | undefined): string | undefined {
  return code ? ERROR_HINTS[code] : undefined;
}
