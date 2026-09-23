import { addYearsToDateString, kstHoursMinutes, toKstDateString } from './kst-date';

/**
 * architecture/date-time-handling.md의 회귀 테스트 — 이 파일이 검증 대상.
 * 핵심 주장: `toKstDateString`은 서버 프로세스 시간대와 무관하게 항상 KST 기준 날짜를
 * 돌려준다. 특히 UTC 자정 전후(=KST 오전 9시 전후)가 버그가 있던 경계다.
 */
describe('toKstDateString', () => {
  it('UTC 전날 15:30(KST 00:30) → KST로는 다음날 날짜', () => {
    // 2026-09-22T15:30:00Z = 2026-09-23 00:30 KST — 예전 코드(toISOString만 사용)라면
    // '2026-09-22'를 반환해 하루 전으로 잘못 기록됐을 시각.
    const utcLateNight = new Date('2026-09-22T15:30:00.000Z');
    expect(toKstDateString(utcLateNight)).toBe('2026-09-23');
  });

  it('UTC 14:59(KST 23:59) → 아직 그날', () => {
    const justBeforeKstMidnight = new Date('2026-09-22T14:59:00.000Z');
    expect(toKstDateString(justBeforeKstMidnight)).toBe('2026-09-22');
  });

  it('UTC 15:00 정각(KST 00:00 정각) → 다음날로 정확히 넘어감', () => {
    const exactlyKstMidnight = new Date('2026-09-22T15:00:00.000Z');
    expect(toKstDateString(exactlyKstMidnight)).toBe('2026-09-23');
  });

  it('KST 정오처럼 경계에서 먼 시각은 당연히 정확하다', () => {
    const noonUtc = new Date('2026-09-22T03:00:00.000Z'); // KST 12:00
    expect(toKstDateString(noonUtc)).toBe('2026-09-22');
  });
});

describe('kstHoursMinutes (자동 지각 판정이 쓰는 시:분)', () => {
  it('UTC 23:05(KST 08:05)을 KST 시:분으로 정확히 환산한다', () => {
    const utc = new Date('2026-09-22T23:05:00.000Z');
    expect(kstHoursMinutes(utc)).toEqual({ hours: 8, minutes: 5 });
  });
});

describe('addYearsToDateString', () => {
  it('일반적인 연 단위 가산', () => {
    expect(addYearsToDateString('2026-09-23', 3)).toBe('2029-09-23');
  });

  it('윤년 2월 29일 + 1년 → JS Date의 자동 이월을 그대로 따른다(3월 1일)', () => {
    expect(addYearsToDateString('2024-02-29', 1)).toBe('2025-03-01');
  });
});
