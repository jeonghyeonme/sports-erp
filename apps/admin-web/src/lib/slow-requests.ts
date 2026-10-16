// RFP 시스템 성능 #11 "느린 작업 사용자 알림"(D51 M8) — 진행 중인 API 요청 중 가장 오래된 것이
// 3초를 넘으면 "처리 중" 안내, 15초를 넘으면 "응답이 늦다" 안내를 띄운다(log/120).
// 기준: 운영 요청당 처리 약 40ms, 콜드 스타트 약 1.4초(D49·D50)라 3초는 평소엔 뜨지 않는다.
// 이 파일은 admin-web·member-web에 같은 내용으로 있다(공유 UI 패키지가 없다) — 고치면 둘 다 고친다.

export const SLOW_MS = 3000;
export const STALLED_MS = 15000;

export type SlowLevel = 0 | 1 | 2;

const pending = new Map<number, number>(); // 요청 번호 → 시작 시각
const listeners = new Set<() => void>();
let seq = 0;
let level: SlowLevel = 0;

function recompute() {
  const oldest = Math.min(...pending.values());
  const age = pending.size ? Date.now() - oldest : 0;
  const next: SlowLevel = age >= STALLED_MS ? 2 : age >= SLOW_MS ? 1 : 0;
  if (next !== level) {
    level = next;
    listeners.forEach((fn) => fn());
  }
}

/** 요청 시작 때 부르고, 돌려받은 함수를 끝날 때(성공·실패 모두) 부른다. */
export function trackRequest(): () => void {
  const id = ++seq;
  pending.set(id, Date.now());
  const timers = [setTimeout(recompute, SLOW_MS), setTimeout(recompute, STALLED_MS)];
  let done = false;
  return () => {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    pending.delete(id);
    recompute();
  };
}

export function getSlowLevel(): SlowLevel {
  return level;
}

export function subscribeSlowLevel(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
