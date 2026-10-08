import { createContext, useContext } from 'react';

// 공통 Toast(B5-3, 디자인시스템 §5 "알림") — 성공은 Toast, 오류는 문제가 난 폼·영역 옆 인라인(forbidden-note)이 기본이다.
// 모달이 닫힌 뒤나 목록 버튼처럼 인라인으로 보일 자리가 없는 쓰기 오류만 error Toast로 보인다.
// warning은 사용자가 직접 행동해야 하는 정보라 닫을 때까지 남는다(예: ADR-PRG-02 영향 예약 안내).
export type ToastTone = 'success' | 'error' | 'warning';

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
}

export const ToastContext = createContext<ToastApi | undefined>(undefined);

// 훅·context는 Provider 컴포넌트 파일과 분리한다(react-refresh/only-export-components, admin-web CLAUDE.md).
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast는 ToastProvider 내부에서만 사용할 수 있습니다.');
  return ctx;
}
