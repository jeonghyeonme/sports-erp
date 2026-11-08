import { ReactNode } from 'react';
import { Modal } from './Modal';

// D74 — 브라우저 confirm 대신 쓰는 확인 창(디자인시스템 §5). 되돌릴 수 없는 동작은 danger로 빨간 버튼.
export function ConfirmModal({
  title,
  children,
  confirmLabel,
  danger = false,
  pending = false,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="confirm-body">{children}</div>
      <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
        <button type="button" className="btn-secondary" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className={danger ? 'btn-danger-outline' : 'btn-secondary primary'}
          disabled={pending}
          onClick={onConfirm}
          autoFocus
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
