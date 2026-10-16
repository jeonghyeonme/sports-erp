import { useSyncExternalStore } from 'react';
import { getSlowLevel, subscribeSlowLevel } from '../lib/slow-requests';

// M8 — 진행 중인 요청이 3초를 넘으면 "처리 중", 15초를 넘으면 "응답이 늦다"는 안내 띠(lib/slow-requests.ts).
// 새로고침 버튼은 두지 않는다 — 관리자 웹은 토큰을 메모리에 둬 새로고침하면 로그아웃된다.
export function SlowRequestNotice() {
  const level = useSyncExternalStore(subscribeSlowLevel, getSlowLevel);
  if (level === 0) return null;
  return (
    <div className={`slow-notice${level === 2 ? ' is-stalled' : ''}`} role="status" aria-live="polite">
      {level === 1
        ? '처리 중입니다. 잠시만 기다려 주세요.'
        : '응답이 늦어지고 있습니다. 네트워크 연결을 확인하고, 계속되면 잠시 뒤 다시 시도해 주세요.'}
    </div>
  );
}
