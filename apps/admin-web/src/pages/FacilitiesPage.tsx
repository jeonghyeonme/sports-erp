import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { groupByBranch } from '../lib/group-by-branch';
import { CollapsibleBranchSection } from '../components/CollapsibleBranchSection';
import { Modal } from '../components/Modal';
import { useAuth } from '../lib/use-auth';
import { ApiEnvelope, FacilityRow, FacilityType } from '../lib/types';

const AUTO_EXPAND_THRESHOLD = 3;

const TYPE_LABEL: Record<FacilityType, string> = {
  GYM: '헬스장',
  POOL: '수영장',
  GOLF: '골프장',
  READING_ROOM: '독서실',
  ETC: '기타',
};

// ADR-FAC-01 — RFP F08b("30분 이내 반영") 요건을 화면에서 눈으로 확인할 수 있게 신선도를 표시한다.
function formatFreshness(lastUpdatedAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(lastUpdatedAt).getTime()) / 60000));
  if (minutes < 1) return '방금 갱신';
  if (minutes < 60) return `${minutes}분 전 갱신`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전 갱신`;
  return `${Math.floor(hours / 24)}일 전 갱신`;
}

interface ApiErrorBody {
  code?: string;
  message?: string;
}

interface FacilityForm {
  name: string;
  type: FacilityType;
  capacity: string;
}

const EMPTY_FORM: FacilityForm = { name: '', type: 'GYM', capacity: '' };

function toEditForm(f: FacilityRow): FacilityForm {
  return { name: f.name, type: f.type, capacity: String(f.capacity) };
}

function FacilityFormFields({ form, onChange }: { form: FacilityForm; onChange: (f: FacilityForm) => void }) {
  return (
    <>
      <div className="form-row">
        <div className="field">
          <label>이름 *</label>
          <input value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} required />
        </div>
        <div className="field">
          <label>종류</label>
          <select value={form.type} onChange={(e) => onChange({ ...form, type: e.target.value as FacilityType })}>
            {(Object.keys(TYPE_LABEL) as FacilityType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>정원(명) *</label>
        <input
          type="number"
          min={1}
          value={form.capacity}
          onChange={(e) => onChange({ ...form, capacity: e.target.value })}
          required
        />
      </div>
    </>
  );
}

function CreateFacilityModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FacilityForm>(EMPTY_FORM);

  const createMutation = useMutation<FacilityRow, AxiosError<ApiErrorBody>, FacilityForm>({
    mutationFn: async (dto) => {
      const payload = { name: dto.name, type: dto.type, capacity: Number(dto.capacity) };
      return (await api.post<ApiEnvelope<FacilityRow>>('/facilities', payload)).data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.capacity) return;
    createMutation.mutate(form);
  }

  return (
    <Modal title="시설 등록" onClose={onClose}>
      <form onSubmit={submit}>
        <FacilityFormFields form={form} onChange={setForm} />

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

function EditFacilityModal({ facility, onClose }: { facility: FacilityRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FacilityForm>(toEditForm(facility));

  const updateMutation = useMutation<FacilityRow, AxiosError<ApiErrorBody>, FacilityForm>({
    mutationFn: async (dto) => {
      const payload = { name: dto.name, type: dto.type, capacity: Number(dto.capacity) };
      return (await api.patch<ApiEnvelope<FacilityRow>>(`/facilities/${facility.id}`, payload)).data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.capacity) return;
    updateMutation.mutate(form);
  }

  return (
    <Modal title="시설 정보 수정" onClose={onClose}>
      <form onSubmit={submit}>
        <FacilityFormFields form={form} onChange={setForm} />

        {updateMutation.isError && (
          <div className="forbidden-note" style={{ marginTop: 12 }}>
            {apiErrorMessage(updateMutation.error)}
          </div>
        )}

        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-secondary primary" disabled={updateMutation.isPending}>
            저장
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ManageableFacilityCard({ facility, canManage }: { facility: FacilityRow; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [manualCount, setManualCount] = useState('');

  const correctMutation = useMutation<FacilityRow, AxiosError<ApiErrorBody>, number>({
    mutationFn: async (currentCount) =>
      (await api.post<ApiEnvelope<FacilityRow>>(`/facilities/${facility.id}/congestion/manual`, { currentCount }))
        .data.data!,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      setManualCount('');
    },
  });

  function submitCorrection(e: FormEvent) {
    e.preventDefault();
    if (manualCount === '') return;
    correctMutation.mutate(Number(manualCount));
  }

  return (
    <div className="card">
      <h3>
        {facility.name} <span className="badge PREPARING">{TYPE_LABEL[facility.type]}</span>
      </h3>
      <div className="stat-row">
        <span>현재 인원</span>
        <strong>
          {facility.currentCount} / {facility.capacity}명
        </strong>
      </div>
      <div className="congestion-bar">
        <div
          className="congestion-bar-fill"
          style={{ width: `${Math.min(100, (facility.currentCount / facility.capacity) * 100)}%` }}
        />
      </div>
      <div className="stat-row" style={{ marginTop: 8 }}>
        <span>혼잡도 단계</span>
        <strong>{facility.level} / 5</strong>
      </div>
      <div className="stat-row" style={{ marginTop: 4 }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{formatFreshness(facility.lastUpdatedAt)}</span>
      </div>

      {canManage && (
        <>
          <form className="action-row" style={{ marginTop: 12 }} onSubmit={submitCorrection}>
            <input
              type="number"
              min={0}
              placeholder="인원 수동 보정"
              value={manualCount}
              onChange={(e) => setManualCount(e.target.value)}
              style={{ width: 120 }}
            />
            <button type="submit" className="btn-secondary" disabled={correctMutation.isPending}>
              보정
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
              정보 수정
            </button>
          </form>
          {correctMutation.isError && (
            <div className="forbidden-note" style={{ marginTop: 8 }}>
              {apiErrorMessage(correctMutation.error)}
            </div>
          )}
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6, marginBottom: 0 }}>
            자동 계산이 붙기 전까지는 이 값이 조회 화면에 그대로 노출됩니다.
          </p>
        </>
      )}

      {editing && <EditFacilityModal facility={facility} onClose={() => setEditing(false)} />}
    </div>
  );
}

export function FacilitiesPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useApiList<FacilityRow>(['facilities'], '/facilities');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const canCreate = user?.role === 'BRANCH_ADMIN';

  const groups = useMemo(() => {
    const all = groupByBranch(data ?? []);
    const term = search.trim().toLowerCase();
    return term ? all.filter((g) => g.branchName.toLowerCase().includes(term)) : all;
  }, [data, search]);

  const autoExpand = groups.length > 0 && groups.length <= AUTO_EXPAND_THRESHOLD;

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>시설 · 혼잡도</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            08문서 기준입니다. 실제로는 5분 주기 자동계산(Phase 2)이지만 지금은 BRANCH_ADMIN이 수동으로 보정한
            값이 그대로 노출됩니다. 지점별로 묶어서 보여줍니다(98개 지점 규모 대응 — 지점명으로 검색해 좁혀보세요).
          </p>
        </div>
        {canCreate && (
          <button className="btn-secondary primary" style={{ flexShrink: 0 }} onClick={() => setShowCreate(true)}>
            + 시설 등록
          </button>
        )}
      </div>

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
            <div className="card-grid">
              {group.rows.map((f) => (
                <ManageableFacilityCard
                  key={f.id}
                  facility={f}
                  canManage={canCreate && f.branchId === user?.branchId}
                />
              ))}
            </div>
          </CollapsibleBranchSection>
        ))}

      {showCreate && <CreateFacilityModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
