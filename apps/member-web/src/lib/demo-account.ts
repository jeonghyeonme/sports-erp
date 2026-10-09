// 데모 회원 계정(관리자 웹 로그인 화면의 "이수진") — api의 DEMO_ACCOUNT_IDS(fixtures/demo-password.ts)에 들어 있어
// 비밀번호를 바꿀 수 없다(403 DEMO_ACCOUNT_LOCKED, log/091). 화면은 폼 대신 안내를 보인다.
export const DEMO_MEMBER_EMAILS: ReadonlySet<string> = new Set(['lee.sujin@example.com']);
