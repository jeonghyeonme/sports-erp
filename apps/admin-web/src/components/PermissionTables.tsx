import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage } from '../lib/use-api-list';
import { useToast } from '../lib/use-toast';
import {
  ApiEnvelope,
  GovernedRole,
  PermissionAction,
  PermissionCatalog,
  RolePermissionCell,
  StaffPermissionMatrix,
} from '../lib/types';

// D60 2단계 — 세부 권한 표(본사 전용). 행 = 기능, 열 = 동작(조회·입력·수정·삭제·출력).
// 역할 상한 밖 칸은 "—"(이 역할이 처음부터 할 수 없는 일 — 바꿀 수 없다).

interface ApiErrorBody {
  code?: string;
  message?: string;
}

const ROLE_LABEL: Record<GovernedRole, string> = { BRANCH_ADMIN: '지점 관리자', STAFF: '지점 직원' };

function useCatalog() {
  return useQuery<PermissionCatalog, AxiosError<ApiErrorBody>>({
    queryKey: ['permissions', 'catalog'],
    queryFn: async () => (await api.get<ApiEnvelope<PermissionCatalog>>('/permissions/catalog')).data.data!,
    staleTime: Infinity,
  });
}

const cellKey = (feature: string, action: PermissionAction) => `${feature}:${action}`;

export function RoleDefaultsTable() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [role, setRole] = useState<GovernedRole>('BRANCH_ADMIN');
  const catalog = useCatalog();
  const matrix = useQuery<Record<GovernedRole, RolePermissionCell[]>, AxiosError<ApiErrorBody>>({
    queryKey: ['permissions', 'roles'],
    queryFn: async () => (await api.get<ApiEnvelope<Record<GovernedRole, RolePermissionCell[]>>>('/permissions/roles')).data.data!,
  });
  const update = useMutation<RolePermissionCell[], AxiosError<ApiErrorBody>, RolePermissionCell>({
    mutationFn: async (cell) => (await api.put<ApiEnvelope<RolePermissionCell[]>>(`/permissions/roles/${role}`, cell)).data.data!,
    onSuccess: (cells) => {
      queryClient.setQueryData<Record<GovernedRole, RolePermissionCell[]>>(['permissions', 'roles'], (old) =>
        old ? { ...old, [role]: cells } : old,
      );
      toast.success('역할 기본 권한을 바꿨습니다. 실행 중인 서버에는 최대 30초 뒤 반영됩니다.');
    },
  });

  if (catalog.isError || matrix.isError) return <div className="forbidden-note">{apiErrorMessage(catalog.error ?? matrix.error)}</div>;
  if (!catalog.data || !matrix.data) return <div className="loading-state">불러오는 중...</div>;
  const values = new Map(matrix.data[role].map((c) => [cellKey(c.feature, c.action), c.allowed]));
  const features = catalog.data.features.filter((f) => (f.ceiling[role] ?? []).length > 0);

  return (
    <>
      <div className="wf-tab-row" style={{ display: 'flex', gap: 4, margin: '14px 0' }}>
        {catalog.data.roles.map((r) => (
          <button key={r} className={role === r ? 'filter-chip active' : 'filter-chip'} onClick={() => setRole(r)}>
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
      <p className="page-desc">
        체크를 끄면 그 역할 전원이 그 기능을 쓸 수 없습니다. 한 사람만 다르게 하려면 직원 상세의 "개인 권한"에서 바꿉니다.
        "—"는 이 역할이 처음부터 할 수 없는 일입니다(역할 상한, D60).
      </p>
      {update.isError && <div className="forbidden-note">{apiErrorMessage(update.error)}</div>}
      <table className="permission-table">
        <thead>
          <tr>
            <th>기능</th>
            {catalog.data.actions.map((a) => (
              <th key={a.action}>{a.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((f) => (
            <tr key={f.feature}>
              <td>{f.label}</td>
              {catalog.data.actions.map((a) => {
                const allowed = values.get(cellKey(f.feature, a.action));
                return (
                  <td key={a.action}>
                    {allowed === undefined ? (
                      <span className="page-desc">—</span>
                    ) : (
                      <input
                        type="checkbox"
                        aria-label={`${ROLE_LABEL[role]} ${f.label} ${a.label}`}
                        checked={allowed}
                        disabled={update.isPending}
                        onChange={(e) => update.mutate({ feature: f.feature, action: a.action, allowed: e.target.checked })}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

type Mode = 'DEFAULT' | 'ALLOW' | 'DENY';

export function StaffPermissionsTable({ staffId }: { staffId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const catalog = useCatalog();
  const matrix = useQuery<StaffPermissionMatrix, AxiosError<ApiErrorBody>>({
    queryKey: ['permissions', 'staff', staffId, 'overrides'],
    queryFn: async () =>
      (await api.get<ApiEnvelope<StaffPermissionMatrix>>(`/permissions/staff/${staffId}/overrides`)).data.data!,
  });
  const update = useMutation<StaffPermissionMatrix, AxiosError<ApiErrorBody>, { feature: string; action: PermissionAction; mode: Mode }>({
    mutationFn: async (cell) =>
      (await api.put<ApiEnvelope<StaffPermissionMatrix>>(`/permissions/staff/${staffId}/overrides`, cell)).data.data!,
    onSuccess: (next) => {
      queryClient.setQueryData(['permissions', 'staff', staffId, 'overrides'], next);
      toast.success('개인 권한을 바꿨습니다. 다음 요청부터 바로 적용됩니다.');
    },
  });

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>
        개인 권한
      </h3>
      <p className="page-desc">
        기본값은 역할 기본 권한(권한 관리 화면)을 따릅니다. 허용·차단은 이 사람에게만 적용되며, 역할이 처음부터 할 수 없는 일은
        허용할 수 없습니다(D60).
      </p>
      {(catalog.isError || matrix.isError) && <div className="forbidden-note">{apiErrorMessage(catalog.error ?? matrix.error)}</div>}
      {update.isError && <div className="forbidden-note">{apiErrorMessage(update.error)}</div>}
      {(!catalog.data || !matrix.data) && !catalog.isError && !matrix.isError && <div className="loading-state">불러오는 중...</div>}
      {catalog.data && matrix.data && matrix.data.cells.length === 0 && (
        <div className="empty-state">이 역할은 세부 권한 표가 다루지 않습니다.</div>
      )}
      {catalog.data && matrix.data && matrix.data.cells.length > 0 && (
        <PersonalGrid catalog={catalog.data} matrix={matrix.data} busy={update.isPending} onChange={(c) => update.mutate(c)} />
      )}
    </div>
  );
}

function PersonalGrid({
  catalog,
  matrix,
  busy,
  onChange,
}: {
  catalog: PermissionCatalog;
  matrix: StaffPermissionMatrix;
  busy: boolean;
  onChange: (cell: { feature: string; action: PermissionAction; mode: Mode }) => void;
}) {
  const cells = new Map(matrix.cells.map((c) => [cellKey(c.feature, c.action), c]));
  const features = catalog.features.filter((f) => catalog.actions.some((a) => cells.has(cellKey(f.feature, a.action))));
  return (
    <table className="permission-table">
      <thead>
        <tr>
          <th>기능</th>
          {catalog.actions.map((a) => (
            <th key={a.action}>{a.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {features.map((f) => (
          <tr key={f.feature}>
            <td>{f.label}</td>
            {catalog.actions.map((a) => {
              const c = cells.get(cellKey(f.feature, a.action));
              if (!c) {
                return (
                  <td key={a.action}>
                    <span className="page-desc">—</span>
                  </td>
                );
              }
              const mode: Mode = c.override === null ? 'DEFAULT' : c.override ? 'ALLOW' : 'DENY';
              return (
                <td key={a.action}>
                  <select
                    aria-label={`${f.label} ${a.label}`}
                    value={mode}
                    disabled={busy}
                    onChange={(e) => onChange({ feature: f.feature, action: a.action, mode: e.target.value as Mode })}
                  >
                    <option value="DEFAULT">기본({c.roleDefault ? '허용' : '차단'})</option>
                    <option value="ALLOW">허용</option>
                    <option value="DENY">차단</option>
                  </select>
                  <span className={`badge ${c.effective ? 'ACTIVE' : 'WITHDRAWN'}`} style={{ marginLeft: 4 }}>
                    {c.effective ? '가능' : '불가'}
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
