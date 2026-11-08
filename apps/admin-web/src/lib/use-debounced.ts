import { useEffect, useState } from 'react';

/** D74 — 목록 검색은 치는 대로, 마지막 입력 0.3초 뒤에 값을 넘긴다(글자마다 서버를 부르지 않게). */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
