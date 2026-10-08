import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { ApiEnvelope } from './types';

interface LoadState<T> {
  key: string;
  data?: T;
  meta?: Record<string, unknown>;
  error?: unknown;
  // 이 데이터를 서버에서 받은 시각(캐시에서 꺼냈으면 그때 받은 시각)
  fetchedAt?: number;
}

interface CacheEntry {
  data: unknown;
  meta?: Record<string, unknown>;
  at: number;
}

// B1-4 사용자 결정(log/085) — 홈 카드처럼 같은 방문 안에서 자주 다시 들어오는 화면은 짧게 메모리에 둔다.
// 탭 메모리에만 있고(저장소에 남기지 않음) 로그아웃·세션 만료 때 비운다.
const cache = new Map<string, CacheEntry>();

export function clearLoadCache() {
  cache.clear();
}

function freshEntry(url: string | null, cacheMs: number | undefined): CacheEntry | undefined {
  if (url === null || !cacheMs) return undefined;
  const entry = cache.get(url);
  return entry && Date.now() - entry.at < cacheMs ? entry : undefined;
}

// 화면 진입 때 한 번 부르는 GET. react-query 없이 쓰는 최소 훅이다 — 회원 웹은 화면당 조회가 1회라(design-constants ⑩)
// 캐시·재시도 정책이 거의 필요 없다. 응답은 비동기 콜백에서만 state에 넣는다(react-hooks/set-state-in-effect, admin-web CLAUDE.md).
// 로딩 여부는 "마지막 응답의 key가 지금 key와 다른가"로 판정해 effect 안에서 동기 setState를 하지 않는다.
// url이 null이면 부르지 않는다(앞 화면이 넘겨 준 데이터로 충분할 때).
// cacheMs를 주면 그 시간 안에 같은 url로 다시 들어올 때 부르지 않는다. reload()는 캐시를 건너뛴다.
export function useLoad<T>(url: string | null, options?: { cacheMs?: number }) {
  const cacheMs = options?.cacheMs;
  const [state, setState] = useState<LoadState<T>>(() => {
    const hit = freshEntry(url, cacheMs);
    return hit && url !== null
      ? { key: `${url}#0`, data: hit.data as T, meta: hit.meta, fetchedAt: hit.at }
      : { key: '' };
  });
  const [nonce, setNonce] = useState(0);
  const key = url === null ? '' : `${url}#${nonce}`;

  useEffect(() => {
    if (url === null) return;
    // 첫 진입이고 캐시가 살아 있으면 state가 이미 캐시로 채워져 있다(useState 초기값).
    if (nonce === 0 && freshEntry(url, cacheMs)) return;
    let cancelled = false;
    api.get<ApiEnvelope<T>>(url).then(
      (res) => {
        const at = Date.now();
        if (cacheMs) cache.set(url, { data: res.data.data, meta: res.data.meta, at });
        if (!cancelled) setState({ key, data: res.data.data, meta: res.data.meta, fetchedAt: at });
      },
      (error: unknown) => !cancelled && setState({ key, error }),
    );
    return () => {
      cancelled = true;
    };
  }, [url, key, nonce, cacheMs]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  // 화면이 쓰기 응답(취소 등)을 다시 조회하지 않고 반영할 때 쓴다 — 호출 수를 아낀다.
  const mutate = useCallback((update: (data: T) => T) => {
    setState((s) => (s.data === undefined ? s : { ...s, data: update(s.data) }));
  }, []);

  const loading = url !== null && state.key !== key;
  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    // 공통 응답의 meta(페이지네이션 total 등, ADR-BRD-02)
    meta: current ? state.meta : undefined,
    error: current ? state.error : undefined,
    fetchedAt: current ? state.fetchedAt : undefined,
    loading,
    reload,
    mutate,
  };
}
