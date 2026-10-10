// 데모 회원 계정(관리자 웹 로그인 화면의 "이수진") — api의 DEMO_ACCOUNT_IDS(fixtures/demo-password.ts)에 들어 있어
// 비밀번호를 바꿀 수 없다(403 DEMO_ACCOUNT_LOCKED, log/091). 화면은 폼 대신 안내를 보인다.
export const DEMO_MEMBER_EMAILS: ReadonlySet<string> = new Set(['lee.sujin@example.com']);

// 로그인 화면 "데모 회원으로 둘러보기" 버튼(관리자 웹 로그인의 데모 계정 버튼과 같은 역할).
// 비밀번호는 api 시드 공통값(fixtures/demo-password.ts) — 데모 계정은 비밀번호 변경이 막혀 있어 버튼이 깨지지 않는다.
export const DEMO_MEMBER = { email: 'lee.sujin@example.com', password: 'demo-password-1234', label: '이수진 · 서초점 회원' };
