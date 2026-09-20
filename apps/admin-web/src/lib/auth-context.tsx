import { ReactNode, useMemo, useState } from 'react';
import { api, setAccessToken } from './api';
import { ApiEnvelope, AuthUser } from './types';
import { AuthContext } from './use-auth';

interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<ApiEnvelope<LoginResult>>('/auth/login', { email, password });
      const result = res.data.data;
      if (!result) throw new Error('empty login response');
      setAccessToken(result.accessToken);
      setUser(result.user);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        '로그인에 실패했습니다.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setAccessToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, isLoading, error, login, logout }),
    [user, isLoading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
