import { randomInt } from 'crypto';

// 보안-6(log/164) — 채용 때 발급하는 임시 비밀번호. 12자, 헷갈리는 글자(0·O·1·l·I)를 뺀 영문·숫자,
// 비밀번호 규칙(password-policy — 영문·숫자 포함)을 항상 만족한다. 암호학적 난수(crypto.randomInt).
const LETTERS = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALL = LETTERS + DIGITS;

export function generateTemporaryPassword(length = 12): string {
  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(LETTERS), pick(DIGITS), ...Array.from({ length: length - 2 }, () => pick(ALL))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
