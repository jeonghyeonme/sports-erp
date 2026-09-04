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

export function apiErrorMessage(error: AxiosError<ApiErrorBody> | null): string | null {
  if (!error) return null;
  return error.response?.data?.message ?? '데이터를 불러오지 못했습니다.';
}
