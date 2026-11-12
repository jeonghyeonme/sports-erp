import { FormEvent, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { useCan } from '../lib/use-can';
import { apiErrorMessage, useApiList, useApiPage, ApiError } from '../lib/use-api-list';
import { Modal } from '../components/Modal';
import { ApiEnvelope, BranchSummary, DocumentCategory, DocumentRow, StaffRow } from '../lib/types';

import { useToast } from '../lib/use-toast';
import { kstToday } from '../lib/kst-date';
import { SortTh } from '../components/SortTh';
import { setSortParams, useSortState } from '../lib/table-sort';
import { DOCUMENT_CATEGORY_LABEL } from '../lib/status-labels';
import { ExportCsvButton } from '../components/ExportCsvButton';
import { fetchAllPages, kstDateStamp } from '../lib/csv';
import { Pager } from '../components/Pager';
import { ConfirmModal } from '../components/ConfirmModal';
import { useDebouncedValue } from '../lib/use-debounced';
import { DOCUMENT_FILE_ACCEPT, DOCUMENT_FILE_MAX_BYTES, openDocument, uploadDocumentFile } from '../lib/document-files';
import { DOCUMENT_COLUMNS } from '../lib/export-columns';

// D69 — 위탁운영 계약서는 문서 관리가 아니라 지점 상세의 계약 회차에서 올리고 연다(접근 경로 최소화).
// D69 2차(log/206) — 쌓이는 목록이라 서버 쪽 나누기(20건)·검색(제목·대상 직원)·정렬(서버, apps/api DOCUMENT_SORT_KEYS와 같다).
type DocumentSortKey = 'title' | 'category' | 'branch' | 'relatedStaff' | 'retentionUntil' | 'uploader' | 'createdAt';
const PAGE_SIZE = 20;

// 자원문서관리 A-6 — 카테고리별 보존기한 정책 안내(입력 시 미리보기).
const RETENTION_HINT: Record<DocumentCategory, string> = {
  HR_RECORD: '근로관계 종료일(없으면 업로드일)로부터 3년 — 자동 계산됩니다.',
  MANUAL: '법정 보존 의무가 없어 영구 보관됩니다.',
  OTHER: '법정 보존 의무가 없어 영구 보관됩니다.',
};

function daysUntil(date: string): number {
  const today = new Date(kstToday()).getTime();
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
}

const EMPTY_FORM: DocForm = { category: 'MANUAL', branchId: '', relatedStaffId: '', title: '' };

function UploadDocumentModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [form, setForm] = useState<DocForm>(EMPTY_FORM);
  // D69 2차 — 파일 하나(형식·한도는 게시판 첨부와 같다, D57). 고르면 제목이 비어 있을 때 파일 이름으로 채운다.
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const branchesQuery = useApiList<BranchSummary>(['branches'], '/branches');
  const staffQuery = useApiList<StaffRow>(['staff'], '/staff');

  const staffOptions = (staffQuery.data ?? []).filter(
    (s) => !isSuperAdmin || !form.branchId || s.branchId === form.branchId,
  );

  const uploadMutation = useMutation<DocumentRow, ApiError, DocForm & { file: File }>({
    // 저장소에 먼저 올리고(업로드 URL) 그 경로로 등록한다 — 서버가 크기·형식을 다시 본다.
    mutationFn: async (dto) => {
      const stored = await uploadDocumentFile(dto.file);
      const payload = {
        category: dto.category,
        branchId: isSuperAdmin ? dto.branchId || undefined : undefined,
        relatedStaffId: dto.category === 'HR_RECORD' ? dto.relatedStaffId || undefined : undefined,
        title: dto.title.trim(),
        file: stored,
      };
      return (await api.post<ApiEnvelope<DocumentRow>>('/documents', payload)).data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('문서를 등록했습니다.');
      onClose();
    },
  });

  function pickFile(picked: File | null) {
    setFileError('');
    if (picked && picked.size > DOCUMENT_FILE_MAX_BYTES) {
      setFileError('파일 하나는 10MB까지 올릴 수 있습니다.');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setFile(picked);
    if (picked && !form.title.trim()) setForm((f) => ({ ...f, title: picked.name.replace(/\.[^.]+$/, '') }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !file) return;
    uploadMutation.mutate({ ...form, file });
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
              {(Object.keys(DOCUMENT_CATEGORY_LABEL) as DocumentCategory[]).map((c) => (
                <option key={c} value={c}>
                  {DOCUMENT_CATEGORY_LABEL[c]}
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
          <label>파일 *</label>
          <input
            ref={fileInput}
            type="file"
            accept={DOCUMENT_FILE_ACCEPT}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            required
          />
          <p className="page-desc" style={{ margin: '4px 0 0' }}>
            PDF·이미지·오피스·한글 파일, 10MB까지. 열 때마다 열람 기록이 남습니다.
          </p>
          {fileError && <div className="forbidden-note">{fileError}</div>}
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>제목 *</label>
          <input value={form.title} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
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
          <button type="submit" className="btn-secondary primary" disabled={uploadMutation.isPending || !file}>
            {uploadMutation.isPending ? '올리는 중...' : '등록'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DocumentsPage() {
  const { user } = useAuth();
  const can = useCan();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [category, setCategory] = useState<'ALL' | DocumentCategory>('ALL');
  const [showUpload, setShowUpload] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DocumentRow | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  // D69 2차(log/206) — 서버 쪽 나누기·검색(치는 대로)·정렬. 조건이 바뀌면 1쪽부터.
  const [searchInput, setSearchInput] = useState('');
  const q = useDebouncedValue(searchInput.trim());
  const { sort, toggle: toggleSort } = useSortState<DocumentSortKey>();
  const [page, setPage] = useState(1);
  const filterKey = `${category}|${q}|${sort?.key}|${sort?.dir}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }
  const conditions = () => {
    const p = new URLSearchParams();
    if (category !== 'ALL') p.set('category', category);
    if (q) p.set('q', q);
    return setSortParams(p, sort);
  };
  const params = conditions();
  params.set('page', String(page));
  params.set('limit', String(PAGE_SIZE));
  const { data, isLoading, isFetching, isError, error } = useApiPage<DocumentRow>(
    ['documents', category, q, sort, page],
    `/documents?${params}`,
  );
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const alertsQuery = useApiList<DocumentRow>(['documents', 'alerts'], '/documents/retention-alerts', isSuperAdmin);

  const deleteMutation = useMutation<unknown, ApiError, DocumentRow>({
    mutationFn: async (doc) => (await api.delete(`/documents/${doc.id}`)).data,
    onSuccess: (_, doc) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(`'${doc.title}'을(를) 삭제했습니다.`);
    },
    onSettled: () => setConfirmDelete(null),
  });

  // 열람 기록은 서버가 남긴다(D69 2차). 옛 주소 문서는 새 탭, 올린 파일은 내려받기.
  async function open(doc: DocumentRow) {
    setOpening(doc.id);
    try {
      await openDocument(doc);
    } catch (e) {
      toast.error(apiErrorMessage(e as ApiError) ?? '문서를 열지 못했습니다.');
    } finally {
      setOpening(null);
    }
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>문서함</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            자원문서관리 부록 A 기준입니다. 본인 지점 문서와 전사 문서만 보입니다. 제목을 누르면 파일을 열고, 열 때마다 열람
            기록이 남습니다. 삭제는 본사 관리자만 할 수 있고(소프트 삭제), 보존기한이 지나도 자동 삭제되지 않습니다.
          </p>
        </div>
        {can('document', 'CREATE') && (
          <button className="btn-secondary primary" style={{ flexShrink: 0 }} onClick={() => setShowUpload(true)}>
            + 문서 등록
          </button>
        )}
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
                  <td>{DOCUMENT_CATEGORY_LABEL[d.category]}</td>
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

      <div className="list-toolbar" style={{ gap: 8, margin: '14px 0' }}>
        <input
          className="search-input"
          type="search"
          placeholder="제목 · 대상 직원 검색"
          aria-label="문서 검색"
          value={searchInput}
          maxLength={50}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {(['ALL', 'HR_RECORD', 'MANUAL', 'OTHER'] as const).map((c) => (
          <button key={c} className={category === c ? 'filter-chip active' : 'filter-chip'} onClick={() => setCategory(c)}>
            {c === 'ALL' ? '전체' : DOCUMENT_CATEGORY_LABEL[c]}
          </button>
        ))}
        {/* ADR-AUTH-09 — 지금 분류·검색·정렬 그대로 모든 쪽(파일 주소는 넣지 않는다). 서버가 출력 권한을 본다(export=true) */}
        <span style={{ marginLeft: 'auto' }}>
          <ExportCsvButton
            filename={`documents_${kstDateStamp()}.csv`}
            feature="document"
            columns={DOCUMENT_COLUMNS}
            disabled={total === 0}
            load={() => {
              const p = conditions();
              p.set('export', 'true');
              return fetchAllPages<DocumentRow>('/documents', p);
            }}
          />
        </span>
      </div>

      {!isLoading && !isError && rows.length === 0 && <div className="empty-state">조건에 맞는 문서가 없습니다.</div>}

      {rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <SortTh label="제목" sortKey="title" sort={sort} onToggle={toggleSort} />
              <SortTh label="분류" sortKey="category" sort={sort} onToggle={toggleSort} />
              <SortTh label="지점" sortKey="branch" sort={sort} onToggle={toggleSort} />
              <SortTh label="대상 직원" sortKey="relatedStaff" sort={sort} onToggle={toggleSort} />
              <SortTh label="보존기한" sortKey="retentionUntil" sort={sort} onToggle={toggleSort} />
              <SortTh label="등록자" sortKey="uploader" sort={sort} onToggle={toggleSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>
                  <button type="button" className="link-button" disabled={opening !== null} onClick={() => open(d)}>
                    {d.title}
                  </button>
                  <div className="page-desc" style={{ margin: 0 }}>
                    {d.stored ? d.fileName : '옛 링크 문서'}
                  </div>
                </td>
                <td>{DOCUMENT_CATEGORY_LABEL[d.category]}</td>
                <td>{d.branchName ?? '전사'}</td>
                <td>{d.relatedStaffName ?? '-'}</td>
                <td>
                  <RetentionCell retentionUntil={d.retentionUntil} />
                </td>
                <td>{d.uploadedByName ?? '-'}</td>
                <td>
                  {isSuperAdmin && (
                    <button className="btn-danger-outline" disabled={deleteMutation.isPending} onClick={() => setConfirmDelete(d)}>
                      삭제
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} disabled={isFetching} />

      {showUpload && <UploadDocumentModal onClose={() => setShowUpload(false)} />}
      {/* D74 — 확인 창. 소프트 삭제(D9)라 기록은 남지만 문서함에서는 사라진다 */}
      {confirmDelete && (
        <ConfirmModal
          title="문서 삭제"
          confirmLabel="삭제"
          danger
          pending={deleteMutation.isPending}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => deleteMutation.mutate(confirmDelete)}
        >
          <p style={{ marginTop: 0 }}>
            <strong>{confirmDelete.title}</strong>을(를) 문서함에서 지울까요?
          </p>
          <p className="page-desc">기록은 남아(소프트 삭제) 감사·분쟁 때 되살릴 수 있습니다.</p>
        </ConfirmModal>
      )}
    </>
  );
}
