import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PostAttachments } from '../components/PostAttachments';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage } from '../lib/use-api-list';
import { useAuth } from '../lib/use-auth';
import { useCan } from '../lib/use-can';
import { ApiEnvelope, PostCategory, PostRow } from '../lib/types';
import { RichContent } from '../components/RichContent';

import { useToast } from '../lib/use-toast';
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

export function PostDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();
  const can = useCan();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
const toast = useToast();

  const postQuery = useQuery<PostRow, AxiosError<ApiErrorBody>>({
    queryKey: ['posts', id],
    queryFn: async () => (await api.get<ApiEnvelope<PostRow>>(`/posts/${id}`)).data.data!,
  });

  const deleteMutation = useMutation<void, AxiosError<ApiErrorBody>, void>({
    mutationFn: async () => {
      await api.delete(`/posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('게시글을 삭제했습니다.');
      navigate('/board');
    },
  });

  if (postQuery.isLoading) return <div className="loading-state">불러오는 중...</div>;
  if (postQuery.isError) {
    return <div className="forbidden-note">{apiErrorMessage(postQuery.error)}</div>;
  }
  const post = postQuery.data!;
  // D60 — 작성자여도 게시판 수정·삭제 권한이 꺼지면 버튼을 숨긴다(첨부 올리기·지우기는 수정 권한)
  const isAuthor = post.authorId === user?.accountId && can('post', 'UPDATE');
  const canDelete = (post.authorId === user?.accountId && can('post', 'DELETE')) || user?.role === 'SUPER_ADMIN';

  return (
    <>
      <div className="page-header">
      </div>

      <div className="card">
        <>
            <h2 style={{ marginTop: 0 }}>
              {post.title}{' '}
              <span className="badge PREPARING">{SCOPE_LABEL[post.scope]}</span>{' '}
              <span className="badge RUNNING">{CATEGORY_LABEL[post.category]}</span>
            </h2>
            <div className="stat-row">
              <span>
                {post.authorName ?? '-'} {post.branchName ? `· ${post.branchName}` : ''}
                {post.facilityName ? ` · 대상 시설 ${post.facilityName}` : ''}
              </span>
              <span>
                {post.publishedAt} · 조회 {post.viewCount}
              </span>
            </div>
            <RichContent content={post.content} />

            {/* 게시판 ADR-BRD-04 — 첨부 보기. 작성자의 올리기·지우기는 수정 화면에서 본문과 함께(D62), 본사는 여기서도 지울 수 있다 */}
            <PostAttachments
              postId={post.id}
              attachments={post.attachments ?? []}
              canUpload={false}
              canDelete={user?.role === 'SUPER_ADMIN'}
            />

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
                    // D62 — 본문·첨부를 함께 고치는 수정 화면으로 간다
                    onClick={() => navigate(`/board/${post.id}/edit`)}
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
      </div>
    </>
  );
}
