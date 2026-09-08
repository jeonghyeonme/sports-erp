import { useMemo, useState } from 'react';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { groupByBranch } from '../lib/group-by-branch';
import { CollapsibleBranchSection } from '../components/CollapsibleBranchSection';
import { MemberRow } from '../lib/types';

// 검색으로 이만큼 좁혀지면 굳이 또 눌러서 펼치게 하지 않고 바로 보여준다.
const AUTO_EXPAND_THRESHOLD = 3;

export function MembersPage() {
  const { data, isLoading, isError, error } = useApiList<MemberRow>(['members'], '/members');
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const all = groupByBranch(data ?? []);
    const term = search.trim().toLowerCase();
    return term ? all.filter((g) => g.branchName.toLowerCase().includes(term)) : all;
  }, [data, search]);

  const autoExpand = groups.length > 0 && groups.length <= AUTO_EXPAND_THRESHOLD;

  return (
    <>
      <h2>회원</h2>
      <p className="page-desc">
        05문서 기준 더미 데이터입니다. BRANCH_ADMIN은 본인 지점 회원만, STAFF는 접근 시 403이 표시됩니다.
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
        <div className="empty-state">표시할 회원이 없습니다.</div>
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
            countLabel="명"
            defaultExpanded={autoExpand}
          >
            <table>
              <thead>
                <tr>
                  <th>회원번호</th>
                  <th>이름</th>
                  <th>연락처</th>
                  <th>담당 직원</th>
                  <th>상태</th>
                  <th>가입일</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((m) => (
                  <tr key={m.id}>
                    <td>{m.memberNo}</td>
                    <td>{m.name}</td>
                    <td>{m.phone ?? '-'}</td>
                    <td>{m.assignedStaffName ?? '회원권만(미배정)'}</td>
                    <td>
                      <span className={`badge ${m.status}`}>{m.status}</span>
                    </td>
                    <td>{m.joinedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CollapsibleBranchSection>
        ))}
    </>
  );
}
