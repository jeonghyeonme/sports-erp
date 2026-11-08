import { changeRate, formatStat, formatValue, monthLabel } from '../../lib/chart-scale';
import { MonthlyPerformance } from '../../lib/types';
import { MonthlyColumnChart } from './MonthlyColumnChart';
import { Sparkline } from './Sparkline';

// D75 — 운영 실적 지표 4개(지점별·전사 같은 정의). 단위가 달라 지표마다 차트 한 장.
const METRICS = [
  { key: 'revenue', label: '회차 결제 순매출', unit: '원' },
  { key: 'reservations', label: '예약', unit: '건' },
  { key: 'completed', label: '이용 완료', unit: '건' },
  { key: 'newMembers', label: '신규 회원', unit: '명' },
] as const;

/**
 * 숫자 카드 줄 — 지난달(다 끝난 달) 값, 그 전달 대비 증감, 끝난 달 12개월 추세선.
 * 진행 중인 이번 달은 끝난 달과 비교하지 않는다(D75 결정 3). rows는 오래된 달부터, 마지막이 이번 달.
 */
export function PerformanceStatTiles({ rows }: { rows: MonthlyPerformance[] }) {
  const done = rows.slice(0, -1); // 이번 달(진행 중) 제외
  if (done.length < 1) return null;
  const last = done[done.length - 1];
  const prev = done[done.length - 2];
  return (
    <div className="kpi-grid stat-tiles">
      {METRICS.map((m) => {
        const value = last[m.key];
        const rate = prev ? changeRate(value, prev[m.key]) : undefined;
        return (
          <div className="kpi-panel stat-tile" key={m.key}>
            <div className="kpi-label">
              {m.label} · {monthLabel(last.month, true)}
            </div>
            <div className="kpi-panel-bottom">
              <div className="kpi-value" title={formatValue(value, m.unit)}>
                {formatStat(value, m.unit)}
              </div>
              <Sparkline values={done.map((r) => r[m.key])} />
            </div>
            <div className="stat-delta">
              {!prev || rate === undefined ? (
                <span className="stat-delta-flat">전달 비교 없음</span>
              ) : rate === 0 ? (
                <span className="stat-delta-flat">전달({monthLabel(prev.month)})과 같음</span>
              ) : (
                <>
                  <span className={rate > 0 ? 'stat-delta-up' : 'stat-delta-down'}>
                    {rate > 0 ? '▲' : '▼'} {Math.abs(rate)}%
                  </span>
                  <span className="stat-delta-base"> 전달({monthLabel(prev.month)}) 대비</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 월별 차트 4장(작은 여러 장) + 표로 보기. 마지막 달은 진행 중으로 그린다. */
export function PerformanceCharts({ rows, note }: { rows: MonthlyPerformance[]; note?: string }) {
  if (rows.length === 0) return <div className="empty-state">아직 운영 실적이 없습니다.</div>;
  return (
    <>
      <div className="chart-grid">
        {METRICS.map((m) => (
          <MonthlyColumnChart key={m.key} title={m.label} unit={m.unit} points={rows.map((r) => ({ month: r.month, value: r[m.key] }))} />
        ))}
      </div>
      {note && <p className="page-desc">{note}</p>}
      <details className="chart-table">
        <summary>표로 보기</summary>
        <table>
          <thead>
            <tr>
              <th>월</th>
              <th>회차 결제 순매출</th>
              <th>환불</th>
              <th>예약</th>
              <th>이용 완료</th>
              <th>신규 회원</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r, i) => (
              <tr key={r.month}>
                <td>
                  {monthLabel(r.month, true)}
                  {i === 0 ? ' (진행 중)' : ''}
                </td>
                <td>{formatValue(r.revenue, '원')}</td>
                <td>{r.refunded > 0 ? formatValue(r.refunded, '원') : '-'}</td>
                <td>{formatValue(r.reservations, '건')}</td>
                <td>
                  {formatValue(r.completed, '건')}
                  {r.reservations > 0 && ` (${Math.round((r.completed / r.reservations) * 100)}%)`}
                </td>
                <td>{formatValue(r.newMembers, '명')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
