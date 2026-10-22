import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage } from '../lib/use-api-list';
import { useAuth } from '../lib/use-auth';
import { useCan } from '../lib/use-can';
import { ApiEnvelope, PostCategory, PostRow } from '../lib/types';

const PAGE_SIZE = 20;

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

export function BoardPage() {
  const { user } = useAuth();
  const can = useCan();
  const navigate = useNavigate();
  // 'TRAINING' = RFP 게시판 "본사→현장 직원관리 탭(운영 교육 매뉴얼·자료)" — 본사 공지 중 교육자료만(log/114).
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'TRAINING' | PostRow['scope']>('ALL');
  const [page, setPage] = useState(1);

  // ADR-BRD-02 — 필터가 바뀌면 이전 필터 기준 페이지 번호가 의미 없어지므로 1로 되돌린다.
  // useEffect로 하면 한 번 더 렌더되므로, CollapsibleBranchSection과 같은 패턴으로 렌더 중에 보정한다.
  const [prevScopeFilter, setPrevScopeFilter] = useState(scopeFilter);
  if (scopeFilter !== prevScopeFilter) {
    setPrevScopeFilter(scopeFilter);
    setPage(1);
  }

  const { data, isLoading, isError, error } = useQuery<
    { posts: PostRow[]; total: number },
    AxiosError<ApiErrorBody>
  >({
    queryKey: ['posts', scopeFilter, page],
    queryFn: async () => {
      const scopeParam =
        scopeFilter === 'ALL'
          ? ''
          : scopeFilter === 'TRAINING'
            ? '&scope=HQ_TO_BRANCH&category=TRAINING_MATERIAL'
            : `&scope=${scopeFilter}`;
      const res = await api.get<ApiEnvelope<PostRow[]>>(`/posts?page=${page}&limit=${PAGE_SIZE}${scopeParam}`);
      return { posts: res.data.data ?? [], total: res.data.meta?.total ?? 0 };
    },
  });

  const canWrite = (user?.role === 'SUPER_ADMIN' || user?.role === 'BRANCH_ADMIN') && can('post', 'CREATE');
  const posts = data?.posts ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>게시판</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            게시판 문서 기준입니다. 전체 공지 + 본인 지점 공지만 보입니다.
          </p>
        </div>
        {canWrite && (
          <button className="btn-secondary primary" style={{ flexShrink: 0 }} onClick={() => navigate('/board/new')}>
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
        {user?.role !== 'MEMBER' && (
          <button
            className={scopeFilter === 'TRAINING' ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setScopeFilter('TRAINING')}
          >
            직원 교육자료
          </button>
        )}
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
                {post.facilityName ? ` · ${post.facilityName}` : ''}
              </span>
              <span>
                {post.publishedAt} · 조회 {post.viewCount}
              </span>
            </div>
          </div>
        ))}

      {!isLoading && !isError && total > 0 && (
        <div className="action-row" style={{ justifyContent: 'center', gap: 12, marginTop: 8 }}>
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            이전
          </button>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            {page} / {totalPages}페이지 (전체 {total}건)
          </span>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            다음
          </button>
        </div>
      )}

    </>
  );
}
