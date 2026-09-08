import { useMemo, useState } from 'react';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { groupByBranch } from '../lib/group-by-branch';
import { CollapsibleBranchSection } from '../components/CollapsibleBranchSection';
import { ProgramRow } from '../lib/types';

const AUTO_EXPAND_THRESHOLD = 3;

const PRICING_LABEL: Record<ProgramRow['pricingType'], string> = {
  FREE_ACCESS: '자유이용',
  PAID_SESSION: '회차 예약',
  PT_PACKAGE: 'PT 패키지',
};

export function ProgramsPage() {
  const { data, isLoading, isError, error } = useApiList<ProgramRow>(['programs'], '/programs');
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const all = groupByBranch(data ?? []);
    const term = search.trim().toLowerCase();
    return term ? all.filter((g) => g.branchName.toLowerCase().includes(term)) : all;
  }, [data, search]);

  const autoExpand = groups.length > 0 && groups.length <= AUTO_EXPAND_THRESHOLD;

  return (
    <>
      <h2>프로그램</h2>
      <p className="page-desc">
        07문서 기준 더미 데이터입니다. status(D7)와 pricingType(D8)이 실제로 구분되어 내려옵니다.
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
        <div className="empty-state">표시할 프로그램이 없습니다.</div>
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
            countLabel="개"
            defaultExpanded={autoExpand}
          >
            <table>
              <thead>
                <tr>
                  <th>프로그램명</th>
                  <th>종목</th>
                  <th>이용방식</th>
                  <th>가격</th>
                  <th>강사</th>
                  <th>상태</th>
                  <th>시작일</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.category}</td>
                    <td>{PRICING_LABEL[p.pricingType]}</td>
                    <td>{p.price > 0 ? `${p.price.toLocaleString()}원` : '무료'}</td>
                    <td>{p.instructorName ?? '-'}</td>
                    <td>
                      <span className={`badge ${p.status}`}>{p.status}</span>
                    </td>
                    <td>{p.startDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CollapsibleBranchSection>
        ))}
    </>
  );
}
