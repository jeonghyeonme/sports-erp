import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { groupByBranch } from '../lib/group-by-branch';
import { CollapsibleBranchSection } from '../components/CollapsibleBranchSection';
import { Modal } from '../components/Modal';
import { useAuth } from '../lib/use-auth';
import { useCan } from '../lib/use-can';
import { ApiEnvelope, FacilityRow, FacilityType } from '../lib/types';

import { useToast } from '../lib/use-toast';
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

// RFP 혼잡도 "실시간 혹은 최대 30분 이내 반영" — 예약 인원은 조회 때 자동으로 더하지만(ADR-FAC-05) 현장 인원은
// 관리자 입력이라 30분이 지나면 다시 입력하라고 알린다(log/114).
const STALE_MINUTES = 30;
function isStale(lastUpdatedAt: string): boolean {
  return Date.now() - new Date(lastUpdatedAt).getTime() > STALE_MINUTES * 60000;
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
          value={form.capacity} inputMode="numeric"
          onChange={(e) => onChange({ ...form, capacity: e.target.value })}
          required
        />
      </div>
    </>
  );
}

function CreateFacilityModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<FacilityForm>(EMPTY_FORM);

  const createMutation = useMutation<FacilityRow, AxiosError<ApiErrorBody>, FacilityForm>({
    mutationFn: async (dto) => {
      const payload = { name: dto.name, type: dto.type, capacity: Number(dto.capacity) };
      return (await api.post<ApiEnvelope<FacilityRow>>('/facilities', payload)).data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      toast.success('시설을 등록했습니다.');
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
  const toast = useToast();
  const [form, setForm] = useState<FacilityForm>(toEditForm(facility));

  const updateMutation = useMutation<FacilityRow, AxiosError<ApiErrorBody>, FacilityForm>({
    mutationFn: async (dto) => {
      const payload = { name: dto.name, type: dto.type, capacity: Number(dto.capacity) };
      return (await api.patch<ApiEnvelope<FacilityRow>>(`/facilities/${facility.id}`, payload)).data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      toast.success('시설 정보를 저장했습니다.');
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
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [manualCount, setManualCount] = useState('');

  const correctMutation = useMutation<FacilityRow, AxiosError<ApiErrorBody>, number>({
    mutationFn: async (currentCount) =>
      (await api.post<ApiEnvelope<FacilityRow>>(`/facilities/${facility.id}/congestion/manual`, { currentCount }))
        .data.data!,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      setManualCount('');
      toast.success(`현장 인원을 ${updated.currentCount}명으로 입력했습니다(예약 포함 ${updated.totalCount}명, ${updated.level}단계).`);
    },
  });

  // ADR-FAC-02 — 물리 삭제 대신 isActive 토글로 운영 중단/재개(소프트 삭제 원칙). PATCH 하나로 양방향 처리.
  const toggleActiveMutation = useMutation<FacilityRow, AxiosError<ApiErrorBody>, boolean>({
    mutationFn: async (isActive) =>
      (await api.patch<ApiEnvelope<FacilityRow>>(`/facilities/${facility.id}`, { isActive })).data.data!,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      toast.success(updated.isActive ? `'${updated.name}'을(를) 다시 운영합니다.` : `'${updated.name}'을(를) 운영 중단했습니다.`);
    },
  });

  function submitCorrection(e: FormEvent) {
    e.preventDefault();
    if (manualCount === '') return;
    correctMutation.mutate(Number(manualCount));
  }

  function deactivate() {
    if (window.confirm(`'${facility.name}'을(를) 운영 중단 처리하시겠습니까? "운영 중단" 탭에서 다시 활성화할 수 있습니다.`)) {
      toggleActiveMutation.mutate(false);
    }
  }

  function reactivate() {
    toggleActiveMutation.mutate(true);
  }

  return (
    <div className="card">
      <h3>
        {facility.name} <span className="badge PREPARING">{TYPE_LABEL[facility.type]}</span>{' '}
        {!facility.isActive && <span className="badge PAUSED">운영 중단</span>}
      </h3>
      <div className="stat-row">
        <span>현재 인원</span>
        <strong>
          {facility.totalCount} / {facility.capacity}명
        </strong>
      </div>
      <div className="congestion-bar">
        <div
          className="congestion-bar-fill"
          style={{ width: `${Math.min(100, (facility.totalCount / facility.capacity) * 100)}%` }}
        />
      </div>
      <div className="stat-row" style={{ marginTop: 4 }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          진행 중 강습(예약) {facility.reservedCount}명 + 현장 {facility.currentCount}명
        </span>
      </div>
      <div className="stat-row" style={{ marginTop: 8 }}>
        <span>혼잡도 단계</span>
        <strong>{facility.level} / 5</strong>
      </div>
      <div className="stat-row" style={{ marginTop: 4 }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>현장 인원 {formatFreshness(facility.lastUpdatedAt)}</span>
      </div>
      {facility.isActive && isStale(facility.lastUpdatedAt) && (
        <div className="forbidden-note" style={{ marginTop: 6 }}>
          현장 인원이 {STALE_MINUTES}분 넘게 갱신되지 않았습니다. 다시 입력해 주세요(RFP 30분 이내 반영).
        </div>
      )}

      {canManage && facility.isActive && (
        <>
          <form className="action-row" style={{ marginTop: 12 }} onSubmit={submitCorrection}>
            <input
              type="number"
              min={0}
              placeholder="예약 외 현장 인원" aria-label="예약 외 현장 인원"
              value={manualCount} inputMode="numeric"
              onChange={(e) => setManualCount(e.target.value)}
              style={{ width: 120 }}
            />
            <button type="submit" className="btn-secondary" disabled={correctMutation.isPending}>
              입력
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
              정보 수정
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={deactivate}
              disabled={toggleActiveMutation.isPending}
            >
              운영 중단
            </button>
          </form>
          {toggleActiveMutation.isError && (
            <div className="forbidden-note" style={{ marginTop: 8 }}>
              {apiErrorMessage(toggleActiveMutation.error)}
            </div>
          )}
          {correctMutation.isError && (
            <div className="forbidden-note" style={{ marginTop: 8 }}>
              {apiErrorMessage(correctMutation.error)}
            </div>
          )}
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6, marginBottom: 0 }}>
            예약 인원은 진행 중인 회차에서 자동으로 더해집니다. 여기에는 예약 없이 이용 중인 인원만 넣으세요.
          </p>
        </>
      )}

      {canManage && !facility.isActive && (
        <>
          <div className="action-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn-secondary primary"
              onClick={reactivate}
              disabled={toggleActiveMutation.isPending}
            >
              재활성화
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
              정보 수정
            </button>
          </div>
          {toggleActiveMutation.isError && (
            <div className="forbidden-note" style={{ marginTop: 8 }}>
              {apiErrorMessage(toggleActiveMutation.error)}
            </div>
          )}
        </>
      )}

      {editing && <EditFacilityModal facility={facility} onClose={() => setEditing(false)} />}
    </div>
  );
}

export function FacilitiesPage() {
  const { user } = useAuth();
  const can = useCan();
  const isBranchAdmin = user?.role === 'BRANCH_ADMIN';
  // D60 — 등록은 시설 입력, 인원 입력·운영 상태는 시설 수정 권한
  const canCreate = isBranchAdmin && can('facility', 'CREATE');
  const canUpdate = isBranchAdmin && can('facility', 'UPDATE');
  // ADR-FAC-02 — 운영중단(isActive=false) 시설은 기본 목록에 안 나오므로, 되돌릴 수 있는 사람(BRANCH_ADMIN)만
  // 탭으로 전환해 볼 수 있게 한다. 목록 자체는 항상 activeTab 기준 하나만 보여준다(뒤섞지 않음).
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const { data, isLoading, isError, error } = useApiList<FacilityRow>(
    ['facilities', activeTab],
    activeTab === 'ACTIVE' ? '/facilities' : '/facilities?isActive=false',
  );
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

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
            혼잡도는 진행 중인 강습의 예약 인원(자동)과 지점이 입력한 현장 인원을 더한 값입니다(ADR-FAC-05). 지점별로
            묶어서 보여줍니다(지점이 많으면 지점명으로 검색해 좁혀보세요).
          </p>
        </div>
        {canCreate && activeTab === 'ACTIVE' && (
          <button className="btn-secondary primary" style={{ flexShrink: 0 }} onClick={() => setShowCreate(true)}>
            + 시설 등록
          </button>
        )}
      </div>

      {canUpdate && (
        <div className="wf-tab-row" style={{ display: 'flex', gap: 4, margin: '14px 0' }}>
          <button
            className={activeTab === 'ACTIVE' ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setActiveTab('ACTIVE')}
          >
            운영 중
          </button>
          <button
            className={activeTab === 'INACTIVE' ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setActiveTab('INACTIVE')}
          >
            운영 중단
          </button>
        </div>
      )}

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
        <div className="empty-state">
          {activeTab === 'ACTIVE' ? '표시할 시설이 없습니다.' : '운영 중단된 시설이 없습니다.'}
        </div>
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
                  canManage={canUpdate && f.branchId === user?.branchId}
                />
              ))}
            </div>
          </CollapsibleBranchSection>
        ))}

      {showCreate && <CreateFacilityModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
