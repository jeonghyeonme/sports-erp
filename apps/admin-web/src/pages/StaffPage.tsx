import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { apiErrorMessage } from '../lib/use-api-list';
import { groupByBranch } from '../lib/group-by-branch';
import { CollapsibleBranchSection } from '../components/CollapsibleBranchSection';
import { ApiEnvelope, StaffRow } from '../lib/types';

const AUTO_EXPAND_THRESHOLD = 3;

interface ApiErrorBody {
  code?: string;
  message?: string;
}

function StaffTable({ rows }: { rows: StaffRow[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>직원코드</th>
          <th>이름</th>
          <th>직급</th>
          <th>고용형태</th>
          <th>입사일</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.id}>
            <td>{s.staffCode}</td>
            <td>{s.name}</td>
            <td>{s.position ?? '-'}</td>
            <td>{s.employmentType ?? '-'}</td>
            <td>{s.hireDate}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StaffPage() {
  const { user } = useAuth();
  const isSelfServiceOnly = user?.role === 'STAFF';
  const [search, setSearch] = useState('');

  // 02문서 §7 — STAFF는 목록(/staff) 대신 본인 레코드(/staff/me)만 조회 가능하므로
  // 응답 모양(단일 객체 vs 배열)이 갈려 두 쿼리를 분리해서 처리한다.
  const listQuery = useQuery<StaffRow[], AxiosError<ApiErrorBody>>({
    queryKey: ['staff', 'list'],
    queryFn: async () => (await api.get<ApiEnvelope<StaffRow[]>>('/staff')).data.data ?? [],
    enabled: !isSelfServiceOnly,
  });

  const meQuery = useQuery<StaffRow | undefined, AxiosError<ApiErrorBody>>({
    queryKey: ['staff', 'me'],
    queryFn: async () => (await api.get<ApiEnvelope<StaffRow>>('/staff/me')).data.data,
    enabled: isSelfServiceOnly,
  });

  const isLoading = isSelfServiceOnly ? meQuery.isLoading : listQuery.isLoading;
  const isError = isSelfServiceOnly ? meQuery.isError : listQuery.isError;
  const error = isSelfServiceOnly ? meQuery.error : listQuery.error;
  const rows: StaffRow[] = isSelfServiceOnly
    ? meQuery.data
      ? [meQuery.data]
      : []
    : listQuery.data ?? [];

  const groups = useMemo(() => {
    const all = groupByBranch(rows);
    const term = search.trim().toLowerCase();
    return term ? all.filter((g) => g.branchName.toLowerCase().includes(term)) : all;
  }, [rows, search]);

  const autoExpand = groups.length > 0 && groups.length <= AUTO_EXPAND_THRESHOLD;

  return (
    <>
      <h2>직원</h2>
      <p className="page-desc">
        {isSelfServiceOnly
          ? '02문서 §7 — STAFF는 본인 레코드만 조회할 수 있습니다(동료 직원 정보는 노출되지 않습니다).'
          : '02문서 기준 더미 데이터입니다. 지점 관리자는 본인 지점 직원만 조회됩니다. 지점별로 묶어서 보여줍니다(98개 지점 규모 대응 — 지점명으로 검색해 좁혀보세요).'}
      </p>

      {isError && <div className="forbidden-note">{apiErrorMessage(error ?? null)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}

      {!isError && isSelfServiceOnly && rows.length > 0 && <StaffTable rows={rows} />}

      {!isError && !isSelfServiceOnly && !isLoading && rows.length > 0 && (
        <div className="list-toolbar">
          <input
            className="search-input"
            placeholder="지점명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {!isError && !isSelfServiceOnly && !isLoading && rows.length > 0 && groups.length === 0 && (
        <div className="empty-state">검색 결과가 없습니다.</div>
      )}

      {!isError &&
        !isSelfServiceOnly &&
        groups.map((group) => (
          <CollapsibleBranchSection
            key={group.branchId}
            branchName={group.branchName}
            count={group.rows.length}
            countLabel="명"
            defaultExpanded={autoExpand}
          >
            <StaffTable rows={group.rows} />
          </CollapsibleBranchSection>
        ))}
    </>
  );
}
