/**
 * 목록 페이지네이션 쿼리 해석 — D43 결정 1. 형식은 게시판(ADR-BRD-02)과 같다: `page`·`limit`(기본 20),
 * 응답은 `ok(items, { page, pageSize, total })`. 쌓이는 목록 4개(회원·예약·결제·자산)는 `limit` 상한을 둔다.
 * 잘못된 값(음수·비숫자)은 1·기본값으로 대체한다(400을 내지 않는다 — 게시판과 같은 동작).
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageRequest {
  page: number;
  pageSize: number;
  skip: number;
}

export function parsePage(pageQuery?: string, limitQuery?: string, max = MAX_PAGE_SIZE): PageRequest {
  const page = Math.max(1, Math.trunc(Number(pageQuery)) || 1);
  const pageSize = Math.min(max, Math.max(1, Math.trunc(Number(limitQuery)) || DEFAULT_PAGE_SIZE));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function pageMeta(p: PageRequest, total: number) {
  return { page: p.page, pageSize: p.pageSize, total };
}
