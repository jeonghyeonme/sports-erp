import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { ApiEnvelope, MemberRow, StaffRow } from '../lib/types';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

const STATUS_LABEL: Record<MemberRow['status'], string> = {
  ACTIVE: '활성',
  DORMANT: '휴면',
  WITHDRAWN: '탈퇴',
};

interface EditForm {
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  assignedStaffId: string;
  memo: string;
}

function toEditForm(member: MemberRow): EditForm {
  return {
    name: member.name,
    phone: member.phone ?? '',
    birthDate: member.birthDate ?? '',
    gender: member.gender ?? '',
    assignedStaffId: member.assignedStaffId ?? '',
    memo: member.memo ?? '',
  };
}

// 아직 API가 없는 회원관리 기능요구서 MEM-09~11 — 백엔드가 생기기 전까지는 안내만 노출한다.
function ComingSoonTab({ label }: { label: string }) {
  return <div className="empty-state">{label} 기능은 아직 지원하지 않습니다(백엔드 준비 중).</div>;
}

export function MemberDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [tab, setTab] = useState<'enrollments' | 'pt' | 'payments'>('enrollments');

  const memberQuery = useQuery<MemberRow, AxiosError<ApiErrorBody>>({
    queryKey: ['members', id],
    queryFn: async () => (await api.get<ApiEnvelope<MemberRow>>(`/members/${id}`)).data.data!,
  });
  const staffQuery = useApiList<StaffRow>(['staff'], '/staff');

  useEffect(() => {
    if (memberQuery.data && !editing) setForm(toEditForm(memberQuery.data));
  }, [memberQuery.data, editing]);

  const updateMutation = useMutation<MemberRow, AxiosError<ApiErrorBody>, EditForm>({
    mutationFn: async (dto) => {
      const payload = {
        name: dto.name,
        phone: dto.phone || undefined,
        birthDate: dto.birthDate || undefined,
        gender: dto.gender || undefined,
        assignedStaffId: dto.assignedStaffId || undefined,
        memo: dto.memo || undefined,
      };
      return (await api.patch<ApiEnvelope<MemberRow>>(`/members/${id}`, payload)).data.data!;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['members', id], updated);
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setEditing(false);
    },
  });

  const statusMutation = useMutation<MemberRow, AxiosError<ApiErrorBody>, MemberRow['status']>({
    mutationFn: async (status) =>
      (await api.patch<ApiEnvelope<MemberRow>>(`/members/${id}/status`, { status })).data.data!,
    onSuccess: (updated) => {
      queryClient.setQueryData(['members', id], updated);
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!form || !form.name.trim()) return;
    updateMutation.mutate(form);
  }

  if (memberQuery.isLoading) return <div className="loading-state">불러오는 중...</div>;
  if (memberQuery.isError) {
    return <div className="forbidden-note">{apiErrorMessage(memberQuery.error)}</div>;
  }
  const member = memberQuery.data!;

  return (
    <>
      <div className="page-header">
        <Link className="back-link" to="/members">
          ← 회원 목록으로
        </Link>
        <h2>{member.name}</h2>
        <p className="page-desc" style={{ marginBottom: 0 }}>
          {member.memberNo} · {member.branchName}
        </p>
      </div>

      <div className="card">
        {!editing ? (
          <>
            <div className="stat-row">
              <span>연락처</span>
              <strong>{member.phone ?? '-'}</strong>
            </div>
            <div className="stat-row">
              <span>생년월일</span>
              <strong>{member.birthDate ?? '-'}</strong>
            </div>
            <div className="stat-row">
              <span>담당 직원</span>
              <strong>{member.assignedStaffName ?? '회원권만(미배정)'}</strong>
            </div>
            <div className="stat-row">
              <span>메모</span>
              <strong>{member.memo ?? '-'}</strong>
            </div>
            <div className="stat-row" style={{ marginBottom: 0 }}>
              <span>상태</span>
              <span className={`badge ${member.status}`}>{STATUS_LABEL[member.status]}</span>
            </div>

            {statusMutation.isError && (
              <div className="forbidden-note" style={{ marginTop: 12 }}>
                {apiErrorMessage(statusMutation.error)}
              </div>
            )}

            <div className="action-row" style={{ marginTop: 14 }}>
              <button className="btn-secondary" onClick={() => setEditing(true)}>
                정보 수정
              </button>
              {(['ACTIVE', 'DORMANT', 'WITHDRAWN'] as const)
                .filter((s) => s !== member.status)
                .map((s) => (
                  <button
                    key={s}
                    className={s === 'WITHDRAWN' ? 'btn-danger-outline' : 'btn-secondary'}
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate(s)}
                  >
                    {STATUS_LABEL[s]}(으)로 전환
                  </button>
                ))}
            </div>
          </>
        ) : (
          form && (
            <form onSubmit={submitEdit}>
              <div className="form-row">
                <div className="field">
                  <label>이름 *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="field">
                  <label>연락처</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="form-row" style={{ marginTop: 12 }}>
                <div className="field">
                  <label>생년월일</label>
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>성별</label>
                  <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option value="">선택 안 함</option>
                    <option value="M">남성</option>
                    <option value="F">여성</option>
                  </select>
                </div>
                <div className="field">
                  <label>담당 직원</label>
                  <select
                    value={form.assignedStaffId}
                    onChange={(e) => setForm({ ...form, assignedStaffId: e.target.value })}
                  >
                    <option value="">회원권만(미배정)</option>
                    {(staffQuery.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label>메모</label>
                <textarea rows={2} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
              </div>

              {updateMutation.isError && (
                <div className="forbidden-note" style={{ marginTop: 12 }}>
                  {apiErrorMessage(updateMutation.error)}
                </div>
              )}

              <div className="action-row" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setForm(toEditForm(member));
                    setEditing(false);
                  }}
                >
                  취소
                </button>
                <button type="submit" className="btn-secondary primary" disabled={updateMutation.isPending}>
                  저장
                </button>
              </div>
            </form>
          )
        )}
      </div>

      <div className="detail-section" style={{ marginTop: 22 }}>
        <div className="wf-tab-row" style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          <button
            className={tab === 'enrollments' ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setTab('enrollments')}
          >
            수강내역
          </button>
          <button className={tab === 'pt' ? 'filter-chip active' : 'filter-chip'} onClick={() => setTab('pt')}>
            PT 잔여세션
          </button>
          <button
            className={tab === 'payments' ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setTab('payments')}
          >
            예약·결제 내역
          </button>
        </div>
        {tab === 'enrollments' && <ComingSoonTab label="수강내역 조회" />}
        {tab === 'pt' && <ComingSoonTab label="PT 잔여세션 조회·차감" />}
        {tab === 'payments' && <ComingSoonTab label="예약·결제 내역 조회" />}
      </div>
    </>
  );
}
