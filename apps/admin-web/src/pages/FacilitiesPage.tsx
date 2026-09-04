import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { FacilityRow } from '../lib/types';

export function FacilitiesPage() {
  const { data, isLoading, isError, error } = useApiList<FacilityRow>(['facilities'], '/facilities');

  return (
    <>
      <h2>시설 · 혼잡도</h2>
      <p className="page-desc">
        08문서 기준 더미 데이터입니다. 실제로는 5분 주기 자동계산(D10)이지만 지금은 고정값입니다.
      </p>

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}

      <div className="card-grid">
        {data?.map((f) => (
          <div className="card" key={f.id}>
            <h3>{f.name}</h3>
            <div className="stat-row">
              <span>현재 인원</span>
              <strong>
                {f.currentCount} / {f.capacity}명
              </strong>
            </div>
            <div className="congestion-bar">
              <div
                className="congestion-bar-fill"
                style={{ width: `${Math.min(100, (f.currentCount / f.capacity) * 100)}%` }}
              />
            </div>
            <div className="stat-row" style={{ marginTop: 8 }}>
              <span>혼잡도 단계</span>
              <strong>{f.level} / 5</strong>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
