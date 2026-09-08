import { useMemo, useState } from 'react';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { groupByBranch } from '../lib/group-by-branch';
import { CollapsibleBranchSection } from '../components/CollapsibleBranchSection';
import { FacilityRow } from '../lib/types';
import { FacilityCards } from './BranchDetailPage';

const AUTO_EXPAND_THRESHOLD = 3;

export function FacilitiesPage() {
  const { data, isLoading, isError, error } = useApiList<FacilityRow>(['facilities'], '/facilities');
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const all = groupByBranch(data ?? []);
    const term = search.trim().toLowerCase();
    return term ? all.filter((g) => g.branchName.toLowerCase().includes(term)) : all;
  }, [data, search]);

  const autoExpand = groups.length > 0 && groups.length <= AUTO_EXPAND_THRESHOLD;

  return (
    <>
      <h2>시설 · 혼잡도</h2>
      <p className="page-desc">
        08문서 기준 더미 데이터입니다. 실제로는 5분 주기 자동계산(D10)이지만 지금은 고정값입니다.
        지점별로 묶어서 보여줍니다(98개 지점 규모 대응 — 지점명으로 검색해 좁혀보세요).
      </p>

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}

      {!isLoading && !isError && (data?.length ?? 0) > 0 && (
        <div className="list-toolbar">
          <input
            className="search-input"
            placeholder="지점명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {!isLoading && !isError && (data?.length ?? 0) === 0 && (
        <div className="empty-state">표시할 시설이 없습니다.</div>
      )}
      {!isLoading && !isError && (data?.length ?? 0) > 0 && groups.length === 0 && (
        <div className="empty-state">검색 결과가 없습니다.</div>
      )}

      {!isError &&
        groups.map((group) => (
          <CollapsibleBranchSection
            key={group.branchId}
            branchName={group.branchName}
            count={group.rows.length}
            countLabel="개 시설"
            defaultExpanded={autoExpand}
          >
            <FacilityCards rows={group.rows} />
          </CollapsibleBranchSection>
        ))}
    </>
  );
}
