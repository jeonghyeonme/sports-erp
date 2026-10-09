import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from './api';
import { ApiEnvelope } from './types';
import { errorHint } from './error-hints';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

export function useApiList<T>(key: unknown[], url: string) {
  return useQuery<T[], AxiosError<ApiErrorBody>>({
    queryKey: key,
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<T[]>>(url);
      return res.data.data ?? [];
    },
  });
}

// AllExceptionsFilter는 { success:false, error:{code,message} }로 응답한다(data.message가 아니라
// data.error.message) — 이 함수가 그동안 최상위 message를 읽고 있어서 실제로는 항상 아래 기본
// 문구로 떨어지고 있었다(2026-09-18, 예약및결제 작업 중 발견). 호출부마다 로컬로 선언한
// `AxiosError<{code?,message?}>` 타입과의 구조적 호환을 유지하기 위해 매개변수는 unknown으로 받고
// 내부에서만 실제 응답 모양(data.error.message)을 읽는다.
// 화면별 도움말(log/089) — 아는 코드면 둘째 줄에 "해결: …"을 붙인다(error-hints.ts). 인라인(.forbidden-note)과
// Toast 모두 white-space: pre-line이라 줄바꿈이 그대로 보인다.
export function apiErrorMessage(error: AxiosError<unknown> | null): string | null {
  if (!error) return null;
  const data = error.response?.data as { error?: { code?: string; message?: string } } | undefined;
  // 응답이 아예 없으면(네트워크 끊김·서버 기동 중) 코드가 없으므로 같은 상황의 안내를 쓴다.
  const code = data?.error?.code ?? (error.response ? undefined : 'UPSTREAM_UNAVAILABLE');
  const message = data?.error?.message ?? '데이터를 불러오지 못했습니다.';
  const hint = errorHint(code);
  return hint ? `${message}\n해결: ${hint}` : message;
}

// D43 — 쪽 단위 목록(회원·예약·결제·자산). url에 page·limit을 넣어 부르고, meta.total을 함께 돌려준다.
// keepPreviousData로 쪽을 넘길 때 표가 비었다가 다시 그려지지 않게 한다.
export function useApiPage<T>(key: unknown[], url: string, options?: { enabled?: boolean }) {
  return useQuery<{ rows: T[]; total: number }, AxiosError<ApiErrorBody>>({
    queryKey: key,
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<T[]>>(url);
      return { rows: res.data.data ?? [], total: Number(res.data.meta?.total ?? 0) };
    },
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  });
}
