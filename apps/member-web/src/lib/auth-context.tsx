import { AxiosError } from 'axios';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  api,
  readRefreshToken,
  refreshSession,
  setSession,
  setSessionExpiredHandler,
} from './api';
import { ApiEnvelope, AuthUser, LoginResult } from './types';
import { AuthContext } from './use-auth';
import { describeError } from './errors';
import { clearLoadCache } from './use-load';

async function revokeRefreshToken(refreshToken: string) {
  try {
    await api.post('/auth/logout', { refreshToken });
  } catch (err) {
    // 서버 폐기에 실패해도 이 기기의 세션은 지운다 — 토큰은 14일 뒤 만료된다.
    console.warn('refresh token 폐기 요청이 실패했습니다.', err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // 저장된 refresh token이 있으면 처음부터 "복원 중"으로 시작한다(effect 안에서 동기 setState를 하지 않기 위해).
  const [isRestoring, setIsRestoring] = useState(() => readRefreshToken() !== null);
  const [sessionExpired, setSessionExpired] = useState(false);
  // log/094 — 오프라인으로 앱을 열어 세션 복원 요청이 서버에 닿지 못했다. 저장된 토큰은 지우지 않는다.
  const [restoreOffline, setRestoreOffline] = useState(false);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearLoadCache();
      setUser(null);
      setSessionExpired(true);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  // D41 결정 3 — 앱 시작 시 POST /auth/refresh → GET /auth/me로 세션을 되살린다.
  useEffect(() => {
    if (!isRestoring) return;
    let cancelled = false;
    refreshSession()
      .then(() => api.get<ApiEnvelope<AuthUser>>('/auth/me'))
      .then((res) => {
        if (!cancelled) setUser(res.data.data ?? null);
      })
      .catch((err) => {
        // 네트워크 오류(응답 없음) — 홈 화면 앱을 오프라인으로 열었을 때다. 토큰을 지우면 연결이 돌아와도 다시 로그인해야 하므로
        // 그대로 두고, 화면은 "연결 필요"를 보인다(log/094). 서버가 거절했을 때만 세션을 지운다.
        if (!(err as AxiosError)?.response) {
          if (!cancelled) setRestoreOffline(true);
          return;
        }
        // 만료·폐기된 토큰이면 정상적으로 로그인 화면으로 간다. 원인은 콘솔에 남긴다.
        console.warn('저장된 세션을 복원하지 못했습니다.', err);
        setSession(null);
        // 저장된 토큰을 서버가 거절했다(만료·폐기) — 로그인 화면이 이유를 알려 준다. 네트워크 오류는 안내하지 않는다.
        if (!cancelled && (err as AxiosError)?.response?.status === 401) setSessionExpired(true);
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isRestoring]);

  const value = useMemo(() => {
    const login = async (email: string, password: string) => {
      let result: LoginResult | undefined;
      try {
        const res = await api.post<ApiEnvelope<LoginResult>>('/auth/login', { email, password });
        result = res.data.data;
      } catch (err) {
        throw new Error(describeError(err, '로그인에 실패했습니다. 잠시 후 다시 시도하세요.'), { cause: err });
      }
      if (!result) throw new Error('로그인 응답이 비어 있습니다.');
      // D41 결정 5 — 관리자·직원 계정은 회원 웹에서 받지 않는다. 방금 발급된 refresh token은 바로 폐기한다.
      if (result.user.role !== 'MEMBER') {
        await revokeRefreshToken(result.refreshToken);
        throw new Error('회원 계정만 이용할 수 있습니다. 관리자는 관리자 웹을 이용하세요.');
      }
      setSession(result);
      setSessionExpired(false);
      setLoginNotice(null);
      setUser(result.user);
    };

    const logout = async (options?: { notice?: string; serverRevoked?: boolean }) => {
      const refreshToken = readRefreshToken();
      // 다른 계정이 같은 탭에서 로그인해도 앞 사람 화면 데이터가 보이지 않게 캐시를 비운다.
      clearLoadCache();
      setSession(null);
      setSessionExpired(false);
      setLoginNotice(options?.notice ?? null);
      setUser(null);
      if (refreshToken && !options?.serverRevoked) await revokeRefreshToken(refreshToken);
    };

    const startSession = (result: LoginResult) => {
      clearLoadCache();
      setSession(result);
      setSessionExpired(false);
      setLoginNotice(null);
      setUser(result.user);
    };

    const retryRestore = () => {
      setRestoreOffline(false);
      setIsRestoring(true);
    };

    const renameUser = (name: string) => setUser((u) => (u ? { ...u, name } : u));

    return { user, isRestoring, restoreOffline, retryRestore, sessionExpired, loginNotice, login, startSession, logout, renameUser };
  }, [user, isRestoring, restoreOffline, sessionExpired, loginNotice]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
