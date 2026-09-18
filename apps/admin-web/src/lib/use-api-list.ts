import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from './api';
import { ApiEnvelope } from './types';

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
export function apiErrorMessage(error: AxiosError<unknown> | null): string | null {
  if (!error) return null;
  const data = error.response?.data as { error?: { message?: string } } | undefined;
  return data?.error?.message ?? '데이터를 불러오지 못했습니다.';
}
