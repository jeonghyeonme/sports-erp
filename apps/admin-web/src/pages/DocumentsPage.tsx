import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { Modal } from '../components/Modal';
import { ApiEnvelope, BranchSummary, DocumentCategory, DocumentRow, StaffRow } from '../lib/types';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  CONTRACT: '계약서',
  HR_RECORD: '인사서류',
  MANUAL: '매뉴얼',
  OTHER: '기타',
};

// 1-10문서 §5-6 — 카테고리별 보존기한 정책 안내(입력 시 미리보기).
const RETENTION_HINT: Record<DocumentCategory, string> = {
  CONTRACT: '계약 유형마다 법정 기간이 달라 직접 입력합니다.',
  HR_RECORD: '근로관계 종료일(없으면 업로드일)로부터 3년 — 자동 계산됩니다.',
  MANUAL: '법정 보존 의무가 없어 영구 보관됩니다.',
  OTHER: '법정 보존 의무가 없어 영구 보관됩니다.',
};

function daysUntil(date: string): number {
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Math.round((new Date(date).getTime() - today) / 86_400_000);
}

function RetentionCell({ retentionUntil }: { retentionUntil?: string }) {
  if (!retentionUntil) return <span>영구 보관</span>;
  const d = daysUntil(retentionUntil);
  if (d < 0) return <span className="badge PAUSED">{retentionUntil} (기한 경과)</span>;
  if (d <= 30) return <span className="badge PENDING">{retentionUntil} (D-{d})</span>;
  return <span>{retentionUntil}</span>;
}

interface DocForm {
  category: DocumentCategory;
  branchId: string;
  relatedStaffId: string;
  title: string;
  fileUrl: string;
  retentionUntil: string;
}

const EMPTY_FORM: DocForm = { category: 'CONTRACT', branchId: '', relatedStaffId: '', title: '', fileUrl: '', retentionUntil: '' };

function UploadDocumentModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [form, setForm] = useState<DocForm>(EMPTY_FORM);
  const branchesQuery = useApiList<BranchSummary>(['branches'], '/branches');
  const staffQuery = useApiList<StaffRow>(['staff'], '/staff');

  const staffOptions = (staffQuery.data ?? []).filter(
    (s) => !isSuperAdmin || !form.branchId || s.branchId === form.branchId,
  );

  const uploadMutation = useMutation<DocumentRow, AxiosError<ApiErrorBody>, DocForm>({
    mutationFn: async (dto) => {
      const payload = {
        category: dto.category,
        branchId: isSuperAdmin ? dto.branchId || undefined : undefined,
        relatedStaffId: dto.category === 'HR_RECORD' ? dto.relatedStaffId || undefined : undefined,
        title: dto.title,
        fileUrl: dto.fileUrl,
        fileType: dto.fileUrl.split('.').pop()?.toLowerCase(),
        retentionUntil: dto.category === 'CONTRACT' && dto.retentionUntil ? dto.retentionUntil : undefined,
      };
      return (await api.post<ApiEnvelope<DocumentRow>>('/documents', payload)).data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.fileUrl.trim()) return;
    uploadMutation.mutate(form);
  }

  return (
    <Modal title="문서 등록" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label>분류</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as DocumentCategory }))}
            >
              {(Object.keys(CATEGORY_LABEL) as DocumentCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          {isSuperAdmin && (
            <div className="field">
              <label>지점 (비우면 전사 문서)</label>
              <select value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value, relatedStaffId: '' }))}>
                <option value="">전사 문서</option>
                {(branchesQuery.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>제목 *</label>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>파일 URL *</label>
          <input
            value={form.fileUrl}
            onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
            placeholder="https://.../file.pdf"
            required
          />
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
            실제 파일 업로드 인프라가 아직 없어 URL만 기록합니다.
          </p>
        </div>
        {form.category === 'HR_RECORD' && (
          <div className="field" style={{ marginTop: 12 }}>
            <label>대상 직원 *</label>
            <select
              value={form.relatedStaffId}
              onChange={(e) => setForm((f) => ({ ...f, relatedStaffId: e.target.value }))}
              required
            >
              <option value="">선택</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.staffCode})
                </option>
              ))}
            </select>
          </div>
        )}
        {form.category === 'CONTRACT' && (
          <div className="field" style={{ marginTop: 12 }}>
            <label>보존기한 (선택)</label>
            <input
              type="date"
              value={form.retentionUntil}
              onChange={(e) => setForm((f) => ({ ...f, retentionUntil: e.target.value }))}
            />
          </div>
        )}
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>보존기한: {RETENTION_HINT[form.category]}</p>

        {uploadMutation.isError && (
          <div className="forbidden-note" style={{ marginTop: 12 }}>
            {apiErrorMessage(uploadMutation.error)}
          </div>
        )}

        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-secondary primary" disabled={uploadMutation.isPending}>
            등록
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DocumentsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [category, setCategory] = useState<'ALL' | DocumentCategory>('ALL');
  const [showUpload, setShowUpload] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useApiList<DocumentRow>(['documents'], '/documents');
  const alertsQuery = useApiList<DocumentRow>(['documents', 'alerts'], '/documents/retention-alerts');

  const deleteMutation = useMutation<unknown, AxiosError<ApiErrorBody>, string>({
    mutationFn: async (id) => (await api.delete(`/documents/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });

  const rows = (data ?? []).filter((d) => category === 'ALL' || d.category === category);

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>문서함</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            1-10문서 §5 기준입니다. 본인 지점 문서와 전사 문서만 보입니다. 삭제는 본사 관리자만 할 수 있고
            (소프트 삭제), 보존기한이 지나도 자동 삭제되지 않습니다.
          </p>
        </div>
        <button className="btn-secondary primary" style={{ flexShrink: 0 }} onClick={() => setShowUpload(true)}>
          + 문서 등록
        </button>
      </div>

      {isSuperAdmin && (alertsQuery.data?.length ?? 0) > 0 && (
        <div className="detail-section">
          <h3 className="section-title">보존기한 임박·경과 문서 ({alertsQuery.data!.length}건)</h3>
          <table>
            <thead>
              <tr>
                <th>제목</th>
                <th>분류</th>
                <th>지점</th>
                <th>보존기한</th>
              </tr>
            </thead>
            <tbody>
              {alertsQuery.data!.map((d) => (
                <tr key={d.id}>
                  <td>{d.title}</td>
                  <td>{CATEGORY_LABEL[d.category]}</td>
                  <td>{d.branchName ?? '전사'}</td>
                  <td>
                    <RetentionCell retentionUntil={d.retentionUntil} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {deleteMutation.isError && <div className="forbidden-note">{apiErrorMessage(deleteMutation.error)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}

      <div className="wf-tab-row" style={{ display: 'flex', gap: 4, margin: '14px 0' }}>
        {(['ALL', 'CONTRACT', 'HR_RECORD', 'MANUAL', 'OTHER'] as const).map((c) => (
          <button key={c} className={category === c ? 'filter-chip active' : 'filter-chip'} onClick={() => setCategory(c)}>
            {c === 'ALL' ? '전체' : CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {!isLoading && !isError && rows.length === 0 && <div className="empty-state">표시할 문서가 없습니다.</div>}

      {rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>제목</th>
              <th>분류</th>
              <th>지점</th>
              <th>대상 직원</th>
              <th>보존기한</th>
              <th>등록자</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>
                  <a href={d.fileUrl} target="_blank" rel="noreferrer">
                    {d.title}
                  </a>
                </td>
                <td>{CATEGORY_LABEL[d.category]}</td>
                <td>{d.branchName ?? '전사'}</td>
                <td>{d.relatedStaffName ?? '-'}</td>
                <td>
                  <RetentionCell retentionUntil={d.retentionUntil} />
                </td>
                <td>{d.uploadedByName ?? '-'}</td>
                <td>
                  {isSuperAdmin && (
                    <button
                      className="btn-danger-outline"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(d.id)}
                    >
                      삭제
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showUpload && <UploadDocumentModal onClose={() => setShowUpload(false)} />}
    </>
  );
}
