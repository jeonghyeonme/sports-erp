// 목록 쪽 넘김(D43) — 게시판·변경 이력과 같은 모양. total이 한 쪽 이하면 그리지 않는다.
export function Pager({
  page,
  pageSize,
  total,
  onChange,
  disabled,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="action-row pager" style={{ justifyContent: 'center', gap: 12, marginTop: 8 }}>
      <button className="btn-secondary" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        이전
      </button>
      <span className="pager-label">
        {page} / {totalPages}페이지 (전체 {total.toLocaleString()}건)
      </span>
      <button className="btn-secondary" disabled={disabled || page >= totalPages} onClick={() => onChange(page + 1)}>
        다음
      </button>
    </div>
  );
}
