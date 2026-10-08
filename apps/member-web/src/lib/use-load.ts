import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { ApiEnvelope } from './types';

interface LoadState<T> {
  key: string;
  data?: T;
  meta?: Record<string, unknown>;
  error?: unknown;
}

// 화면 진입 때 한 번 부르는 GET. react-query 없이 쓰는 최소 훅이다 — 회원 웹은 화면당 조회가 1회라(design-constants ⑩)
// 캐시·재시도 정책이 필요 없다. 응답은 비동기 콜백에서만 state에 넣는다(react-hooks/set-state-in-effect, admin-web CLAUDE.md).
// 로딩 여부는 "마지막 응답의 key가 지금 key와 다른가"로 판정해 effect 안에서 동기 setState를 하지 않는다.
// url이 null이면 부르지 않는다(앞 화면이 넘겨 준 데이터로 충분할 때).
export function useLoad<T>(url: string | null) {
  const [state, setState] = useState<LoadState<T>>({ key: '' });
  const [nonce, setNonce] = useState(0);
  const key = url === null ? '' : `${url}#${nonce}`;

  useEffect(() => {
    if (url === null) return;
    let cancelled = false;
    api.get<ApiEnvelope<T>>(url).then(
      (res) => !cancelled && setState({ key, data: res.data.data, meta: res.data.meta }),
      (error: unknown) => !cancelled && setState({ key, error }),
    );
    return () => {
      cancelled = true;
    };
  }, [url, key]);

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
    loading,
    reload,
    mutate,
  };
}
