// D75 — 차트 축 눈금·숫자 표기(직접 그리는 SVG 차트가 같이 쓴다). 눈금은 1·2·5 × 10^k 깔끔한 수로, 4칸 안팎.

export function niceTicks(max: number, target = 4): number[] {
  if (!(max > 0)) return [0];
  const raw = max / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const ticks: number[] = [];
  for (let v = 0; v < max + step * 0.5; v += step) ticks.push(Math.round(v));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export type ChartUnit = '원' | '건' | '명';

/** 축 눈금: 원은 1만 이상이면 "120만"처럼, 나머지는 천 단위 쉼표. */
export function formatTick(v: number, unit: ChartUnit): string {
  if (unit === '원' && v >= 10_000) return `${(v / 10_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만`;
  return v.toLocaleString('ko-KR');
}

/** 숫자 카드: 원은 1만 이상이면 만원 단위로 반올림("1,266만원"), 나머지는 전체 값. 전체 값은 툴팁·표에. */
export function formatStat(v: number, unit: ChartUnit): string {
  if (unit === '원' && Math.abs(v) >= 10_000) return `${Math.round(v / 10_000).toLocaleString('ko-KR')}만원`;
  return formatValue(v, unit);
}

/** 값 라벨·툴팁: 단위까지 붙인 전체 값. */
export function formatValue(v: number, unit: ChartUnit): string {
  return `${v.toLocaleString('ko-KR')}${unit}`;
}

/** "2026-11" → 짧은 라벨 "11월"(1월은 "'27.1월"처럼 해를 붙여 해 바뀜을 보인다), 긴 라벨 "2026년 11월". */
export function monthLabel(month: string, long = false): string {
  const [y, m] = month.split('-').map(Number);
  if (long) return `${y}년 ${m}월`;
  return m === 1 ? `'${String(y).slice(2)}.1월` : `${m}월`;
}

/** 전월 대비 증감률(%) — 전월이 0이면 비교하지 않는다(undefined). */
export function changeRate(current: number, previous: number): number | undefined {
  if (previous === 0) return undefined;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}
