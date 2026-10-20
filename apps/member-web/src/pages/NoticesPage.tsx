import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoad } from '../lib/use-load';
import { describeError } from '../lib/errors';
import { shortDate } from '../lib/format';
import { Facility, Post } from '../lib/types';
import { HOME_CARD_CACHE_MS } from '../lib/congestion';
import { SkeletonList } from '../components/Skeleton';

const PAGE_SIZE = 20;

// 공지 목록 — 쪽마다 GET /posts?sort=latest 1회(ADR-BRD-02·03). 회원에게 보이는 글만 온다(ADR-BRD-01).
// 시설 고르기(ADR-BRD-05)는 홈 혼잡도 카드와 같은 GET /facilities 캐시를 쓴다(60초 안이면 추가 호출 없음).
export function NoticesPage() {
  const [page, setPage] = useState(1);
  const [facilityId, setFacilityId] = useState('');
  const facilities = useLoad<Facility[]>('/facilities', { cacheMs: HOME_CARD_CACHE_MS });
  const facilityParam = facilityId ? `&facilityId=${encodeURIComponent(facilityId)}` : '';
  const { data, meta, error, loading, reload } = useLoad<Post[]>(
    `/posts?sort=latest&limit=${PAGE_SIZE}&page=${page}${facilityParam}`,
  );
  const total = typeof meta?.total === 'number' ? meta.total : 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="stack">
      <div>
        <h1>공지</h1>
      </div>
      {(facilities.data ?? []).length > 0 && (
        <label className="field">
          <span>시설</span>
          <select
            value={facilityId}
            onChange={(e) => {
              setFacilityId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">전체</option>
            {(facilities.data ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}
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
        <p className="panel empty-state">{facilityId ? '이 시설의 공지가 없습니다.' : '공지가 없습니다.'}</p>
      ) : (
        <ul className="list">
          {(data ?? []).map((p) => (
            <li key={p.id}>
              <Link to={`/notices/${p.id}`} className="panel notice-card">
                <span className="notice-title">{p.title}</span>
                <span className="muted">
                  {shortDate(p.publishedAt)} · {p.scope === 'HQ_TO_BRANCH' ? '본사' : (p.branchName ?? '지점')}
                  {p.facilityName ? ` · ${p.facilityName}` : ''}
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
