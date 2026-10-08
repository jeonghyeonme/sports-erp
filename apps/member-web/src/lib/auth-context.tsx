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

  useEffect(() => {
    setSessionExpiredHandler(() => {
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
      setUser(result.user);
    };

    const logout = async () => {
      const refreshToken = readRefreshToken();
      setSession(null);
      setSessionExpired(false);
      setUser(null);
      if (refreshToken) await revokeRefreshToken(refreshToken);
    };

    const renameUser = (name: string) => setUser((u) => (u ? { ...u, name } : u));

    return { user, isRestoring, sessionExpired, login, logout, renameUser };
  }, [user, isRestoring, sessionExpired]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
