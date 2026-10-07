import { createContext, useContext } from 'react';
import { AuthUser } from './types';

// admin-web과 같은 이유로 context·훅을 Provider 파일과 분리한다(react-refresh/only-export-components).
export interface AuthContextValue {
  user: AuthUser | null;
  // 저장된 refresh token으로 세션을 되살리는 중인지 — 이 동안은 로그인 화면으로 보내지 않는다.
  isRestoring: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.');
  return ctx;
}
