import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiEnvelope, SessionTokens } from './types';

// D41 — 같은 Worker의 /m/에서 서빙되므로 api는 같은 오리진의 상대경로다(D25). 개발 서버는 vite 프록시가 넘긴다.
export const api = axios.create({ baseURL: '/api/v1' });

// D41 결정 3 — access token은 메모리에만, refresh token은 localStorage에 둔다(휴대폰 새로고침·탭 종료에도 로그인 유지).
const REFRESH_TOKEN_KEY = 'spoism.member.refreshToken';
let accessToken: string | null = null;

export function readRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    // 사파리 개인정보 보호 모드 등 저장소를 못 쓰는 환경 — 저장된 세션이 없는 것으로 본다.
    return null;
  }
}

export function setSession(tokens: SessionTokens | null) {
  accessToken = tokens?.accessToken ?? null;
  try {
    if (tokens) localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (err) {
    // 저장에 실패해도 이번 탭의 메모리 세션은 쓸 수 있다 — 새로고침하면 다시 로그인해야 한다.
    console.warn('refresh token을 저장하지 못했습니다.', err);
  }
}

// refresh token은 1회용(rotate, 권한관리 A-6)이다. 여러 요청이 동시에 401을 받아도 refresh는 한 번만 보내고
// 모두 그 결과를 기다린다 — 따로 보내면 두 번째 요청이 이미 폐기된 토큰을 써서 세션이 끊긴다.
let refreshInFlight: Promise<void> | null = null;

export function refreshSession(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = readRefreshToken();
      if (!refreshToken) throw new Error('저장된 세션이 없습니다.');
      const res = await api.post<ApiEnvelope<SessionTokens>>('/auth/refresh', { refreshToken });
      if (!res.data.data) throw new Error('empty refresh response');
      setSession(res.data.data);
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// refresh까지 실패해 세션이 끝났을 때 화면(AuthProvider)에 알린다.
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetriableConfig | undefined;
  const isAuthCall = config?.url?.startsWith('/auth/login') || config?.url?.startsWith('/auth/refresh');
  if (error.response?.status !== 401 || !config || config._retried || isAuthCall || !readRefreshToken()) {
    throw error;
  }
  config._retried = true;
  try {
    await refreshSession();
  } catch (refreshError) {
    setSession(null);
    onSessionExpired?.();
    throw refreshError;
  }
  return api(config);
});

// 공통 에러 포맷({ success:false, error:{ code, message } })에서 사용자에게 보여 줄 문구를 꺼낸다.
export function errorMessage(err: unknown, fallback: string): string {
  const body = (err as AxiosError<ApiEnvelope<unknown>>)?.response?.data;
  return body?.error?.message ?? fallback;
}
