import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoad } from '../lib/use-load';
import { describeError } from '../lib/errors';
import { shortDate } from '../lib/format';
import { Post } from '../lib/types';
import { SkeletonList } from '../components/Skeleton';

const PAGE_SIZE = 20;

// 공지 목록 — 쪽마다 GET /posts?sort=latest 1회(ADR-BRD-02·03). 회원에게 보이는 글만 온다(ADR-BRD-01).
export function NoticesPage() {
  const [page, setPage] = useState(1);
  const { data, meta, error, loading, reload } = useLoad<Post[]>(`/posts?sort=latest&limit=${PAGE_SIZE}&page=${page}`);
  const total = typeof meta?.total === 'number' ? meta.total : 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="stack">
      <div>
        <h1>공지</h1>
      </div>
      {error ? (
        <div className="panel error-panel" role="alert">
          <p>{describeError(error, '공지를 불러오지 못했습니다.')}</p>
          <button type="button" className="secondary-button" onClick={reload}>
            다시 시도
          </button>
        </div>
      ) : loading ? (
        <SkeletonList />
      ) : (data ?? []).length === 0 ? (
        <p className="panel empty-state">공지가 없습니다.</p>
      ) : (
        <ul className="list">
          {(data ?? []).map((p) => (
            <li key={p.id}>
              <Link to={`/notices/${p.id}`} className="panel notice-card">
                <span className="notice-title">{p.title}</span>
                <span className="muted">
                  {shortDate(p.publishedAt)} · {p.scope === 'HQ_TO_BRANCH' ? '본사' : (p.branchName ?? '지점')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {lastPage > 1 && (
        <div className="pager">
          <button type="button" className="secondary-button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            이전
          </button>
          <span className="muted">
            {page} / {lastPage}
          </span>
          <button
            type="button"
            className="secondary-button"
            disabled={page >= lastPage || loading}
            onClick={() => setPage(page + 1)}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
