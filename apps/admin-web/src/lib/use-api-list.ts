import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from './api';
import { ApiEnvelope } from './types';
import { errorHint } from './error-hints';

/** 서버 오류 응답 — AllExceptionsFilter가 { success:false, error:{code,message} }로 준다. 화면의 조회·저장 오류 타입은 모두 이것. */
export type ApiError = AxiosError<{ error?: { code?: string; message?: string } }>;

// enabled=false면 부르지 않는다 — 앞선 조회(예: 지점 목록)가 끝나야 주소가 정해지는 화면용.
export function useApiList<T>(key: unknown[], url: string, enabled = true) {
  return useQuery<T[], ApiError>({
    queryKey: key,
    enabled,
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<T[]>>(url);
      return res.data.data ?? [];
    },
  });
}

// AllExceptionsFilter는 { success:false, error:{code,message} }로 응답한다(data.message가 아니라
// data.error.message) — 이 함수가 그동안 최상위 message를 읽고 있어서 실제로는 항상 아래 기본
// 문구로 떨어지고 있었다(2026-09-18, 예약및결제 작업 중 발견). 매개변수는 unknown으로 받아 axios 오류면 무엇이든 넘길 수 있다.
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
  return useQuery<{ rows: T[]; total: number }, ApiError>({
    queryKey: key,
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<T[]>>(url);
      return { rows: res.data.data ?? [], total: Number(res.data.meta?.total ?? 0) };
    },
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  });
}
