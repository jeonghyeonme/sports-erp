// 새 비밀번호 규칙 — 서버 `apps/api/src/common/validation/password-policy.ts`(IsNewPassword)와 같게 둔다(보안-9, log/164).
// 화면에서 먼저 막아 안내하고, 판정은 서버가 다시 한다.
export const PASSWORD_RULE_LABEL = '8~72자, 영문과 숫자 포함';

export function passwordProblem(password: string): string | null {
  if (password.length < 8 || password.length > 72) return '비밀번호는 8~72자여야 합니다.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return '비밀번호에 영문과 숫자를 모두 넣어 주세요.';
  return null;
}
