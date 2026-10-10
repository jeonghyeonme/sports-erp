import { Link } from 'react-router-dom';
import { useLoad } from '../lib/use-load';
import { describeError } from '../lib/errors';
import { shortDate } from '../lib/format';
import { Post } from '../lib/types';
import { HOME_CARD_CACHE_MS } from '../lib/congestion';
import { SkeletonLines } from './Skeleton';

// 홈 최근 공지 3건 — GET /posts?sort=latest&limit=3 1회(ADR-BRD-03), 60초 안에 다시 오면 0회(캐시). 회원에게 보이는 글만 온다(ADR-BRD-01).
export function RecentNotices() {
  const { data, error, loading } = useLoad<Post[]>('/posts?sort=latest&limit=3', { cacheMs: HOME_CARD_CACHE_MS });

  return (
    <section className="panel stack-sm" aria-labelledby="notices-title">
      <div className="card-head">
        <h2 id="notices-title" className="card-title">
          공지
        </h2>
        <Link to="/notices" className="text-link small">
          전체 보기
        </Link>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {describeError(error, '공지를 불러오지 못했습니다.')}
        </p>
      ) : loading ? (
        <SkeletonLines />
      ) : (data ?? []).length === 0 ? (
        <p className="muted">새 공지가 없습니다.</p>
      ) : (
        <ul className="list">
          {(data ?? []).map((p) => (
            <li key={p.id}>
              <Link to={`/notices/${p.id}`} className="notice-row">
                <span className="notice-date">{shortDate(p.publishedAt)}</span>
                <span className="notice-title">{p.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
