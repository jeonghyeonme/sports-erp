import { createContext, useContext } from 'react';
import { AuthUser, LoginResult } from './types';

// admin-web과 같은 이유로 context·훅을 Provider 파일과 분리한다(react-refresh/only-export-components).
export interface AuthContextValue {
  user: AuthUser | null;
  // 저장된 refresh token으로 세션을 되살리는 중인지 — 이 동안은 로그인 화면으로 보내지 않는다.
  isRestoring: boolean;
  // 사용 중에 refresh까지 실패해 로그인 화면으로 돌아왔는지 — 로그인 화면이 이유를 알려 준다(B1-2).
  sessionExpired: boolean;
  // 로그아웃하며 로그인 화면에 남길 안내(예: 비밀번호 변경 후 다시 로그인, log/091)
  loginNotice: string | null;
  login: (email: string, password: string) => Promise<void>;
  // 가입·연동(POST /members/register·link)이 돌려준 세션으로 바로 로그인한다 — /auth/login을 다시 부르지 않는다(⑩, log/092).
  startSession: (result: LoginResult) => void;
  // serverRevoked: 서버가 이미 refresh token을 폐기했으면(비밀번호 변경) /auth/logout을 다시 부르지 않는다(design-constants ⑩).
  logout: (options?: { notice?: string; serverRevoked?: boolean }) => Promise<void>;
  // 내 정보에서 이름을 고친 뒤 상단·홈 인사에 바로 반영한다(/auth/me를 다시 부르지 않는다 — design-constants ⑩).
  renameUser: (name: string) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.');
  return ctx;
}
