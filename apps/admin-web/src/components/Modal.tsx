import { ReactNode, useEffect, useId, useRef } from 'react';

// D74 — 보조기기가 모달로 읽도록 dialog 역할·제목 연결, 열리면 모달로 초점을 옮기고 Esc로 닫는다.
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const card = cardRef.current;
    // 안쪽이 이미 초점을 잡았으면(autoFocus) 그대로, 아니면 첫 입력 칸, 없으면 모달 자체로
    if (!card?.contains(document.activeElement)) {
      const first = card?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea');
      (first ?? card)?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={cardRef}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id={titleId}>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
