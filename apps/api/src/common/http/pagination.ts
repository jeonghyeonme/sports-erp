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

/**
 * D74 2차(log/204) — 목록 검색어(q). 앞뒤 공백을 자르고 50자까지만 본다. 비면 undefined(조건 없음).
 * 회원 목록(ADR-MEM-04 화면)과 같은 방식: 부분 일치, 영문 대소문자 무시(Prisma `mode: 'insensitive'`).
 */
export function searchTerm(q?: string): string | undefined {
  const term = q?.trim().slice(0, 50);
  return term ? term : undefined;
}
