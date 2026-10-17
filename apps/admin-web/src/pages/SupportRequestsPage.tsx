import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { useToast } from '../lib/use-toast';
import { apiErrorMessage, useApiPage } from '../lib/use-api-list';
import { Modal } from '../components/Modal';
import { Pager } from '../components/Pager';
import { ApiEnvelope, SupportCategory, SupportRequestRow, SupportStatus } from '../lib/types';

// D56 — 업무지원 요청(RFP 개념도 현장→본사). 지점 관리자는 요청·자기 지점 요청 확인, 본사는 전 지점 요청 처리.

interface ApiErrorBody {
  code?: string;
  message?: string;
}

const PAGE_SIZE = 20;
const CATEGORY_LABEL: Record<SupportCategory, string> = {
  FACILITY: '시설',
  STAFFING: '인력',
  SUPPLIES: '물품',
  IT: '전산',
  OTHER: '기타',
};
const STATUS_LABEL: Record<SupportStatus, string> = {
  REQUESTED: '요청',
  IN_PROGRESS: '처리중',
  DONE: '완료',
  REJECTED: '반려',
};
// 배지 색은 기존 상태 클래스를 빌려 쓴다(대기·진행·완료·거절).
const STATUS_BADGE: Record<SupportStatus, string> = {
  REQUESTED: 'PENDING',
  IN_PROGRESS: 'CONFIRMED',
  DONE: 'APPROVED',
  REJECTED: 'REJECTED',
};
// D56 상태 전이표(서버와 같다) — 버튼은 갈 수 있는 상태만 보인다.
const NEXT: Record<SupportStatus, SupportStatus[]> = {
  REQUESTED: ['IN_PROGRESS', 'DONE', 'REJECTED'],
  IN_PROGRESS: ['DONE', 'REJECTED'],
  DONE: [],
  REJECTED: [],
};

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }).slice(0, -3) : '-';

function NewRequestModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ category: 'FACILITY' as SupportCategory, title: '', content: '' });
  const mutation = useMutation<SupportRequestRow, AxiosError<ApiErrorBody>>({
    mutationFn: async () =>
      (
        await api.post<ApiEnvelope<SupportRequestRow>>('/support-requests', {
          category: form.category,
          title: form.title.trim(),
          content: form.content.trim(),
        })
      ).data.data!,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
      toast.success('업무지원 요청을 올렸습니다. 본사가 처리하면 상태가 바뀝니다.');
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (form.title.trim().length >= 2 && form.content.trim().length >= 2) mutation.mutate();
  }

  return (
    <Modal title="업무지원 요청" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label>분류 *</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as SupportCategory }))}
            >
              {(Object.keys(CATEGORY_LABEL) as SupportCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label>제목 *</label>
            <input
              value={form.title}
              maxLength={100}
              placeholder="예: 샤워실 온수 고장"
              required
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>내용 *</label>
          <textarea
            rows={6}
            value={form.content}
            maxLength={2000}
            placeholder="언제부터, 어디서, 무엇이 필요한지 적어 주세요."
            required
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          />
        </div>
        {mutation.isError && <div className="forbidden-note">{apiErrorMessage(mutation.error)}</div>}
        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-secondary primary" disabled={mutation.isPending}>
            요청
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DetailModal({ row, canHandle, onClose }: { row: SupportRequestRow; canHandle: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [response, setResponse] = useState(row.response ?? '');
  const mutation = useMutation<SupportRequestRow, AxiosError<ApiErrorBody>, SupportStatus>({
    mutationFn: async (status) =>
      (
        await api.patch<ApiEnvelope<SupportRequestRow>>(`/support-requests/${row.id}/status`, {
          status,
          response: response.trim() || undefined,
        })
      ).data.data!,
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
      toast.success(`"${r.title}"을(를) ${STATUS_LABEL[r.status]}(으)로 바꿨습니다.`);
      onClose();
    },
  });
  const next = canHandle ? NEXT[row.status] : [];

  return (
    <Modal title={row.title} onClose={onClose}>
      <p className="page-desc" style={{ marginTop: 0 }}>
        {row.branchName} · {CATEGORY_LABEL[row.category]} · {row.requesterName} · {formatDate(row.createdAt)}
      </p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{row.content}</p>
      <div className="stat-row">
        <span>상태</span>
        <span className={`badge ${STATUS_BADGE[row.status]}`}>{STATUS_LABEL[row.status]}</span>
      </div>
      {row.handlerName && (
        <div className="stat-row">
          <span>처리자</span>
          <strong>
            {row.handlerName}
            {row.resolvedAt ? ` · ${formatDate(row.resolvedAt)}` : ''}
          </strong>
        </div>
      )}
      {!canHandle && row.response && (
        <div className="field" style={{ marginTop: 12 }}>
          <label>본사 답변</label>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{row.response}</p>
        </div>
      )}
      {next.length > 0 && (
        <>
          <div className="field" style={{ marginTop: 12 }}>
            <label>답변 (반려 시 필수)</label>
            <textarea rows={4} value={response} maxLength={2000} onChange={(e) => setResponse(e.target.value)} />
          </div>
          {mutation.isError && <div className="forbidden-note">{apiErrorMessage(mutation.error)}</div>}
          <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
            {next.map((s) => (
              <button
                key={s}
                type="button"
                className={s === 'REJECTED' ? 'btn-danger-outline' : 'btn-secondary primary'}
                disabled={mutation.isPending || (s === 'REJECTED' && !response.trim())}
                onClick={() => mutation.mutate(s)}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </>
      )}
      {canHandle && next.length === 0 && row.response && (
        <div className="field" style={{ marginTop: 12 }}>
          <label>답변</label>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{row.response}</p>
        </div>
      )}
    </Modal>
  );
}

export function SupportRequestsPage() {
  const { user } = useAuth();
  const isBranchAdmin = user?.role === 'BRANCH_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [status, setStatus] = useState<SupportStatus | ''>(isSuperAdmin ? 'REQUESTED' : '');
  const [page, setPage] = useState(1);
  const [prevStatus, setPrevStatus] = useState(status);
  if (status !== prevStatus) {
    setPrevStatus(status);
    setPage(1);
  }
  const [showNew, setShowNew] = useState(false);
  const [opened, setOpened] = useState<SupportRequestRow | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (status) params.set('status', status);
  const { data, isLoading, isFetching, isError, error } = useApiPage<SupportRequestRow>(
    ['support-requests', status, page],
    `/support-requests?${params}`,
    { enabled: isBranchAdmin || isSuperAdmin },
  );
  const rows = data?.rows ?? [];

  if (!isBranchAdmin && !isSuperAdmin) {
    return <div className="forbidden-note">업무지원 요청은 지점 관리자와 본사만 씁니다.</div>;
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>업무지원 요청</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            {isSuperAdmin
              ? '현장(지점)이 본사에 올린 지원 요청입니다. 행을 눌러 처리중·완료·반려로 바꾸고 답변을 남깁니다.'
              : '시설·인력·물품·전산 등 본사 지원이 필요한 일을 요청하고 처리 상태와 답변을 확인합니다.'}
          </p>
        </div>
        {isBranchAdmin && (
          <button className="btn-secondary primary" style={{ flexShrink: 0 }} onClick={() => setShowNew(true)}>
            + 요청하기
          </button>
        )}
      </div>

      <div className="list-toolbar">
        <select
          className="role-select"
          aria-label="상태"
          value={status}
          onChange={(e) => setStatus(e.target.value as SupportStatus | '')}
        >
          <option value="">전체 상태</option>
          {(Object.keys(STATUS_LABEL) as SupportStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}
      {!isLoading && !isError && rows.length === 0 && <div className="empty-state">표시할 요청이 없습니다.</div>}
      {rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>요청일</th>
              {isSuperAdmin && <th>지점</th>}
              <th>분류</th>
              <th>제목</th>
              <th>요청자</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="branch-row" onClick={() => setOpened(r)}>
                <td>{formatDate(r.createdAt)}</td>
                {isSuperAdmin && <td>{r.branchName}</td>}
                <td>{CATEGORY_LABEL[r.category]}</td>
                <td>{r.title}</td>
                <td>{r.requesterName}</td>
                <td>
                  <span className={`badge ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onChange={setPage} disabled={isFetching} />

      {showNew && <NewRequestModal onClose={() => setShowNew(false)} />}
      {opened && <DetailModal row={opened} canHandle={isSuperAdmin} onClose={() => setOpened(null)} />}
    </>
  );
}
