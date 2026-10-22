// 데모 공통 비밀번호 — api의 시드 계정과 채용 시 임시 비밀번호(StaffService.hire)가 같은 값을 쓴다(fixtures/demo-password.ts).
// 로그인 화면의 "데모 계정" 버튼과 채용 완료 안내(log/090)가 함께 쓴다.
export const DEMO_PASSWORD = 'demo-password-1234';

// 로그인 화면 "데모 계정으로 바로 체험하기" — api의 DEMO_ACCOUNT_IDS(fixtures/demo-password.ts) 5개 중 직원 계정 4개.
// 회원(이수진)은 회원 웹(/m/)의 데모 버튼으로만 들어간다 — 관리자 웹은 직원 계정만 받는다(D66).
// 이 계정들은 비밀번호를 바꿀 수 없다(403 DEMO_ACCOUNT_LOCKED, log/091) — 화면은 폼 대신 안내를 보인다.
export const DEMO_ACCOUNTS = [
  { email: 'jeong.haneul@spoism.example', label: '정하늘 · SUPER_ADMIN(본사)' },
  { email: 'kim.minsu@spoism.example', label: '김민수 · BRANCH_ADMIN(서초점)' },
  { email: 'choi.gangnam@spoism.example', label: '최강남 · BRANCH_ADMIN(강남점)' },
  { email: 'park.seoyeon@spoism.example', label: '박서연 · STAFF(서초점 트레이너)' },
];

export function isDemoAccount(email: string | undefined): boolean {
  return !!email && DEMO_ACCOUNTS.some((a) => a.email === email);
}
