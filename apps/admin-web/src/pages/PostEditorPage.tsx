import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { useAuth } from '../lib/use-auth';
import { useToast } from '../lib/use-toast';
import { useCan } from '../lib/use-can';
import { ApiEnvelope, BranchSummary, FacilityRow, PostCategory, PostRow } from '../lib/types';
import { isHtmlContent } from '../lib/rich-content';
import { ATTACHMENT_ACCEPT, ATTACHMENT_MAX_BYTES, ATTACHMENT_MAX_FILES, uploadAttachment } from '../lib/post-attachments';
import { RichEditor } from '../components/RichEditor';
import { PostAttachments } from '../components/PostAttachments';

// D62 — 게시글 글쓰기(/board/new)·수정(/board/:id/edit)을 별도 화면으로. 본문(서식 편집기)과 첨부를 한 화면에서 다룬다.
// 새 글은 첨부를 골라 두었다가 등록 직후 올리고(글 id가 있어야 올릴 수 있다), 수정은 첨부 칸이 바로 올리고 지운다.

interface ApiErrorBody {
  code?: string;
  message?: string;
}

const CATEGORY_LABEL: Record<PostCategory, string> = {
  NOTICE: '공지',
  TRAINING_MATERIAL: '교육자료',
  EVENT: '이벤트',
  OTHER: '기타',
};

interface PostForm {
  title: string;
  content: string;
  category: PostCategory;
  branchId: string;
  visibleToMember: boolean;
  facilityId: string;
}

// 예전 평문 글을 편집기로 열 때는 줄마다 문단으로 바꾼다(편집기는 HTML을 받는다).
function toEditorHtml(content: string): string {
  if (isHtmlContent(content)) return content;
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return content
    .split(/\r?\n/)
    .map((line) => `<p>${esc(line)}</p>`)
    .join('');
}

export function PostEditorPage() {
  const { id } = useParams<{ id: string }>();
  const postQuery = useQuery<PostRow, AxiosError<ApiErrorBody>>({
    queryKey: ['posts', id],
    enabled: !!id,
    queryFn: async () => (await api.get<ApiEnvelope<PostRow>>(`/posts/${id}`)).data.data!,
  });
  if (!id) return <PostEditor />;
  if (postQuery.isLoading) return <div className="loading-state">불러오는 중...</div>;
  if (postQuery.isError) return <div className="forbidden-note">{apiErrorMessage(postQuery.error)}</div>;
  return <PostEditor key={id} post={postQuery.data!} />;
}

function PostEditor({ post }: { post?: PostRow }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const can = useCan();
  const isEdit = !!post;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  // 시설 지정(게시판 ADR-BRD-05)은 지점 공지만 — 새 글은 지점 관리자, 수정은 그 글이 지점 공지일 때
  const isBranchPost = isEdit ? post.scope === 'BRANCH_TO_MEMBER' : !isSuperAdmin;
  const facilityBranchId = isEdit ? post.branchId : user?.branchId;

  const [form, setForm] = useState<PostForm>(() => ({
    title: post?.title ?? '',
    content: post ? toEditorHtml(post.content) : '',
    category: post?.category ?? 'NOTICE',
    branchId: post?.branchId ?? '',
    visibleToMember: post?.visibleToMember ?? false,
    facilityId: post?.facilityId ?? '',
  }));
  const [pending, setPending] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const branchesQuery = useApiList<BranchSummary>(['branches'], '/branches', isSuperAdmin && !isEdit);
  const facilitiesQuery = useApiList<FacilityRow>(
    ['facilities', facilityBranchId],
    `/facilities?branchId=${facilityBranchId ?? ''}`,
    isBranchPost && !!facilityBranchId,
  );

  const save = useMutation<PostRow, AxiosError<ApiErrorBody>, PostForm>({
    mutationFn: async (f) => {
      if (isEdit) {
        const payload = {
          title: f.title,
          content: f.content,
          category: f.category,
          facilityId: isBranchPost ? f.facilityId || null : undefined,
        };
        return (await api.patch<ApiEnvelope<PostRow>>(`/posts/${post.id}`, payload)).data.data!;
      }
      const payload = {
        title: f.title,
        content: f.content,
        category: f.category,
        branchId: isSuperAdmin ? f.branchId || undefined : undefined,
        visibleToMember: isSuperAdmin ? f.visibleToMember : undefined,
        facilityId: !isSuperAdmin && f.facilityId ? f.facilityId : undefined,
      };
      const created = (await api.post<ApiEnvelope<PostRow>>('/posts', payload)).data.data!;
      // 골라 둔 첨부는 글이 생긴 뒤 올린다. 하나가 실패해도 글은 남는다 — 상세에서 다시 올리면 된다.
      for (const file of pending) {
        try {
          await uploadAttachment(created.id, file);
        } catch (err) {
          toast.error(`${file.name}: ${apiErrorMessage(err as AxiosError) ?? (err as Error).message ?? '첨부하지 못했습니다.'}`);
        }
      }
      return created;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success(isEdit ? '게시글을 수정했습니다.' : '게시글을 등록했습니다.');
      navigate(`/board/${saved.id}`);
    },
  });

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > ATTACHMENT_MAX_BYTES) {
      toast.error('파일 하나는 10MB까지 올릴 수 있습니다.');
      return;
    }
    setPending((list) => [...list, file]);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (!form.content.trim()) {
      toast.error('내용을 입력하세요.');
      return;
    }
    save.mutate(form);
  }

  // 판정은 서버가 한다(작성자만 수정, D60 세부 권한). 화면은 안내만.
  if (isEdit && (post.authorId !== user?.accountId || !can('post', 'UPDATE'))) {
    return <div className="forbidden-note">본인이 작성한 게시글만 수정할 수 있습니다.</div>;
  }
  if (!isEdit && !can('post', 'CREATE')) {
    return <div className="forbidden-note">게시글 작성 권한이 없습니다.</div>;
  }

  return (
    <>
      <div className="page-header">
        <h2>{isEdit ? '게시글 수정' : '게시글 작성'}</h2>
        <p className="page-desc" style={{ marginBottom: 0 }}>
          {isSuperAdmin ? '본사 공지(본사 → 현장)입니다.' : '지점 공지(현장 → 이용자)입니다. 지점 회원에게 보입니다.'} 이미지는 본문에
          넣지 않고 아래 첨부로 올리면 회원 앱 본문 아래에 바로 보입니다.
        </p>
      </div>
      <form className="card" onSubmit={submit}>
        <div className="form-row">
          <div className="field" style={{ flex: 3 }}>
            <label>제목 *</label>
            <input value={form.title} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          </div>
          <div className="field">
            <label>카테고리</label>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as PostCategory }))}>
              {(Object.keys(CATEGORY_LABEL) as PostCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isSuperAdmin && !isEdit && (
          <div className="form-row" style={{ marginTop: 12 }}>
            <div className="field">
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
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.visibleToMember}
                  onChange={(e) => setForm((f) => ({ ...f, visibleToMember: e.target.checked }))}
                  style={{ marginRight: 6 }}
                />
                회원에게도 공개(기본: 직원 전용)
              </label>
            </div>
          </div>
        )}
        {isBranchPost && (
          <div className="field" style={{ marginTop: 12 }}>
            <label>대상 시설</label>
            <select value={form.facilityId} onChange={(e) => setForm((f) => ({ ...f, facilityId: e.target.value }))}>
              <option value="">지점 전체</option>
              {(facilitiesQuery.data ?? []).map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field" style={{ marginTop: 12 }}>
          <label>내용 *</label>
          <RichEditor
            label="내용"
            initialContent={form.content}
            onChange={(html) => setForm((f) => ({ ...f, content: html }))}
          />
        </div>

        {/* 첨부 — 수정은 바로 올리고 지운다, 새 글은 등록할 때 함께 올린다 */}
        {isEdit ? (
          <PostAttachments postId={post.id} attachments={post.attachments ?? []} canUpload canDelete />
        ) : (
          <div className="detail-section" style={{ marginTop: 16 }}>
            <h3 className="section-title">첨부 파일 {pending.length > 0 && `(${pending.length})`}</h3>
            {pending.length > 0 && (
              <ul className="attachment-list">
                {pending.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <span>{f.name}</span>
                    <span className="page-desc"> {Math.max(1, Math.round(f.size / 1024))}KB · 등록할 때 올라갑니다</span>
                    <button
                      type="button"
                      className="btn-danger-outline"
                      style={{ marginLeft: 8, padding: '2px 8px' }}
                      onClick={() => setPending((list) => list.filter((_, j) => j !== i))}
                    >
                      빼기
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="action-row" style={{ alignItems: 'center' }}>
              <input ref={fileRef} type="file" accept={ATTACHMENT_ACCEPT} hidden onChange={pick} />
              <button
                type="button"
                className="btn-secondary"
                disabled={pending.length >= ATTACHMENT_MAX_FILES}
                onClick={() => fileRef.current?.click()}
              >
                + 파일 첨부
              </button>
              <span className="page-desc">
                PDF·이미지·오피스·한글, 파일당 10MB, 글당 {ATTACHMENT_MAX_FILES}개({pending.length}/{ATTACHMENT_MAX_FILES})
              </span>
            </div>
          </div>
        )}

        {save.isError && (
          <div className="forbidden-note" style={{ marginTop: 12 }}>
            {apiErrorMessage(save.error)}
          </div>
        )}
        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={() => navigate(isEdit ? `/board/${post.id}` : '/board')}>
            취소
          </button>
          <button type="submit" className="btn-secondary primary" disabled={save.isPending}>
            {save.isPending ? '저장하는 중...' : isEdit ? '저장' : '등록'}
          </button>
        </div>
      </form>
    </>
  );
}
