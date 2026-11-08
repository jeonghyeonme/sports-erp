import { useRef, useState } from 'react';
import { ChartUnit, formatTick, formatValue, monthLabel, niceTicks } from '../../lib/chart-scale';
import { useElementWidth } from '../../lib/use-element-width';

export interface MonthPoint {
  month: string; // YYYY-MM
  value: number;
}

const HEIGHT = 168;
const PAD = { top: 12, right: 8, bottom: 34 };
const MAX_BAR = 24;
const RADIUS = 4;

/** 위만 둥근 막대(바닥은 직각) — 데이터 끝 4px, 기준선에 붙은 쪽은 각지게(dataviz marks). */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * D75 — 월별 세로 막대(단일 계열). 마지막 달이 진행 중이면 옅은 색 + "진행 중". 막대 위 숫자는 두지 않는다
 * (진행 중 막대 라벨이 옆 막대와 겹쳤다 — 값은 위 숫자 카드·툴팁(마우스·키보드 초점)·표로 보기). 음수(환불이 큰 달)는 0 아래로.
 */
export function MonthlyColumnChart({
  title,
  unit,
  points,
  partialLast = true,
}: {
  title: string;
  unit: ChartUnit;
  points: MonthPoint[];
  partialLast?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrapRef);
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(0, ...points.map((p) => p.value));
  const min = Math.min(0, ...points.map((p) => p.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  // 왼쪽 여백 = 가장 긴 눈금 글자 폭(11px 글자 ≈ 7px) + 여유 — 눈금이 잘리지 않게
  const left = Math.max(28, Math.max(...ticks.map((t) => formatTick(t, unit).length)) * 7 + 12);
  const bottom = min < 0 ? -niceTicks(-min)[niceTicks(-min).length - 1] : 0;
  const plotW = Math.max(40, width - left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((top - v) / (top - bottom)) * plotH;
  const band = plotW / Math.max(1, points.length);
  const barW = Math.min(MAX_BAR, band * 0.6);
  const lastIndex = points.length - 1;
  // 좁으면 달 라벨을 하나 걸러 — 마지막 달부터 거꾸로 세어 이번 달은 늘 보인다("'26.1월"은 글자가 길어 칸 44px 기준)
  const showEvery = band < 44 ? 2 : 1;

  const tip = active === null ? null : points[active];
  const tipLeft = active === null ? 0 : left + band * active + band / 2;

  return (
    <div className="chart-card" ref={wrapRef}>
      <div className="chart-title">{title}</div>
      <div className="chart-plot">
        <svg width={width} height={HEIGHT} role="group" aria-label={`${title} 월별 막대 차트`}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="chart-gridline" x1={left} x2={left + plotW} y1={y(t)} y2={y(t)} />
              <text className="chart-axis" x={left - 6} y={y(t)} dy="0.32em" textAnchor="end">
                {formatTick(t, unit)}
              </text>
            </g>
          ))}
          {bottom < 0 && (
            <line className="chart-gridline" x1={left} x2={left + plotW} y1={y(bottom)} y2={y(bottom)} />
          )}
          {points.map((p, i) => {
            const x = left + band * i + (band - barW) / 2;
            const partial = partialLast && i === lastIndex;
            const h = Math.abs(y(p.value) - y(0));
            const label = `${monthLabel(p.month, true)}${partial ? '(진행 중)' : ''} ${title} ${formatValue(p.value, unit)}`;
            return (
              <g key={p.month}>
                {h > 0 &&
                  (p.value >= 0 ? (
                    <path
                      className={partial ? 'chart-bar partial' : active === i ? 'chart-bar active' : 'chart-bar'}
                      d={columnPath(x, y(p.value), barW, h)}
                    />
                  ) : (
                    <rect className="chart-bar negative" x={x} y={y(0)} width={barW} height={h} />
                  ))}
                {(lastIndex - i) % showEvery === 0 && (
                  <text className="chart-axis" x={x + barW / 2} y={HEIGHT - PAD.bottom + 14} textAnchor="middle">
                    {monthLabel(p.month)}
                  </text>
                )}
                {partial && (
                  <text className="chart-axis" x={x + barW / 2} y={HEIGHT - PAD.bottom + 27} textAnchor="middle">
                    진행 중
                  </text>
                )}
                {/* 막대보다 넓은 투명 칸이 마우스·키보드 대상 — 칸 전체를 겨누면 된다 */}
                <rect
                  className="chart-hit"
                  x={left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  tabIndex={0}
                  aria-label={label}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
          <line className="chart-baseline" x1={left} x2={left + plotW} y1={y(0)} y2={y(0)} />
        </svg>
        {tip && (
          <div className="chart-tooltip" style={{ left: Math.min(Math.max(tipLeft, 70), width - 70) }} role="status">
            <strong>{formatValue(tip.value, unit)}</strong>
            <span>
              {monthLabel(tip.month, true)}
              {partialLast && active === lastIndex ? ' · 진행 중(오늘까지)' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
