import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { useToast } from '../lib/use-toast';
import { ApiEnvelope, ChangeRequestRow, StaffRow } from '../lib/types';

// 인사정보관리 ADR-STF-09(D11) — 직원 본인 신청 → 지점 관리자 1단계 승인. 항목은 이름·연락처뿐이다.

interface ApiErrorBody {
  code?: string;
  message?: string;
}

const FIELD_LABEL: Record<ChangeRequestRow['field'], string> = { name: '이름', phone: '연락처' };
const STATUS_LABEL: Record<ChangeRequestRow['status'], string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '반려' };

const formatDate = (iso?: string) =>
  iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(iso)) : '-';

/** 직원 본인: 변경 신청 폼 + 내 신청 목록(대기 건 취소). */
export function MyChangeRequests({ staff }: { staff: StaffRow }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [field, setField] = useState<ChangeRequestRow['field']>('phone');
  const [newValue, setNewValue] = useState('');
  const mineQuery = useApiList<ChangeRequestRow>(['staff-change-requests', 'mine'], '/staff-change-requests/mine');
  const rows = mineQuery.data ?? [];
  const pendingFields = new Set(rows.filter((r) => r.status === 'PENDING').map((r) => r.field));

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['staff-change-requests'] });
  const createMutation = useMutation<ChangeRequestRow, AxiosError<ApiErrorBody>>({
    mutationFn: async () =>
      (await api.post<ApiEnvelope<ChangeRequestRow>>('/staff-change-requests', { field, newValue: newValue.trim() })).data
        .data!,
    onSuccess: (r) => {
      refresh();
      setNewValue('');
      toast.success(`${FIELD_LABEL[r.field]} 변경을 신청했습니다. 지점 관리자가 승인하면 바뀝니다.`);
    },
  });
  const cancelMutation = useMutation<unknown, AxiosError<ApiErrorBody>, string>({
    mutationFn: async (id) => api.delete(`/staff-change-requests/${id}`),
    onSuccess: () => {
      refresh();
      toast.success('신청을 취소했습니다.');
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (newValue.trim()) createMutation.mutate();
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>
        정보 변경 신청
      </h3>
      <p className="page-desc">
        이름·연락처는 신청하면 지점 관리자가 승인한 뒤에 바뀝니다. 직급·고용형태·휴무는 지점 관리자에게 말하세요.
      </p>
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label>항목</label>
            <select value={field} onChange={(e) => setField(e.target.value as ChangeRequestRow['field'])}>
              {(Object.keys(FIELD_LABEL) as ChangeRequestRow['field'][]).map((f) => (
                <option key={f} value={f}>
                  {FIELD_LABEL[f]}
                  {pendingFields.has(f) ? ' (대기 중)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>바꿀 값 (지금: {(field === 'name' ? staff.name : staff.phone) || '-'})</label>
            <input
              value={newValue} maxLength={30}
              placeholder={field === 'phone' ? '010-1234-5678' : '새 이름'}
              onChange={(e) => setNewValue(e.target.value)}
              required
            />
          </div>
        </div>
        {createMutation.isError && (
          <div className="forbidden-note" style={{ marginTop: 12 }}>
            {apiErrorMessage(createMutation.error)}
          </div>
        )}
        <div className="action-row" style={{ marginTop: 12 }}>
          <button
            type="submit"
            className="btn-secondary primary"
            disabled={createMutation.isPending || pendingFields.has(field)}
          >
            신청
          </button>
          {pendingFields.has(field) && <span className="page-desc">이 항목은 대기 중인 신청이 있습니다. 먼저 취소하세요.</span>}
        </div>
      </form>

      {cancelMutation.isError && <div className="forbidden-note">{apiErrorMessage(cancelMutation.error)}</div>}
      {rows.length > 0 && (
        <table style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>신청일</th>
              <th>항목</th>
              <th>변경 전 → 후</th>
              <th>상태</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.createdAt)}</td>
                <td>{FIELD_LABEL[r.field]}</td>
                <td>
                  {r.oldValue || '-'} → {r.newValue}
                </td>
                <td>
                  <span className={`badge ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                </td>
                <td>
                  {r.status === 'PENDING' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(r.id)}
                    >
                      취소
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** 지점 관리자: 대기 중인 변경 신청함(승인·반려). 신청이 없으면 아무것도 그리지 않는다. */
export function ChangeRequestInbox() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const inboxQuery = useApiList<ChangeRequestRow>(['staff-change-requests', 'pending'], '/staff-change-requests?status=PENDING');
  const rows = inboxQuery.data ?? [];

  const reviewMutation = useMutation<ChangeRequestRow, AxiosError<ApiErrorBody>, { id: string; action: 'approve' | 'reject' }>({
    mutationFn: async ({ id, action }) =>
      (await api.patch<ApiEnvelope<ChangeRequestRow>>(`/staff-change-requests/${id}/${action}`)).data.data!,
    onSuccess: (_r, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['staff-change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success(action === 'approve' ? '승인해 직원 정보를 바꿨습니다.' : '반려했습니다.');
    },
  });

  if (inboxQuery.isError) return <div className="forbidden-note">{apiErrorMessage(inboxQuery.error)}</div>;
  if (rows.length === 0) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>
        정보 변경 신청함 <span className="badge PENDING">{rows.length}</span>
      </h3>
      {reviewMutation.isError && <div className="forbidden-note">{apiErrorMessage(reviewMutation.error)}</div>}
      <table>
        <thead>
          <tr>
            <th>신청일</th>
            <th>직원</th>
            <th>항목</th>
            <th>변경 전 → 후</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{formatDate(r.createdAt)}</td>
              <td>{r.staffName ?? r.staffId}</td>
              <td>{FIELD_LABEL[r.field]}</td>
              <td>
                {r.oldValue || '-'} → {r.newValue}
              </td>
              <td>
                <div className="action-row">
                  <button
                    type="button"
                    className="btn-secondary primary"
                    disabled={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ id: r.id, action: 'approve' })}
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ id: r.id, action: 'reject' })}
                  >
                    반려
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
