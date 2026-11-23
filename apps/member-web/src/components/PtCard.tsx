import { Link } from 'react-router-dom';
import { useLoad } from '../lib/use-load';
import { useAuth } from '../lib/use-auth';
import { PTPackage } from '../lib/types';

// 홈 "내 PT" 카드(log/245, 사용자 요청) — 남은 PT를 내 정보까지 들어가지 않고 본다. 호출 1회(GET /members/:id/pt-sessions).
// 캐시하지 않는다 — PT를 사거나 예약한 뒤 홈에 바로 돌아와도 맞는 횟수가 보여야 한다. PT가 없으면 카드를 그리지 않는다.
// 예약에 쓸 수 있는 횟수 = 남은 횟수 − 예약으로 잡힌 횟수(ADR-RSV-09 — 예약 때 잡고 체크인 때 차감).
export function PtCard() {
  const { user } = useAuth();
  const memberId = user?.memberId ?? '';
  const { data } = useLoad<PTPackage[]>(memberId ? `/members/${encodeURIComponent(memberId)}/pt-sessions` : null);

  const byProgram = new Map<string, { name: string; available: number; reserved: number }>();
  for (const t of data ?? []) {
    const cur = byProgram.get(t.programId) ?? { name: t.programName ?? 'PT', available: 0, reserved: 0 };
    cur.available += t.remainingSessions - (t.reservedSessions ?? 0);
    cur.reserved += t.reservedSessions ?? 0;
    byProgram.set(t.programId, cur);
  }
  const rows = [...byProgram.entries()].filter(([, v]) => v.available > 0 || v.reserved > 0);
  if (rows.length === 0) return null;

  return (
    <section className="panel stack-sm" aria-labelledby="pt-card-title">
      <h2 id="pt-card-title" className="card-title">
        내 PT
      </h2>
      <ul className="list">
        {rows.map(([programId, v]) => (
          <li key={programId} className="stack-sm">
            <span className="program-name">{v.name}</span>
            <span className="muted">
              예약에 쓸 수 있는 PT <strong>{v.available}회</strong>
              {v.reserved > 0 && ` · 예약으로 잡힌 ${v.reserved}회`}
            </span>
            {v.available > 0 && (
              <Link to={`/programs/${encodeURIComponent(programId)}`} className="text-link">
                PT 회차 예약하기
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
