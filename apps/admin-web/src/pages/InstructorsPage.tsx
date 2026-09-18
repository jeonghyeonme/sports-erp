import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { groupByBranch } from '../lib/group-by-branch';
import { CollapsibleBranchSection } from '../components/CollapsibleBranchSection';
import { Modal } from '../components/Modal';
import { ApiEnvelope, InstructorRow } from '../lib/types';

const AUTO_EXPAND_THRESHOLD = 3;

interface ApiErrorBody {
  code?: string;
  message?: string;
}

interface InstructorForm {
  name: string;
  specialty: string;
  phone: string;
  bio: string;
  commissionRate: string;
}

const EMPTY_FORM: InstructorForm = { name: '', specialty: '', phone: '', bio: '', commissionRate: '' };

function CreateInstructorModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<InstructorForm>(EMPTY_FORM);

  const createMutation = useMutation<InstructorRow, AxiosError<ApiErrorBody>, InstructorForm>({
    mutationFn: async (dto) => {
      const payload = {
        name: dto.name,
        specialty: dto.specialty || undefined,
        phone: dto.phone || undefined,
        bio: dto.bio || undefined,
        commissionRate: dto.commissionRate ? Number(dto.commissionRate) : undefined,
      };
      return (await api.post<ApiEnvelope<InstructorRow>>('/instructors', payload)).data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    createMutation.mutate(form);
  }

  return (
    <Modal title="강사 등록" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label>이름 *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="field">
            <label>전문분야</label>
            <input
              value={form.specialty}
              onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
              placeholder="요가·필라테스 등"
            />
          </div>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>연락처</label>
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="field">
            <label>수수료율(0~1, 선택)</label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={form.commissionRate}
              onChange={(e) => setForm((f) => ({ ...f, commissionRate: e.target.value }))}
              placeholder="예: 0.6"
            />
          </div>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>소개</label>
          <textarea rows={2} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
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

export function InstructorsPage() {
  const { data, isLoading, isError, error } = useApiList<InstructorRow>(['instructors'], '/instructors');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const deactivateMutation = useMutation<InstructorRow, AxiosError<ApiErrorBody>, string>({
    mutationFn: async (id) => (await api.delete<ApiEnvelope<InstructorRow>>(`/instructors/${id}`)).data.data!,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructors'] }),
  });
  const activateMutation = useMutation<InstructorRow, AxiosError<ApiErrorBody>, string>({
    mutationFn: async (id) =>
      (await api.patch<ApiEnvelope<InstructorRow>>(`/instructors/${id}`, { isActive: true })).data.data!,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructors'] }),
  });

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
          <h2>강사</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            07문서 기준 더미 데이터입니다. BRANCH_ADMIN은 본인 지점 강사만 등록·수정·비활성화할 수 있습니다.
          </p>
        </div>
        <button className="btn-secondary primary" style={{ flexShrink: 0 }} onClick={() => setShowCreate(true)}>
          + 강사 등록
        </button>
      </div>

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {deactivateMutation.isError && (
        <div className="forbidden-note">{apiErrorMessage(deactivateMutation.error)}</div>
      )}
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
        <div className="empty-state">표시할 강사가 없습니다.</div>
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
                  <th>이름</th>
                  <th>전문분야</th>
                  <th>연락처</th>
                  <th>수수료율</th>
                  <th>상태</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((i) => (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td>{i.specialty ?? '-'}</td>
                    <td>{i.phone ?? '-'}</td>
                    <td>{i.commissionRate != null ? `${Math.round(i.commissionRate * 100)}%` : '-'}</td>
                    <td>
                      <span className={`badge ${i.isActive ? 'ACTIVE' : 'WITHDRAWN'}`}>
                        {i.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td>
                      {i.isActive ? (
                        <button
                          className="btn-danger-outline"
                          disabled={deactivateMutation.isPending}
                          onClick={() => deactivateMutation.mutate(i.id)}
                        >
                          비활성화
                        </button>
                      ) : (
                        <button
                          className="btn-secondary"
                          disabled={activateMutation.isPending}
                          onClick={() => activateMutation.mutate(i.id)}
                        >
                          다시 활성화
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CollapsibleBranchSection>
        ))}

      {showCreate && <CreateInstructorModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
