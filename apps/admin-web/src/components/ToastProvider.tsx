import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ToastApi, ToastContext, ToastTone } from '../lib/use-toast';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

// 성공은 짧게, 쓰기 오류는 읽을 시간을 더 준다. warning은 자동으로 닫지 않는다.
const DURATION_MS: Record<ToastTone, number | null> = { success: 3000, error: 6000, warning: null };
// 연속 저장으로 화면을 덮지 않게 최근 3개만 남긴다.
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((list) => list.filter((i) => i.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++;
      setItems((list) => [...list, { id, tone, message }].slice(-MAX_VISIBLE));
      const ms = DURATION_MS[tone];
      if (ms !== null) timers.current.set(id, setTimeout(() => dismiss(id), ms));
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      warning: (m) => push('warning', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* 스크린리더가 새 알림을 읽도록 polite 영역. 오류·경고는 role=alert로 바로 알린다. */}
      <div className="toast-viewport" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'success' ? 'status' : 'alert'}>
            <p className="toast-message">{t.message}</p>
            <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="알림 닫기">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
