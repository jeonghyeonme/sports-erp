import { useParams } from 'react-router-dom';
import { useLoad } from '../lib/use-load';
import { describeError } from '../lib/errors';
import { shortDate } from '../lib/format';
import { Post } from '../lib/types';
import { SkeletonList } from '../components/Skeleton';

// 공지 상세 — GET /posts/:id 1회. 상세 조회가 조회수를 올리므로(게시판 D36 결정 2) 목록 데이터를 넘겨 쓰지 않고 부른다.
// 회원에게 보이지 않는 글은 서버가 404로 숨긴다(게시판 A-7).
export function NoticeDetailPage() {
  const { postId = '' } = useParams();
  const { data, error, loading } = useLoad<Post>(`/posts/${encodeURIComponent(postId)}`);

  return (
    <div className="stack">
      {error ? (
        <div className="panel error-panel" role="alert">
          <p>{describeError(error, '공지를 불러오지 못했습니다.')}</p>
        </div>
      ) : loading || !data ? (
        <SkeletonList />
      ) : (
        <article className="panel stack-sm">
          <h1>{data.title}</h1>
          <p className="muted">
            {shortDate(data.publishedAt)} · {data.scope === 'HQ_TO_BRANCH' ? '본사' : (data.branchName ?? '지점')}
          </p>
          {/* 본문은 텍스트로만 그린다(HTML로 해석하지 않음 — D41 재고 트리거: 사용자 HTML 렌더링 금지). */}
          <p className="notice-body">{data.content}</p>
        </article>
      )}
    </div>
  );
}
