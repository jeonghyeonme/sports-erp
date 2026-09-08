import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { ApiEnvelope, PermissionStaffRow } from '../lib/types';

const ROLE_LABEL = {
  BRANCH_ADMIN: '지점 관리자',
  STAFF: '지점 직원',
} as const;

interface ApiErrorBody {
  code?: string;
  message?: string;
}

export function PermissionsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useApiList<PermissionStaffRow>(
    ['permissions', 'staff'],
    '/permissions/staff',
  );
  const [search, setSearch] = useState('');

  // 98개 지점 규모에서는 이 화면도 "지점별로 훑어보기"가 아니라 "직원 한 명을 찾아 권한을 바꾸는"
  // 단발 작업이라, 지점 아코디언 대신 지점명/이름/직원코드 통합 검색만 얹는다.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter(
      (s) =>
        s.branchName.toLowerCase().includes(term) ||
        s.name.toLowerCase().includes(term) ||
        s.staffCode.toLowerCase().includes(term),
    );
  }, [data, search]);

  const updateRole = useMutation<
    PermissionStaffRow,
    AxiosError<ApiErrorBody>,
    { staffId: string; role: 'STAFF' | 'BRANCH_ADMIN' }
  >({
    mutationFn: async ({ staffId, role }) =>
      (
        await api.patch<ApiEnvelope<PermissionStaffRow>>(`/permissions/staff/${staffId}/role`, {
          role,
        })
      ).data.data!,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'staff'] });
    },
  });

  return (
    <>
      <div className="page-header">
        <h2>권한 관리</h2>
        <p className="page-desc">
          01문서 §7 권한 매트릭스 — 본사(SUPER_ADMIN)만 지점 직원의 권한을 지점 관리자/지점 직원으로 전환할 수
          있습니다. 변경 후 해당 직원이 재로그인해야 반영됩니다(JWT는 로그인 시점 권한을 그대로 담기 때문).
        </p>
      </div>

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {updateRole.isError && (
        <div className="forbidden-note">{apiErrorMessage(updateRole.error)}</div>
      )}
      {isLoading && <div className="loading-state">불러오는 중...</div>}
      {!isLoading && !isError && data && data.length === 0 && (
        <div className="empty-state">표시할 직원이 없습니다.</div>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="list-toolbar">
          <input
            className="search-input"
            placeholder="지점명 · 이름 · 직원코드 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}
      {!isLoading && !isError && data && data.length > 0 && rows.length === 0 && (
        <div className="empty-state">검색 결과가 없습니다.</div>
      )}

      {!isError && rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>지점</th>
              <th>직원코드</th>
              <th>이름</th>
              <th>직급</th>
              <th>권한</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.staffId}>
                <td>{s.branchName}</td>
                <td>{s.staffCode}</td>
                <td>{s.name}</td>
                <td>{s.position ?? '-'}</td>
                <td>
                  <select
                    className="role-select"
                    value={s.role}
                    disabled={updateRole.isPending}
                    onChange={(e) =>
                      updateRole.mutate({
                        staffId: s.staffId,
                        role: e.target.value as 'STAFF' | 'BRANCH_ADMIN',
                      })
                    }
                  >
                    <option value="STAFF">{ROLE_LABEL.STAFF}</option>
                    <option value="BRANCH_ADMIN">{ROLE_LABEL.BRANCH_ADMIN}</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
