// 데모 계정 공통 비밀번호. prisma/seed.ts의 DEMO_PASSWORD와 같은 값이어야 한다(시드 계정·채용 임시 비밀번호·테스트가 공유).
// D36 — MockDataService를 없애면서 이 상수만 여기로 옮겼다.
export const MOCK_DEMO_PASSWORD = 'demo-password-1234';

// 로그인 화면 "데모 계정으로 바로 체험하기"의 5개 계정 — 비밀번호를 바꾸면 방문자 시연이 전부 깨져 변경을 막는다(log/091).
// 채용으로 만든 계정은 같은 임시 비밀번호를 쓰지만 여기에 없으므로 바꿀 수 있다.
export const DEMO_ACCOUNT_IDS: ReadonlySet<string> = new Set([
  'account-haneul',
  'account-minsu',
  'account-gangnam-admin',
  'account-seoyeon',
  'account-sujin',
]);
