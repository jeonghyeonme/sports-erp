import { ReactNode, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { api, setAccessToken } from './api';
import { ApiEnvelope, AuthUser } from './types';
import { AuthContext } from './use-auth';
import { apiErrorMessage } from './use-api-list';

interface LoginResult {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
}

const MEMBER_ACCOUNT_MESSAGE = '회원 계정은 관리자 웹에서 쓸 수 없습니다.\n해결: 아래 "회원 앱"에서 같은 이메일로 로그인하세요.';

class MemberAccountError extends Error {}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post<ApiEnvelope<LoginResult>>('/auth/login', { email, password });
      const result = res.data.data;
      if (!result) throw new Error('empty login response');
      // D66 — 관리자 웹은 직원 계정(본사·지점 관리자·직원)만 받는다. 회원 계정은 방금 받은 갱신 토큰을 바로 폐기하고
      // 회원 웹으로 안내한다(서버는 어느 앱에서 왔는지 모르므로 이 판정은 화면 몫 — 회원이 쓸 수 있는 API는 그대로).
      if (result.user.role === 'MEMBER') {
        if (result.refreshToken) await api.post('/auth/logout', { refreshToken: result.refreshToken }).catch(() => undefined);
        throw new MemberAccountError();
      }
      setAccessToken(result.accessToken);
      setUser(result.user);
    } catch (err) {
      // 서버 오류는 data.error.message에 있다(apiErrorMessage 주석) — 해결 줄도 같은 함수가 붙인다(log/089).
      const message =
        err instanceof MemberAccountError
          ? MEMBER_ACCOUNT_MESSAGE
          : (isAxiosError(err) && apiErrorMessage(err)) || '로그인에 실패했습니다.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // D60 3단계 — 본사가 권한을 바꾸면 화면 숨김도 따라오도록, 창으로 돌아올 때 적용 권한을 다시 받는다.
  // 판정은 서버가 하므로 이 갱신이 늦어도 막힐 일은 막힌다(버튼만 늦게 사라진다).
  const signedIn = user !== null;
  useEffect(() => {
    if (!signedIn) return;
    const refresh = () => {
      api
        .get<ApiEnvelope<AuthUser>>('/auth/me')
        .then((res) => {
          const me = res.data.data;
          if (me) setUser((prev) => (prev ? { ...prev, effectivePermissions: me.effectivePermissions } : prev));
        })
        .catch(() => undefined);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [signedIn]);

  const logout = (nextNotice?: string) => {
    setAccessToken(null);
    setUser(null);
    setNotice(nextNotice ?? null);
  };

  const value = useMemo(
    () => ({ user, isLoading, error, notice, login, logout }),
    [user, isLoading, error, notice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
