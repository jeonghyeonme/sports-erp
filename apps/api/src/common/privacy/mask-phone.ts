/**
 * ADR-MEM-04 — 목록 응답의 전화번호 마스킹(RFP 사용자인터페이스보안, 회원관리 Q10).
 * 휴대폰(숫자 10자리 이상)은 앞 3자리·끝 4자리만 남긴다: 010-1234-5678 → 010-****-5678.
 * 그보다 짧으면 끝 4자리만 남긴다. 하이픈 등 숫자 아닌 문자는 원래 자리에 둔다.
 */
export function maskPhone(phone: string): string;
export function maskPhone(phone: string | undefined): string | undefined;
export function maskPhone(phone: string | undefined): string | undefined {
  if (!phone) return phone;
  const total = phone.replace(/\D/g, '').length;
  const keepHead = total >= 10 ? 3 : 0;
  const keepTail = Math.min(4, Math.max(total - 4, 0));
  let seen = 0;
  return phone.replace(/\d/g, (d) => {
    const i = seen++;
    return i < keepHead || i >= total - keepTail ? d : '*';
  });
}

/** 목록 응답 행들의 `phone`만 마스킹한 사본을 돌려준다(원본 행은 바꾸지 않는다). */
export function maskPhones<T extends { phone?: string }>(rows: T[]): T[] {
  return rows.map((row) => (row.phone ? { ...row, phone: maskPhone(row.phone) } : row));
}
