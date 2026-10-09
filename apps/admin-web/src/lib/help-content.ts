import { Role } from './types';

// 화면별 도움말(log/089, RFP 온라인 도움말) — 상단 "도움말" 버튼이 여는 오른쪽 패널의 내용.
// 같은 화면이라도 역할마다 할 수 있는 일이 달라(권한관리 A-7) 단계는 역할별로 쓴다. 역할이 빠져 있으면 common만 보인다.
// errors는 그 화면에서 자주 나는 api 오류 코드 — 해결 문구는 error-hints.ts 한 곳에서 가져온다.
export interface ScreenHelp {
  title: string;
  summary: string;
  common?: string[];
  byRole?: Partial<Record<Role, string[]>>;
  errors: string[];
}

interface HelpRoute {
  // '/members/:id'처럼 쓰면 :부분은 아무 값과 맞는다. 위에서부터 처음 맞는 것을 쓴다.
  path: string;
  help: ScreenHelp;
}

const HELP_ROUTES: HelpRoute[] = [
  {
    path: '/',
    help: {
      title: '대시보드',
      summary: '볼 수 있는 지점의 현황(회원·직원·진행 중 프로그램·계약 상태)을 한눈에 봅니다.',
      byRole: {
        SUPER_ADMIN: [
          '위쪽 숫자 카드에서 전체 지점·직원 수와 "계약 갱신 임박 지점"을 확인합니다.',
          '갱신 임박 카드를 누르면 그 지점들만 걸러 보입니다.',
          '지점명으로 검색하거나 지역 묶음을 펼쳐 지점을 찾습니다.',
          '지점 행을 누르면 지점 상세(직원 → 회원, 프로그램 → 혼잡도)로 들어갑니다.',
        ],
        BRANCH_ADMIN: ['내 지점 카드에서 회원 수·직원 수·진행 중 프로그램을 확인합니다.', '카드를 누르면 지점 상세로 들어갑니다.'],
        STAFF: ['내 지점 카드에서 현황을 확인합니다.', '카드를 누르면 지점 상세로 들어갑니다.'],
        MEMBER: ['등록한 지점의 현황을 확인합니다. 예약은 왼쪽 메뉴 "예약"에서 합니다.'],
      },
      errors: ['BRANCH_SCOPE_VIOLATION', 'UPSTREAM_UNAVAILABLE'],
    },
  },
  {
    path: '/branches/:branchId',
    help: {
      title: '지점 상세',
      summary: '한 위탁 현장의 계약 정보와 소속 직원·회원·프로그램·시설 혼잡도를 봅니다.',
      common: [
        '맨 위에서 계약상대방·계약 기간·계약 상태(정상/갱신임박/만료/종료)를 확인합니다.',
        '직원 탭에서 직원 행을 펼치면 그 직원이 담당하는 회원이 그때 불러와집니다.',
        '"담당 직원 없음" 묶음은 회원권만 있고 트레이너가 배정되지 않은 회원입니다.',
        '프로그램·혼잡도 탭에서 운영 중인 프로그램과 시설별 현재 인원을 봅니다.',
        '계약이 종료된 지점은 조회만 됩니다. 미처리 자산 경고가 보이면 자산·비품에서 폐기·이관하세요.',
      ],
      errors: ['BRANCH_NOT_FOUND', 'BRANCH_SCOPE_VIOLATION', 'BRANCH_TERMINATED'],
    },
  },
  {
    path: '/members/:id',
    help: {
      title: '회원 상세',
      summary: '회원 한 명의 정보·상태·수강 내역·PT 패키지·예약 결제 내역을 관리합니다.',
      byRole: {
        BRANCH_ADMIN: [
          '"정보 수정"으로 연락처·담당 직원·메모를 고치고 저장합니다.',
          '상태 버튼("…(으)로 전환")으로 휴면·탈퇴 등 회원 상태를 바꿉니다.',
          '수강내역 탭 → "+ 수강 등록"에서 프로그램과 등록일을 넣습니다.',
          'PT 탭 → "+ PT 패키지 등록"에서 세션 수·구매일을 넣고, 수업 후 "세션 사용"을 누릅니다.',
          '예약·결제 내역 탭에서 이 회원의 예약과 결제 상태를 확인합니다.',
        ],
        SUPER_ADMIN: ['회원 정보와 내역을 조회합니다. 등록·수정은 그 지점 관리자가 합니다.'],
      },
      errors: [
        'MEMBER_NOT_FOUND',
        'MEMBER_SCOPE_VIOLATION',
        'STAFF_BRANCH_MISMATCH',
        'PROGRAM_BRANCH_MISMATCH',
        'PT_SESSION_EXHAUSTED',
        'INVALID_STATUS_TRANSITION',
        'BRANCH_TERMINATED',
      ],
    },
  },
  {
    path: '/members',
    help: {
      title: '회원',
      summary: '지점 회원을 찾고 새 회원을 등록합니다.',
      byRole: {
        BRANCH_ADMIN: [
          '상태로 거르거나 이름·회원번호·전화번호로 검색합니다. 목록은 20명씩 나뉘어 보입니다.',
          '"+ 회원 등록"에서 이름(필수)과 연락처·생년월일을 넣고 등록합니다.',
          '만 19세 미만이면 법정대리인 동의 확인란을 체크해야 등록됩니다.',
          '행을 누르면 회원 상세로 들어가 수강·PT·예약 내역을 봅니다.',
        ],
        SUPER_ADMIN: ['지점 필터로 지점을 고르고 검색합니다.', '행을 누르면 회원 상세로 들어갑니다(조회).'],
      },
      errors: ['GUARDIAN_CONSENT_REQUIRED', 'VALIDATION_ERROR', 'BRANCH_TERMINATED', 'BRANCH_REQUIRED'],
    },
  },
  {
    path: '/staff/:id',
    help: {
      title: '직원 상세',
      summary: '직원 한 명의 인사 정보와 파견 이력을 보고, 역할에 맞는 인사 처리를 합니다.',
      byRole: {
        SUPER_ADMIN: [
          '"파견 발령"에서 새 지점과 메모를 넣고 발령합니다. 계약 종료 지점은 목록에 나오지 않습니다.',
          '발령하면 예전 지점 회원의 담당이 풀립니다. 풀린 회원 이름이 알림으로 남으니 그 지점 관리자에게 전달하세요.',
          '아래 파견 이력에서 언제 어느 지점에 있었는지 봅니다. 누가 발령했는지는 "변경 이력"에 있습니다.',
        ],
        BRANCH_ADMIN: [
          '"정보 수정"으로 이름·연락처·직급·고용형태·정기 휴무 요일을 고치고 저장합니다.',
          '"퇴사 처리"를 누르면 확인 창이 뜹니다. 처리하면 계정이 바로 막히고 파견이 오늘로 끝나며, 담당 회원은 담당이 풀립니다(되돌릴 수 없음).',
          '지점을 옮기는 일은 본사가 "파견 발령"으로 합니다.',
        ],
      },
      errors: ['BRANCH_TERMINATED', 'STAFF_ALREADY_RESIGNED', 'STAFF_SCOPE_VIOLATION', 'STAFF_NOT_FOUND', 'VALIDATION_ERROR'],
    },
  },
  {
    path: '/staff',
    help: {
      title: '직원',
      summary: '본사가 채용해 지점에 파견한 직원을 봅니다. 채용·재배치는 본사 관리자만 합니다.',
      byRole: {
        SUPER_ADMIN: [
          '"+ 직원 채용"에서 파견 지점·이름·이메일(필수)을 넣고 채용합니다.',
          '채용이 끝나면 로그인 정보(이메일·임시 비밀번호)가 알림으로 남습니다. 직원에게 전달하세요.',
          '재직/퇴사 탭과 지점명 검색으로 찾고, 행을 누르면 상세에서 파견 발령을 합니다.',
          '역할(지점 관리자/직원) 변경은 "권한 관리"에서 합니다.',
        ],
        BRANCH_ADMIN: [
          '내 지점에 파견된 직원이 보입니다. 행을 누르면 상세에서 정보 수정·퇴사 처리를 합니다.',
          '"퇴사" 탭에서 퇴사한 직원을 다시 볼 수 있습니다.',
          '채용·재배치가 필요하면 본사에 요청합니다.',
        ],
        STAFF: ['내 인사 정보(직급·고용형태·입사일)를 확인합니다. 고칠 것이 있으면 지점 관리자에게 요청합니다.'],
      },
      errors: ['EMAIL_ALREADY_EXISTS', 'BRANCH_TERMINATED', 'VALIDATION_ERROR', 'STAFF_RECORD_REQUIRED'],
    },
  },
  {
    path: '/attendance',
    help: {
      title: '근태관리',
      summary: '출퇴근 기록, 휴가 신청·승인, 업무일지를 처리합니다.',
      byRole: {
        STAFF: [
          '출근하면 "체크인", 퇴근할 때 "체크아웃"을 누릅니다(하루 한 번씩).',
          '"휴가 신청"에서 유형·시작일·종료일을 넣고 신청합니다. 결과는 "내 휴가 신청 내역"에 보입니다.',
          '업무일지에 날짜와 내용을 넣고 저장합니다.',
        ],
        BRANCH_ADMIN: [
          '본인 체크인·체크아웃·업무일지는 직원과 같습니다.',
          '"휴가 승인함"에서 대기 중인 신청을 승인하거나 반려합니다.',
        ],
      },
      errors: [
        'ALREADY_CHECKED_IN',
        'ALREADY_CHECKED_OUT',
        'NOT_CHECKED_IN',
        'INVALID_DATE_RANGE',
        'LEAVE_REQUEST_ALREADY_REVIEWED',
        'STAFF_RECORD_REQUIRED',
      ],
    },
  },
  {
    path: '/programs',
    help: {
      title: '프로그램',
      summary: '지점에서 운영하는 강습·PT·회차 예약형 프로그램을 등록하고 상태를 관리합니다.',
      byRole: {
        BRANCH_ADMIN: [
          '"+ 프로그램 등록"에서 프로그램명·종목·시작일(필수)과 이용 방식·정원·강사·시설을 정합니다.',
          '회차 예약형(PAID_SESSION)이면 등록 뒤 "예약 관리"에서 회차를 추가합니다.',
          '상태 버튼으로 운영 중 → 휴강·종료로 바꿉니다. 예약이 걸린 회차가 있으면 경고 알림이 남습니다.',
        ],
        SUPER_ADMIN: ['지점명으로 검색해 지점별 프로그램을 봅니다(조회).'],
        STAFF: ['내 지점 프로그램과 상태를 봅니다(조회).'],
        MEMBER: ['등록한 지점 프로그램을 봅니다. 예약은 "예약" 메뉴에서 합니다.'],
      },
      errors: [
        'VALIDATION_ERROR',
        'INVALID_DATE_RANGE',
        'INSTRUCTOR_BRANCH_MISMATCH',
        'FACILITY_BRANCH_MISMATCH',
        'INVALID_STATUS_TRANSITION',
        'BRANCH_TERMINATED',
      ],
    },
  },
  {
    path: '/instructors',
    help: {
      title: '강사',
      summary: '지점 프로그램을 맡는 강사를 등록하고 활성 상태를 관리합니다.',
      byRole: {
        BRANCH_ADMIN: [
          '"+ 강사 등록"에서 이름(필수)·전문분야·연락처·소개를 넣습니다.',
          '더 이상 수업하지 않는 강사는 "비활성화"합니다. 기록은 남고 "다시 활성화"로 되돌릴 수 있습니다.',
        ],
        SUPER_ADMIN: ['지점명으로 검색해 지점별 강사를 봅니다(조회).'],
      },
      errors: ['VALIDATION_ERROR', 'INSTRUCTOR_SCOPE_VIOLATION', 'BRANCH_TERMINATED'],
    },
  },
  {
    path: '/reservations',
    help: {
      title: '예약',
      summary: '회차 예약형 프로그램의 회차·예약·결제를 다룹니다. 결제는 모의결제입니다.',
      byRole: {
        BRANCH_ADMIN: [
          '프로그램을 고르고 "회차 추가"에서 날짜·시작·종료 시각(정원은 비우면 프로그램 정원)을 넣습니다.',
          '예약 현황에서 회원이 오면 "체크인"을 누릅니다(결제 완료된 예약만).',
          '예약·결제 내역은 최근 것부터 20건씩 보입니다.',
        ],
        MEMBER: [
          '프로그램과 회차를 고르고 예약합니다.',
          '바로 "결제하기"를 눌러 결제를 끝내야 예약이 확정됩니다.',
          '내 예약 목록에서 취소할 수 있습니다.',
        ],
      },
      errors: [
        'SLOT_FULL',
        'SLOT_ALREADY_STARTED',
        'ALREADY_RESERVED',
        'PAYMENT_NOT_PENDING',
        'RESERVATION_NOT_CONFIRMED',
        'RESERVATION_NOT_CANCELLABLE',
        'PROGRAM_NOT_RUNNING',
        'PROGRAM_CAPACITY_REQUIRED',
        'BRANCH_TERMINATED',
      ],
    },
  },
  {
    path: '/board/:id',
    help: {
      title: '게시글',
      summary: '공지 한 건을 읽고, 쓴 사람이면 고치거나 지웁니다.',
      common: ['"수정"으로 제목·카테고리·내용을 고치고 저장합니다(쓴 사람만).', '"삭제"는 쓴 사람과 본사 관리자만 할 수 있습니다.'],
      errors: ['POST_NOT_FOUND', 'POST_SCOPE_VIOLATION', 'POST_FORBIDDEN_ROLE'],
    },
  },
  {
    path: '/board',
    help: {
      title: '게시판',
      summary: '본사 공지와 지점 공지를 봅니다. 전체 공지와 내 지점 공지만 보입니다.',
      byRole: {
        SUPER_ADMIN: [
          '"+ 글쓰기"에서 대상 지점을 비우면 전체 공지, 고르면 그 지점 공지가 됩니다.',
          '"회원에게도 공개"를 체크하면 회원 웹 공지에도 나옵니다(기본은 직원 전용).',
        ],
        BRANCH_ADMIN: ['"+ 글쓰기"로 내 지점 공지를 씁니다.', '제목을 누르면 상세로 들어갑니다.'],
        STAFF: ['위쪽 분류(전체/본사/지점)로 걸러 읽습니다.'],
        MEMBER: ['회원에게 공개된 공지만 보입니다.'],
      },
      errors: ['VALIDATION_ERROR', 'POST_FORBIDDEN_ROLE', 'BRANCH_TERMINATED'],
    },
  },
  {
    path: '/facilities',
    help: {
      title: '시설 · 혼잡도',
      summary: '지점 시설과 현재 이용 인원(혼잡도)을 봅니다. 혼잡도는 지금 수동 보정 값입니다.',
      byRole: {
        BRANCH_ADMIN: [
          '"+ 시설 등록"에서 이름·종류·정원을 넣습니다.',
          '시설 카드의 입력칸에 현재 인원을 넣고 "보정"을 누르면 혼잡도가 바뀝니다.',
          '"정보 수정"으로 이름·정원을 고치고, 공사 등으로 쉬면 "운영 중단", 다시 열면 "재활성화"합니다.',
        ],
        SUPER_ADMIN: ['지점명으로 검색해 지점별 혼잡도를 봅니다(조회).'],
        STAFF: ['내 지점 시설의 현재 인원을 봅니다(조회).'],
        MEMBER: ['등록한 지점 시설의 혼잡도를 봅니다.'],
      },
      errors: ['INVALID_CAPACITY', 'INVALID_CURRENT_COUNT', 'FACILITY_SCOPE_VIOLATION', 'BRANCH_TERMINATED'],
    },
  },
  {
    path: '/assets',
    help: {
      title: '자산·비품',
      summary: '지점 기물과 소모품을 등록하고 상태(사용·수리·폐기)를 관리합니다.',
      common: [
        '"+ 자산 등록"에서 품명·취득가액·취득일을 넣습니다. 100만원 초과는 고정자산으로 자동 분류됩니다.',
        '행의 상태 버튼으로 수리 중·폐기 등으로 바꿉니다.',
        '기본 목록은 폐기된 자산을 빼고 보여 줍니다. 폐기 자산은 상태 필터로 따로 봅니다.',
      ],
      byRole: { SUPER_ADMIN: ['등록할 때 지점을 꼭 고릅니다. 지점 필터로 지점별 자산을 봅니다.'] },
      errors: ['VALIDATION_ERROR', 'INVALID_QUANTITY', 'INVALID_STATUS_TRANSITION', 'BRANCH_REQUIRED', 'BRANCH_TERMINATED'],
    },
  },
  {
    path: '/documents',
    help: {
      title: '문서함',
      summary: '계약서·인사 서류 같은 문서를 분류별로 보관합니다. 지금은 파일 URL만 기록합니다.',
      common: [
        '위쪽 분류 버튼으로 걸러 봅니다.',
        '"+ 문서 등록"에서 제목·분류·파일 URL을 넣습니다. 인사 서류는 대상 직원과 보존기한이 필요합니다.',
      ],
      byRole: {
        SUPER_ADMIN: ['지점을 비우면 전사 문서가 됩니다.', '보존기한이 다가온 문서 알림을 확인하고, 필요 없으면 "삭제"합니다.'],
      },
      errors: ['RETENTION_UNTIL_REQUIRED', 'VALIDATION_ERROR', 'STAFF_BRANCH_MISMATCH', 'DOCUMENT_SCOPE_VIOLATION', 'BRANCH_TERMINATED'],
    },
  },
  {
    path: '/permissions',
    help: {
      title: '권한 관리',
      summary: '지점 직원의 역할을 지점 관리자 ↔ 지점 직원으로 바꿉니다. 본사 관리자만 씁니다.',
      common: [
        '지점명·이름·직원코드로 검색합니다.',
        '역할 선택을 바꾸면 바로 저장됩니다. 재로그인 없이 다음 요청부터 반영됩니다.',
        '바꾼 기록은 "변경 이력"에 남습니다.',
      ],
      errors: ['STAFF_NOT_FOUND', 'STAFF_ALREADY_RESIGNED'],
    },
  },
  {
    path: '/audit-logs',
    help: {
      title: '변경 이력',
      summary: '인사 변경(역할 전환·퇴사·파견)을 누가 언제 했는지 봅니다. 본사 관리자만 봅니다.',
      common: ['최신 기록부터 20건씩 보입니다. "이전"·"다음"으로 넘깁니다.', '처리자와 대상 직원, 바뀌기 전·후 값을 확인합니다.'],
      errors: ['UPSTREAM_UNAVAILABLE'],
    },
  },
];

function matches(pattern: string, pathname: string): boolean {
  const a = pattern.split('/').filter(Boolean);
  const b = pathname.split('/').filter(Boolean);
  return a.length === b.length && a.every((seg, i) => seg.startsWith(':') || seg === b[i]);
}

export function findScreenHelp(pathname: string): ScreenHelp | undefined {
  return HELP_ROUTES.find((r) => matches(r.path, pathname))?.help;
}
