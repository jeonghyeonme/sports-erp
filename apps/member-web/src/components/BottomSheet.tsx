import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  title: string;
  onClose: () => void;
  // 요청 중에는 배경을 눌러도 닫히지 않게 한다 — 결과를 못 본 채 시트가 사라지지 않도록.
  busy?: boolean;
  children: ReactNode;
}

// 하단 시트 모달(B1-2 사용자 결정 — 취소 확인, log/083). 예약 확인에도 같은 모양을 쓴다.
// 디자인시스템 §2 — 실제로 위에 뜨는 요소라 최소 그림자를 허용한다.
export function BottomSheet({ title, onClose, busy, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  // body로 포털 — 화면 전환 애니메이션(.page-enter, transform)이 걸린 조상 안에서는 position:fixed가 화면이 아니라
  // 그 조상 기준이 되어, 목록이 길면 시트가 페이지 맨 아래(화면 밖)에 붙었다(시연 데이터 M02, log/241).
  return createPortal(
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
