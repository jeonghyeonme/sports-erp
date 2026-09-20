import { FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage } from '../lib/use-api-list';
import { useAuth } from '../lib/use-auth';
import { ApiEnvelope, PostCategory, PostRow } from '../lib/types';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

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

interface EditForm {
  title: string;
  content: string;
  category: PostCategory;
}

function toEditForm(post: PostRow): EditForm {
  return { title: post.title, content: post.content, category: post.category };
}

export function PostDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);

  const postQuery = useQuery<PostRow, AxiosError<ApiErrorBody>>({
    queryKey: ['posts', id],
    queryFn: async () => (await api.get<ApiEnvelope<PostRow>>(`/posts/${id}`)).data.data!,
  });

  const updateMutation = useMutation<PostRow, AxiosError<ApiErrorBody>, EditForm>({
    mutationFn: async (dto) => (await api.patch<ApiEnvelope<PostRow>>(`/posts/${id}`, dto)).data.data!,
    onSuccess: (updated) => {
      queryClient.setQueryData(['posts', id], updated);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation<void, AxiosError<ApiErrorBody>, void>({
    mutationFn: async () => {
      await api.delete(`/posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      navigate('/board');
    },
  });

  function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!form || !form.title.trim() || !form.content.trim()) return;
    updateMutation.mutate(form);
  }

  if (postQuery.isLoading) return <div className="loading-state">불러오는 중...</div>;
  if (postQuery.isError) {
    return <div className="forbidden-note">{apiErrorMessage(postQuery.error)}</div>;
  }
  const post = postQuery.data!;
  const isAuthor = post.authorId === user?.accountId;
  const canDelete = isAuthor || user?.role === 'SUPER_ADMIN';

  return (
    <>
      <div className="page-header">
        <Link className="back-link" to="/board">
          ← 게시판으로
        </Link>
      </div>

      <div className="card">
        {!editing ? (
          <>
            <h2 style={{ marginTop: 0 }}>
              {post.title}{' '}
              <span className="badge PREPARING">{SCOPE_LABEL[post.scope]}</span>{' '}
              <span className="badge RUNNING">{CATEGORY_LABEL[post.category]}</span>
            </h2>
            <div className="stat-row">
              <span>
                {post.authorName ?? '-'} {post.branchName ? `· ${post.branchName}` : ''}
              </span>
              <span>
                {post.publishedAt} · 조회 {post.viewCount}
              </span>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>{post.content}</p>

            {deleteMutation.isError && (
              <div className="forbidden-note" style={{ marginTop: 12 }}>
                {apiErrorMessage(deleteMutation.error)}
              </div>
            )}

            {(isAuthor || canDelete) && (
              <div className="action-row" style={{ marginTop: 16 }}>
                {isAuthor && (
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      // 편집 폼은 "편집을 시작하는 시점"의 최신 게시글로 채운다(effect로 미리 복사하지 않음).
                      setForm(toEditForm(post));
                      setEditing(true);
                    }}
                  >
                    수정
                  </button>
                )}
                {canDelete && (
                  <button
                    className="btn-danger-outline"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate()}
                  >
                    삭제
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          form && (
            <form onSubmit={submitEdit}>
              <div className="form-row">
                <div className="field">
                  <label>제목 *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </div>
                <div className="field">
                  <label>카테고리</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as PostCategory })}
                  >
                    {(Object.keys(CATEGORY_LABEL) as PostCategory[]).map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label>내용 *</label>
                <textarea
                  rows={6}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  required
                />
              </div>

              {updateMutation.isError && (
                <div className="forbidden-note" style={{ marginTop: 12 }}>
                  {apiErrorMessage(updateMutation.error)}
                </div>
              )}

              <div className="action-row" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setForm(toEditForm(post));
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
    </>
  );
}
