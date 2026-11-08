import { useRef, useState } from 'react';
import { ChartUnit, formatTick, formatValue } from '../../lib/chart-scale';
import { useElementWidth } from '../../lib/use-element-width';

export interface RankedRow {
  key: string;
  label: string;
  value: number;
  note?: string; // 툴팁에 붙는 보조 정보(예: 계약 상태)
}

const ROW = 30;
const BAR = 16;
const LABEL_W = 96;
const VALUE_W = 64;
const RADIUS = 4;

/** 오른쪽 끝만 둥근 가로 막대(기준선 쪽은 직각). */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}

/**
 * D75 — 큰 것부터 줄 세운 가로 막대(단일 색). 값은 막대 끝에 적고, 막대 줄 전체가 마우스·키보드 대상이다.
 * 행 순서는 부르는 쪽이 정한다(서버가 큰 것부터 준다).
 */
export function RankedBarChart({ title, unit, rows }: { title: string; unit: ChartUnit; rows: RankedRow[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrapRef);
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(0, ...rows.map((r) => r.value)) || 1;
  const plotW = Math.max(40, width - LABEL_W - VALUE_W);
  const height = rows.length * ROW + 4;

  return (
    <div className="chart-card" ref={wrapRef}>
      <div className="chart-title">{title}</div>
      <svg width={width} height={height} role="group" aria-label={`${title} 가로 막대 차트`}>
        {rows.map((r, i) => {
          const y = i * ROW + (ROW - BAR) / 2;
          const w = Math.max(0, (Math.max(0, r.value) / max) * plotW);
          const label = `${r.label} ${formatValue(r.value, unit)}${r.note ? ` · ${r.note}` : ''}`;
          return (
            <g
              key={r.key}
              tabIndex={0}
              aria-label={label}
              className="chart-row"
              onPointerEnter={() => setActive(r.key)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(r.key)}
              onBlur={() => setActive(null)}
            >
              <rect className="chart-hit" x={0} y={i * ROW} width={width} height={ROW} />
              <text className="chart-label" x={LABEL_W - 8} y={y + BAR / 2} dy="0.32em" textAnchor="end">
                {r.label}
              </text>
              {w > 0 && <path className={active === r.key ? 'chart-bar active' : 'chart-bar'} d={barPath(LABEL_W, y, w, BAR)} />}
              <text className="chart-value" x={LABEL_W + w + 6} y={y + BAR / 2} dy="0.32em">
                {active === r.key ? formatValue(r.value, unit) : formatTick(r.value, unit)}
                {active === r.key && r.note ? ` · ${r.note}` : ''}
              </text>
            </g>
          );
        })}
        <line className="chart-baseline" x1={LABEL_W} x2={LABEL_W} y1={0} y2={height} />
      </svg>
    </div>
  );
}
