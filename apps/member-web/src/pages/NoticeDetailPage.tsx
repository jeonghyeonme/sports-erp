import { useParams } from 'react-router-dom';
import { useLoad } from '../lib/use-load';
import { describeError } from '../lib/errors';
import { shortDate } from '../lib/format';
import { Post } from '../lib/types';
import { SkeletonList } from '../components/Skeleton';
import { NoticeAttachments } from '../components/NoticeAttachments';
import { isHtmlContent, sanitizeRich } from '../lib/rich-content';

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
            {data.facilityName ? ` · ${data.facilityName}` : ''}
          </p>
          {/* D62 — 서식 있는 본문은 서버 허용 목록 정화 + 여기서 DOMPurify로 한 번 더 거른 HTML로 그린다(D41 재고 트리거 검토).
              예전 평문 글은 그대로 글자로. */}
          {isHtmlContent(data.content) ? (
            <div className="notice-body rich" dangerouslySetInnerHTML={{ __html: sanitizeRich(data.content) }} />
          ) : (
            <p className="notice-body">{data.content}</p>
          )}
          <NoticeAttachments postId={data.id} attachments={data.attachments ?? []} />
        </article>
      )}
    </div>
  );
}
