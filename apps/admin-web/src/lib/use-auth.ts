import { createContext, useContext } from 'react';
import { AuthUser } from './types';

// 컴포넌트(AuthProvider)와 같은 파일에서 훅을 export하면 Vite fast refresh가 그 파일을 전체 리로드하므로
// (react-refresh/only-export-components) context와 훅은 이 파일로 분리한다. Provider는 auth-context.tsx.
export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.');
  return ctx;
}
