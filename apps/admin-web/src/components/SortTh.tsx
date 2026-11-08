import { SortState } from '../lib/table-sort';

// D74 — 정렬할 수 있는 머리글. 버튼이라 키보드로도 누를 수 있고, 지금 방향을 aria-sort로 알린다(디자인시스템 §3).
export function SortTh<K extends string>({
  label,
  sortKey,
  sort,
  onToggle,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K> | null;
  onToggle: (key: K) => void;
}) {
  const active = sort?.key === sortKey;
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th scope="col" aria-sort={ariaSort}>
      <button type="button" className={active ? 'sort-th active' : 'sort-th'} onClick={() => onToggle(sortKey)}>
        {label}
        <span className="sort-th-icon" aria-hidden="true">
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}
