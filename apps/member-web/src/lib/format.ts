import { ScheduleSlot } from './types';

export function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 회차 날짜는 KST 달력 날짜(YYYY-MM-DD)다. 요일은 날짜 자체로 계산해 기기 시간대와 무관하게 한다.
export function dateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${weekday})`;
}

// 회차 시작 시각 — 날짜·시각은 KST라 +09:00을 붙여 해석한다(api reservation.service의 취소 마감 계산과 같은 방식, D32 결정 5).
export function slotStartMs(slot: Pick<ScheduleSlot, 'date' | 'startTime'>): number {
  return new Date(`${slot.date}T${slot.startTime}:00+09:00`).getTime();
}

// 예약및결제 A-6 — 회차 시작 cancellationDeadlineHours 전까지 취소해야 전액 환불. 회원 웹은 지점 설정을 따로 부르지 않고
// 기본값 24시간으로 안내한다(시드 83곳 모두 24, 지점 조회 1회를 아낀다 — design-constants ⑩). 실제 판정은 서버가 한다.
export const CANCEL_DEADLINE_HOURS = 24;

export function isBeforeCancelDeadline(slot: Pick<ScheduleSlot, 'date' | 'startTime'>, now = Date.now()): boolean {
  return slotStartMs(slot) - now >= CANCEL_DEADLINE_HOURS * 60 * 60 * 1000;
}

// ADR-FAC-01·04 — "N분 전 갱신". 혼잡도는 관리자가 보정할 때만 바뀌므로 분 단위면 충분하다.
export function sinceLabel(iso: string, now: number): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return '방금 갱신';
  if (minutes < 60) return `${minutes}분 전 갱신`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전 갱신`;
  return `${Math.floor(hours / 24)}일 전 갱신`;
}

// 공지 게시일(KST 달력 날짜 YYYY-MM-DD) → "10. 8."
export function shortDate(date: string): string {
  const [, m, d] = date.slice(0, 10).split('-').map(Number);
  return `${m}. ${d}.`;
}

// 연락처 형식 — 서버는 형식을 검사하지 않으므로 화면에서 흔한 실수만 막는다(휴대폰·지역번호, 하이픈 선택).
// 내 정보 수정·가입·연동이 같이 쓴다.
export const PHONE_RE = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;

// 회원관리 A-6 — 만 19세 미만이면 법정대리인 동의가 필요하다(서버도 검사한다, GUARDIAN_CONSENT_REQUIRED).
// 생년월일(YYYY-MM-DD)과 오늘 KST 날짜로 만 나이를 센다.
export function isMinor(birthDate: string, today = todayKst()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const age = ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
  return age < 19;
}

export function todayKst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
