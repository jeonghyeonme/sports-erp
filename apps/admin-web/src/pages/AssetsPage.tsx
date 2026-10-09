import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { apiErrorMessage, useApiList, useApiPage } from '../lib/use-api-list';
import { Modal } from '../components/Modal';
import { Pager } from '../components/Pager';
import { BranchFilter } from '../components/BranchFilter';
import { ApiEnvelope, AssetCategory, AssetRow, AssetStatus, AssetType, BranchSummary } from '../lib/types';
import { useToast } from '../lib/use-toast';

const PAGE_SIZE = 20;
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

// 자원문서관리 A-6 전이표 — 허용되지 않은 전이는 드롭다운에서부터 막는다.
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
  const toast = useToast();
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
      toast.success('자산을 등록했습니다.');
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
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [branchId, setBranchId] = useState('');
  // '' = 기본 목록(폐기 제외, B8 사용자 결정). 폐기 자산은 'DISPOSED'를 골라 따로 본다.
  const [statusFilter, setStatusFilter] = useState<'' | AssetStatus>('');
  const [page, setPage] = useState(1);

  const filterKey = `${branchId}|${statusFilter}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  // D43 — 서버가 쪽 단위로 자르고, 상태를 고르지 않으면 폐기를 뺀다.
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (branchId) params.set('branchId', branchId);
  if (statusFilter) params.set('status', statusFilter);
  const { data, isLoading, isFetching, isError, error } = useApiPage<AssetRow>(
    ['assets', branchId, statusFilter, page],
    `/assets?${params}`,
  );
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const statusMutation = useMutation<AssetRow, AxiosError<ApiErrorBody>, { id: string; status: AssetStatus }>({
    mutationFn: async ({ id, status }) =>
      (await api.patch<ApiEnvelope<AssetRow>>(`/assets/${id}/status`, { status })).data.data!,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success(`'${updated.name}' 상태를 바꿨습니다.`);
    },
  });

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>자산·비품</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            자원문서관리 부록 A 기준입니다. 취득가액 100만원 초과는 고정자산, 이하는 소모품으로 자동 분류됩니다.
            기본 목록은 폐기된 자산을 빼고 {PAGE_SIZE}건씩 보여 줍니다(D43).
          </p>
        </div>
        <button className="btn-secondary primary" style={{ flexShrink: 0 }} onClick={() => setShowCreate(true)}>
          + 자산 등록
        </button>
      </div>

      <div className="list-toolbar" style={{ gap: 8 }}>
        {isSuperAdmin && <BranchFilter value={branchId} onChange={setBranchId} />}
        {(['', 'NORMAL', 'REPAIRING', 'DISPOSAL_PENDING', 'DISPOSED'] as const).map((s) => (
          <button
            key={s || 'BASE'}
            className={statusFilter === s ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setStatusFilter(s)}
          >
            {s === '' ? '보유 중(폐기 제외)' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {statusMutation.isError && <div className="forbidden-note">{apiErrorMessage(statusMutation.error)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}
      {!isLoading && !isError && rows.length === 0 && <div className="empty-state">조건에 맞는 자산이 없습니다.</div>}

      {!isError && rows.length > 0 && (
        <table>
          <thead>
            <tr>
              {isSuperAdmin && <th>지점</th>}
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
            {rows.map((a) => {
              const next = STATUS_TRANSITIONS[a.status];
              return (
                <tr key={a.id}>
                  {isSuperAdmin && <td>{a.branchName ?? '-'}</td>}
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
      )}

      <Pager page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} disabled={isFetching} />

      {showCreate && <CreateAssetModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
