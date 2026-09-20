import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { useAuth } from '../lib/use-auth';
import { Modal } from '../components/Modal';
import { ApiEnvelope, BranchSummary, PostCategory, PostRow } from '../lib/types';

const SCOPE_LABEL: Record<PostRow['scope'], string> = {
  HQ_TO_BRANCH: '본사 공지',
  BRANCH_TO_MEMBER: '지점 공지',
};

const CATEGORY_LABEL: Record<PostCategory, string> = {
  NOTICE: '공지',
  TRAINING_MATERIAL: '교육자료',
  EVENT: '이벤트',
  OTHER: '기타',
};

interface ApiErrorBody {
  code?: string;
  message?: string;
}

interface PostForm {
  title: string;
  content: string;
  category: PostCategory;
  branchId: string;
}

const EMPTY_FORM: PostForm = { title: '', content: '', category: 'NOTICE', branchId: '' };

function CreatePostModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PostForm>(EMPTY_FORM);
  const branchesQuery = useApiList<BranchSummary>(['branches'], '/branches');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const createMutation = useMutation<PostRow, AxiosError<ApiErrorBody>, PostForm>({
    mutationFn: async (dto) => {
      const payload = {
        title: dto.title,
        content: dto.content,
        category: dto.category,
        branchId: isSuperAdmin ? dto.branchId || undefined : undefined,
      };
      return (await api.post<ApiEnvelope<PostRow>>('/posts', payload)).data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    createMutation.mutate(form);
  }

  return (
    <Modal title="게시글 작성" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label>제목 *</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          </div>
          <div className="field">
            <label>카테고리</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as PostCategory }))}
            >
              {(Object.keys(CATEGORY_LABEL) as PostCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {isSuperAdmin && (
          <div className="field" style={{ marginTop: 12 }}>
            <label>대상 지점</label>
            <select value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}>
              <option value="">전체 지점 공지</option>
              {(branchesQuery.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field" style={{ marginTop: 12 }}>
          <label>내용 *</label>
          <textarea
            rows={5}
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            required
          />
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

export function BoardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scopeFilter, setScopeFilter] = useState<'ALL' | PostRow['scope']>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading, isError, error } = useApiList<PostRow>(['posts'], '/posts');

  const canWrite = user?.role === 'SUPER_ADMIN' || user?.role === 'BRANCH_ADMIN';

  const posts = useMemo(() => {
    const all = data ?? [];
    return scopeFilter === 'ALL' ? all : all.filter((p) => p.scope === scopeFilter);
  }, [data, scopeFilter]);

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>게시판</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            04문서 기준입니다. 전체 공지 + 본인 지점 공지만 보입니다.
          </p>
        </div>
        {canWrite && (
          <button className="btn-secondary primary" style={{ flexShrink: 0 }} onClick={() => setShowCreate(true)}>
            + 글쓰기
          </button>
        )}
      </div>

      <div className="wf-tab-row" style={{ display: 'flex', gap: 4, margin: '14px 0' }}>
        <button
          className={scopeFilter === 'ALL' ? 'filter-chip active' : 'filter-chip'}
          onClick={() => setScopeFilter('ALL')}
        >
          전체
        </button>
        <button
          className={scopeFilter === 'HQ_TO_BRANCH' ? 'filter-chip active' : 'filter-chip'}
          onClick={() => setScopeFilter('HQ_TO_BRANCH')}
        >
          본사 공지
        </button>
        <button
          className={scopeFilter === 'BRANCH_TO_MEMBER' ? 'filter-chip active' : 'filter-chip'}
          onClick={() => setScopeFilter('BRANCH_TO_MEMBER')}
        >
          지점 공지
        </button>
      </div>

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}
      {!isLoading && !isError && posts.length === 0 && <div className="empty-state">표시할 게시글이 없습니다.</div>}

      {!isError &&
        posts.map((post) => (
          <div
            className="card"
            key={post.id}
            style={{ marginBottom: 12, cursor: 'pointer' }}
            onClick={() => navigate(`/board/${post.id}`)}
          >
            <h3>
              {post.title}{' '}
              <span className="badge PREPARING">{SCOPE_LABEL[post.scope]}</span>{' '}
              <span className="badge RUNNING">{CATEGORY_LABEL[post.category]}</span>
            </h3>
            <div className="stat-row">
              <span>
                {post.authorName ?? '-'} {post.branchName ? `· ${post.branchName}` : ''}
              </span>
              <span>
                {post.publishedAt} · 조회 {post.viewCount}
              </span>
            </div>
          </div>
        ))}

      {showCreate && <CreatePostModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
