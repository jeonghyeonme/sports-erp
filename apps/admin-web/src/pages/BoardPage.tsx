import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { PostRow } from '../lib/types';

const SCOPE_LABEL: Record<PostRow['scope'], string> = {
  HQ_TO_BRANCH: '본사 → 지점',
  BRANCH_TO_MEMBER: '지점 → 회원',
};

export function BoardPage() {
  const { data, isLoading, isError, error } = useApiList<PostRow>(['posts'], '/posts');

  return (
    <>
      <h2>게시판</h2>
      <p className="page-desc">
        04문서 기준 더미 데이터입니다. 전체 공지(branchId 없음) + 본인 지점 공지만 보입니다.
      </p>

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}

      {!isError &&
        data?.map((post) => (
          <div className="card" key={post.id} style={{ marginBottom: 12 }}>
            <h3>
              {post.title} <span className="badge PREPARING">{SCOPE_LABEL[post.scope]}</span>
            </h3>
            <div className="stat-row">
              <span>{post.authorName}</span>
              <span>{post.publishedAt}</span>
            </div>
            <p style={{ fontSize: 13, color: '#4b5563', margin: '8px 0 0' }}>{post.content}</p>
          </div>
        ))}
    </>
  );
}
