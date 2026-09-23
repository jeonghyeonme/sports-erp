/**
 * KST(UTC+9) 날짜/시각 유틸 — architecture/date-time-handling.md의 ADR 구현.
 *
 * 이 서비스는 한국 전용인데, `Date.prototype.toISOString()`은 서버 프로세스의
 * 시간대 설정과 무관하게 항상 UTC 기준으로 포맷한다. `new Date().toISOString().slice(0, 10)`로
 * "오늘 날짜"를 구하면 매일 00:00~08:59 KST 사이의 모든 이벤트가 하루 전 날짜로 기록된다
 * (드문 경계 케이스가 아니라 매일 상시 발생).
 *
 * 이 파일은 `TZ` 환경변수 설정에 의존하지 않고 UTC+9 오프셋을 코드에 고정한다 — 배포
 * 환경에 TZ 설정을 빠뜨려도(컨테이너 기본값 UTC 등) 조용히 재발하지 않도록 하기 위함이다
 * (architecture/date-time-handling.md "대안 비교" B안이 가진 재발 위험을 원천 차단).
 *
 * "오늘 날짜"가 필요한 곳은 항상 이 파일의 함수를 쓸 것 — `toISOString().slice(0, 10)`을
 * 직접 쓰지 않는다(CLAUDE.md 규칙).
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 주어진 시각을 KST로 환산했을 때의 Date 객체(내부용) — 반환값의 UTC getter들이 KST 벽시계 값과 같다. */
function kstShifted(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MS);
}

/** 주어진 시각의 KST 달력 날짜를 YYYY-MM-DD로 반환한다. */
export function toKstDateString(date: Date): string {
  return kstShifted(date).toISOString().slice(0, 10);
}

/** 지금(now)의 KST 달력 날짜를 YYYY-MM-DD로 반환한다. */
export function todayKst(): string {
  return toKstDateString(new Date());
}

/** 주어진 시각의 KST 시:분을 반환한다(자동 지각 판정처럼 시각 비교가 필요한 곳에서 사용). */
export function kstHoursMinutes(date: Date): { hours: number; minutes: number } {
  const shifted = kstShifted(date);
  return { hours: shifted.getUTCHours(), minutes: shifted.getUTCMinutes() };
}

/**
 * YYYY-MM-DD 문자열에 연 단위를 더한다 — 달력 날짜 연산이라 Date 객체를 거치지 않고
 * UTC 고정 구성(`Date.UTC`)만 사용해 로컬 시간대 파싱 모호성을 원천 차단한다.
 * (예: 원래 `new Date(`${date}T00:00:00`)`는 시간대 없는 문자열이라 로컬 시간으로
 * 파싱되는데, 출력은 `toISOString()`로 UTC 포맷해 입력·출력 시간대가 서로 달랐다.)
 * 2월 29일처럼 대상 연도에 없는 날짜는 JS Date의 자동 이월(3월 1일 등)을 그대로 따른다.
 */
export function addYearsToDateString(date: string, years: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCFullYear(dt.getUTCFullYear() + years);
  return dt.toISOString().slice(0, 10);
}
