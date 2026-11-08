import { useState } from 'react';

// D74 — 표 머리글 정렬(화면에서 전부 불러오는 목록만). 서버가 쪽을 나누는 목록은 서버 순서(최근 것부터)를 그대로 쓴다 —
// 화면에서 한 쪽만 정렬하면 전체 순서처럼 보여 오해를 낳는다.
export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}
export type SortValue = string | number | null | undefined;
export type SortAccessors<T, K extends string> = Record<K, (row: T) => SortValue>;

/** 빈 값은 방향과 상관없이 맨 뒤. 글자는 한국어 순서, 숫자는 크기 순. 같은 값은 원래 순서를 지킨다. */
export function sortRows<T, K extends string>(rows: T[], accessors: SortAccessors<T, K>, sort: SortState<K> | null): T[] {
  if (!sort) return rows;
  const get = accessors[sort.key];
  const sign = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i, v: get(row) }))
    .sort((a, b) => {
      const aEmpty = a.v === null || a.v === undefined || a.v === '';
      const bEmpty = b.v === null || b.v === undefined || b.v === '';
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? a.i - b.i : aEmpty ? 1 : -1;
      const c =
        typeof a.v === 'number' && typeof b.v === 'number'
          ? a.v - b.v
          : String(a.v).localeCompare(String(b.v), 'ko', { numeric: true });
      return c !== 0 ? c * sign : a.i - b.i;
    })
    .map((x) => x.row);
}

/** 같은 열을 누르면 오름 → 내림 → 해제(처음 순서), 다른 열을 누르면 오름차순부터. */
export function useSortState<K extends string>(initial: SortState<K> | null = null) {
  const [sort, setSort] = useState<SortState<K> | null>(initial);
  const toggle = (key: K) =>
    setSort((s) => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));
  return { sort, toggle };
}

/** D74 2차(log/205) — 서버 쪽 나누기 목록은 정렬을 서버에 맡긴다(sort=열, dir=asc|desc). 해제면 서버 기본 순서. */
export function setSortParams<K extends string>(params: URLSearchParams, sort: SortState<K> | null): URLSearchParams {
  if (sort) {
    params.set('sort', sort.key);
    params.set('dir', sort.dir);
  }
  return params;
}
