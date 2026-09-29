/**
 * D30·D31 — DB가 원천인 엔티티의 mock 미러를 갱신하는 헬퍼. 배열 참조는 유지한다
 * (mock 독자가 `mockData.programs` 같은 배열을 그대로 들고 읽기 때문).
 */

/** 같은 id를 제자리 교체하거나 끝에 추가한다. */
export function upsertById<T extends { id: string }>(list: T[], item: T): void {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else list.push(item);
}

/** 배열 내용을 통째로 바꾼다(앱이 뜰 때 DB 전체로 채우는 용도). */
export function replaceAll<T>(list: T[], items: T[]): void {
  list.splice(0, list.length, ...items);
}
