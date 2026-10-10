import { useEffect, useState } from 'react';
import { useLoad } from '../lib/use-load';
import { describeError } from '../lib/errors';
import { sinceLabel } from '../lib/format';
import { HOME_CARD_CACHE_MS, LEVEL_LABELS, REFRESH_COOLDOWN_MS } from '../lib/congestion';
import { Facility } from '../lib/types';
import { SkeletonLines } from './Skeleton';

// 홈 혼잡도 카드 — GET /facilities 1회(지점은 서버가 본인 지점으로 강제, 운영 중 시설만). 60초 안에 다시 오면 0회(캐시).
// ADR-FAC-04: 자동 폴링하지 않는다. 새로고침 버튼은 마지막 조회 뒤 30초가 지나야 다시 누를 수 있다.
export function CongestionCard() {
  const { data, error, loading, reload, fetchedAt } = useLoad<Facility[]>('/facilities', { cacheMs: HOME_CARD_CACHE_MS });
  // 시계 상태 — "N분 전"과 버튼 잠금 해제를 위해 화면 안에서만 흐른다(네트워크 호출 없음).
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  // 잠금 기준은 실제로 서버에서 받은 시각이다 — 캐시로 홈에 다시 들어와도 30초 간격이 지켜진다.
  const coolingDown = fetchedAt === undefined || now - fetchedAt < REFRESH_COOLDOWN_MS;
  const refresh = () => {
    setNow(Date.now());
    reload();
  };
  // 잠금은 조회 30초 뒤 풀린다 — 15초 시계보다 정확하게 풀리도록 그 시점에 한 번 더 시계를 맞춘다.
  useEffect(() => {
    if (fetchedAt === undefined) return;
    const wait = fetchedAt + REFRESH_COOLDOWN_MS - Date.now();
    if (wait <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(timer);
  }, [fetchedAt]);

  const facilities = data ?? [];
  const latest = facilities.reduce<string | null>(
    (acc, f) => (acc === null || f.lastUpdatedAt > acc ? f.lastUpdatedAt : acc),
    null,
  );

  return (
    <section className="panel stack-sm" aria-labelledby="congestion-title">
      <div className="card-head">
        <h2 id="congestion-title" className="card-title">
          지금 혼잡도
        </h2>
        <button
          type="button"
          className="text-button"
          onClick={refresh}
          disabled={loading || coolingDown}
          aria-label="혼잡도 새로고침"
        >
          {loading ? '불러오는 중…' : coolingDown ? '잠시 후 새로고침' : '새로고침'}
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {describeError(error, '혼잡도를 불러오지 못했습니다.')}
        </p>
      ) : loading ? (
        <SkeletonLines />
      ) : facilities.length === 0 ? (
        <p className="muted">혼잡도를 표시할 시설이 없습니다.</p>
      ) : (
        <>
          <ul className="list congestion-list">
            {facilities.map((f) => (
              <li key={f.id} className="congestion-row">
                <span className="congestion-name">{f.name}</span>
                <span className={`level-meter level-${f.level}`} aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={i <= f.level ? 'on' : ''} />
                  ))}
                </span>
                <span className={`level-label level-${f.level}`}>{LEVEL_LABELS[f.level] ?? '-'}</span>
              </li>
            ))}
          </ul>
          {latest && <p className="muted">{sinceLabel(latest, now)}</p>}
        </>
      )}
    </section>
  );
}
