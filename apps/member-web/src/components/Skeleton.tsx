// 불러오는 동안 글자 대신 자리만 보이는 회색 상자(log/094) — 앱처럼 화면 구조가 먼저 보이게 한다.
export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-group" aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${90 - (i % 3) * 18}%` }} />
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="panel skeleton-card">
          <div className="skeleton-line" style={{ width: '55%' }} />
          <div className="skeleton-line" style={{ width: '80%' }} />
        </div>
      ))}
    </div>
  );
}
