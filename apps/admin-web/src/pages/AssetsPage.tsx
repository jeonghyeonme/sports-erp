import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { groupByBranch } from '../lib/group-by-branch';
import { CollapsibleBranchSection } from '../components/CollapsibleBranchSection';
import { Modal } from '../components/Modal';
import { ApiEnvelope, AssetCategory, AssetRow, AssetStatus, AssetType, BranchSummary } from '../lib/types';

const AUTO_EXPAND_THRESHOLD = 3;
const FIXED_ASSET_THRESHOLD = 1_000_000;

interface ApiErrorBody {
  code?: string;
  message?: string;
}

const CATEGORY_LABEL: Record<AssetCategory, string> = {
  EXERCISE_EQUIPMENT: '운동기구',
  SAFETY_EQUIPMENT: '안전설비',
  OFFICE_FURNITURE: '사무비품',
  OTHER: '기타',
};

const TYPE_LABEL: Record<AssetType, string> = { FIXED_ASSET: '고정자산', CONSUMABLE: '소모품' };

const STATUS_LABEL: Record<AssetStatus, string> = {
  NORMAL: '정상',
  REPAIRING: '수리중',
  DISPOSAL_PENDING: '폐기대상',
  DISPOSED: '폐기됨',
};

// 1-10문서 §4-6 전이표 — 허용되지 않은 전이는 드롭다운에서부터 막는다.
const STATUS_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  NORMAL: ['REPAIRING', 'DISPOSAL_PENDING'],
  REPAIRING: ['NORMAL', 'DISPOSAL_PENDING'],
  DISPOSAL_PENDING: ['NORMAL', 'DISPOSED'],
  DISPOSED: [],
};

const STATUS_BADGE: Record<AssetStatus, string> = {
  NORMAL: 'ACTIVE',
  REPAIRING: 'PENDING',
  DISPOSAL_PENDING: 'PAUSED',
  DISPOSED: 'ENDED',
};

interface AssetForm {
  branchId: string;
  name: string;
  category: AssetCategory;
  acquiredAt: string;
  acquisitionCost: string;
  assetType: '' | AssetType;
  usefulLifeYears: string;
  quantity: string;
  location: string;
  note: string;
}

const EMPTY_FORM: AssetForm = {
  branchId: '',
  name: '',
  category: 'EXERCISE_EQUIPMENT',
  acquiredAt: new Date().toISOString().slice(0, 10),
  acquisitionCost: '',
  assetType: '',
  usefulLifeYears: '',
  quantity: '1',
  location: '',
  note: '',
};

function CreateAssetModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [form, setForm] = useState<AssetForm>(EMPTY_FORM);
  const branchesQuery = useApiList<BranchSummary>(['branches'], '/branches');

  const cost = Number(form.acquisitionCost || 0);
  const autoType: AssetType = cost > FIXED_ASSET_THRESHOLD ? 'FIXED_ASSET' : 'CONSUMABLE';
  const effectiveType = form.assetType || autoType;

  const createMutation = useMutation<AssetRow, AxiosError<ApiErrorBody>, AssetForm>({
    mutationFn: async (dto) => {
      const payload = {
        branchId: isSuperAdmin ? dto.branchId : undefined,
        name: dto.name,
        category: dto.category,
        acquiredAt: dto.acquiredAt,
        acquisitionCost: Number(dto.acquisitionCost),
        assetType: dto.assetType || undefined,
        usefulLifeYears: effectiveType === 'FIXED_ASSET' && dto.usefulLifeYears ? Number(dto.usefulLifeYears) : undefined,
        quantity: effectiveType === 'CONSUMABLE' && dto.quantity ? Number(dto.quantity) : undefined,
        location: dto.location || undefined,
        note: dto.note || undefined,
      };
      return (await api.post<ApiEnvelope<AssetRow>>('/assets', payload)).data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.acquisitionCost === '' || (isSuperAdmin && !form.branchId)) return;
    createMutation.mutate(form);
  }

  return (
    <Modal title="자산 등록" onClose={onClose}>
      <form onSubmit={submit}>
        {isSuperAdmin && (
          <div className="field" style={{ marginBottom: 12 }}>
            <label>지점 *</label>
            <select value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))} required>
              <option value="">선택</option>
              {(branchesQuery.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="form-row">
          <div className="field">
            <label>품명 *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="field">
            <label>분류</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as AssetCategory }))}
            >
              {(Object.keys(CATEGORY_LABEL) as AssetCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>취득일 *</label>
            <input
              type="date"
              value={form.acquiredAt}
              onChange={(e) => setForm((f) => ({ ...f, acquiredAt: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label>취득가액(원) *</label>
            <input
              type="number"
              min={0}
              value={form.acquisitionCost}
              onChange={(e) => setForm((f) => ({ ...f, acquisitionCost: e.target.value }))}
              required
            />
          </div>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>자산 구분 (100만원 초과 시 자동 고정자산)</label>
            <select
              value={form.assetType}
              onChange={(e) => setForm((f) => ({ ...f, assetType: e.target.value as '' | AssetType }))}
            >
              <option value="">자동 판정 ({TYPE_LABEL[autoType]})</option>
              <option value="FIXED_ASSET">고정자산</option>
              <option value="CONSUMABLE">소모품</option>
            </select>
          </div>
          {effectiveType === 'FIXED_ASSET' ? (
            <div className="field">
              <label>내용연수(년)</label>
              <input
                type="number"
                min={1}
                value={form.usefulLifeYears}
                onChange={(e) => setForm((f) => ({ ...f, usefulLifeYears: e.target.value }))}
              />
            </div>
          ) : (
            <div className="field">
              <label>재고 수량</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
          )}
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>보관 위치</label>
          <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="예: 2층 헬스장" />
        </div>

        {createMutation.isError && (
          <div className="forbidden-note" style={{ marginTop: 12 }}>
            {apiErrorMessage(createMutation.error)}
          </div>
        )}

        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-secondary primary" disabled={createMutation.isPending}>
            등록
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AssetsPage() {
  const { data, isLoading, isError, error } = useApiList<AssetRow>(['assets'], '/assets');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AssetStatus>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const statusMutation = useMutation<AssetRow, AxiosError<ApiErrorBody>, { id: string; status: AssetStatus }>({
    mutationFn: async ({ id, status }) =>
      (await api.patch<ApiEnvelope<AssetRow>>(`/assets/${id}/status`, { status })).data.data!,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  });

  const groups = useMemo(() => {
    const rows = (data ?? []).filter((a) => statusFilter === 'ALL' || a.status === statusFilter);
    const all = groupByBranch(rows);
    const term = search.trim().toLowerCase();
    return term ? all.filter((g) => g.branchName.toLowerCase().includes(term)) : all;
  }, [data, search, statusFilter]);

  const autoExpand = groups.length > 0 && groups.length <= AUTO_EXPAND_THRESHOLD;

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>자산·비품</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            1-10문서 §4 기준입니다. 취득가액 100만원 초과는 고정자산, 이하는 소모품으로 자동 분류됩니다.
            재물조사·감가상각(Phase 2)은 아직 없습니다.
          </p>
        </div>
        <button className="btn-secondary primary" style={{ flexShrink: 0 }} onClick={() => setShowCreate(true)}>
          + 자산 등록
        </button>
      </div>

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {statusMutation.isError && <div className="forbidden-note">{apiErrorMessage(statusMutation.error)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}

      {!isLoading && !isError && (data?.length ?? 0) > 0 && (
        <div className="list-toolbar">
          <input
            className="search-input"
            placeholder="지점명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {(['ALL', 'NORMAL', 'REPAIRING', 'DISPOSAL_PENDING', 'DISPOSED'] as const).map((s) => (
            <button
              key={s}
              className={statusFilter === s ? 'filter-chip active' : 'filter-chip'}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'ALL' ? '전체' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}

      {!isLoading && !isError && (data?.length ?? 0) === 0 && <div className="empty-state">등록된 자산이 없습니다.</div>}

      {!isError &&
        groups.map((group) => (
          <CollapsibleBranchSection
            key={group.branchId}
            branchName={group.branchName}
            count={group.rows.length}
            countLabel="건"
            defaultExpanded={autoExpand}
          >
            <table>
              <thead>
                <tr>
                  <th>자산코드</th>
                  <th>품명</th>
                  <th>분류</th>
                  <th>구분</th>
                  <th>취득가액</th>
                  <th>수량</th>
                  <th>위치</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((a) => {
                  const next = STATUS_TRANSITIONS[a.status];
                  return (
                    <tr key={a.id}>
                      <td>{a.assetCode}</td>
                      <td>{a.name}</td>
                      <td>{CATEGORY_LABEL[a.category]}</td>
                      <td>{TYPE_LABEL[a.assetType]}</td>
                      <td>{a.acquisitionCost.toLocaleString()}원</td>
                      <td>{a.quantity}</td>
                      <td>{a.location ?? '-'}</td>
                      <td>
                        {next.length > 0 ? (
                          <select
                            className="role-select"
                            value={a.status}
                            disabled={statusMutation.isPending}
                            onChange={(e) => statusMutation.mutate({ id: a.id, status: e.target.value as AssetStatus })}
                          >
                            <option value={a.status}>{STATUS_LABEL[a.status]}</option>
                            {next.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABEL[s]}(으)로 전환
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`badge ${STATUS_BADGE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CollapsibleBranchSection>
        ))}

      {showCreate && <CreateAssetModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
