import { Link } from 'react-router-dom';
import { useLoad } from '../lib/use-load';
import { describeError } from '../lib/errors';
import { shortDate } from '../lib/format';
import { Post } from '../lib/types';

// 홈 최근 공지 3건 — GET /posts?sort=latest&limit=3 1회(ADR-BRD-03). 회원에게 보이는 글만 온다(ADR-BRD-01).
export function RecentNotices() {
  const { data, error, loading } = useLoad<Post[]>('/posts?sort=latest&limit=3');

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
        <p className="muted">불러오는 중…</p>
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
