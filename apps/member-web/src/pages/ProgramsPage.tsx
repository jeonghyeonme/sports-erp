import { Link } from 'react-router-dom';
import { useLoad } from '../lib/use-load';
import { describeError } from '../lib/errors';
import { won } from '../lib/format';
import { Program } from '../lib/types';

// 예약하기 1단계 — 운영 중 프로그램 목록. 호출 1회(GET /programs?status=RUNNING). 지점은 서버가 본인 지점으로 강제한다
// (BranchScopeGuard). 회차 예약을 받는 것은 PAID_SESSION뿐이다(api reservation.service NOT_RESERVABLE).
export function ProgramsPage() {
  const { data, error, loading, reload } = useLoad<Program[]>('/programs?status=RUNNING');

  if (loading) return <p className="muted center">불러오는 중…</p>;
  if (error) {
    return (
      <div className="panel error-panel" role="alert">
        <p>{describeError(error, '프로그램 목록을 불러오지 못했습니다.')}</p>
        <button type="button" className="secondary-button" onClick={reload}>
          다시 시도
        </button>
      </div>
    );
  }

  const programs = data ?? [];
  const reservable = programs.filter((p) => p.pricingType === 'PAID_SESSION');
  const others = programs.filter((p) => p.pricingType !== 'PAID_SESSION');

  return (
    <div className="stack">
      <h1>예약하기</h1>
      {reservable.length === 0 && <p className="panel empty-state">지금 예약할 수 있는 프로그램이 없습니다.</p>}
      <ul className="list">
        {reservable.map((p) => (
          <li key={p.id}>
            {/* 다음 화면이 프로그램 정보를 다시 부르지 않도록 넘겨 준다(호출 수 절약). */}
            <Link to={`/programs/${p.id}`} state={{ program: p }} className="panel program-card">
              <span className="program-name">{p.name}</span>
              <span className="muted">
                {p.category}
                {p.instructorName && ` · ${p.instructorName}`}
              </span>
              <span className="program-price">{p.price > 0 ? `회당 ${won(p.price)}` : '무료'}</span>
            </Link>
          </li>
        ))}
      </ul>

      {others.length > 0 && (
        <section className="stack-sm">
          <h2 className="section-title">예약 없이 이용</h2>
          <ul className="list">
            {others.map((p) => (
              <li key={p.id} className="panel program-card is-static">
                <span className="program-name">{p.name}</span>
                <span className="muted">
                  {p.pricingType === 'FREE_ACCESS' ? '운영 시간에 바로 이용하세요.' : '담당 트레이너와 일정을 잡습니다.'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
