/**
 * D75 — 숫자 카드의 작은 추세선. 회색 선 + 마지막(가장 최근 끝난 달) 점만 강조색.
 * 장식이 아니라 방향만 보이는 그림이라 축·툴팁이 없다 — 값은 카드 숫자와 차트·표에 있다(aria-hidden).
 */
export function Sparkline({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pad = 4;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + ((max - v) / span) * (height - pad * 2);
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = values.length - 1;
  return (
    <svg className="sparkline" width={width} height={height} aria-hidden="true">
      <path className="sparkline-line" d={d} />
      <circle className="sparkline-dot" cx={x(last)} cy={y(values[last])} r={3} />
    </svg>
  );
}
