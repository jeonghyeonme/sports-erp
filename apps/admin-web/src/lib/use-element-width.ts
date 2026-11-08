import { RefObject, useEffect, useState } from 'react';

/** D75 — 차트가 그려질 칸의 실제 폭(px). SVG를 늘이지 않고 폭에 맞춰 다시 그려 글자 크기가 변하지 않게 한다. */
export function useElementWidth(ref: RefObject<HTMLElement | null>, fallback = 480): number {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
