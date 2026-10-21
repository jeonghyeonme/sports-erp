import { useCallback } from 'react';
import { PermissionAction } from './types';
import { useAuth } from './use-auth';

/**
 * D60 3단계 — 로그인·/auth/me가 내려준 적용 권한으로 메뉴·버튼을 숨긴다. 판정은 서버(PermissionGuard)가 하고
 * 이 훅은 "보여 줘도 403이 날 버튼"을 감추는 편의다. 표에 없는 칸(본사·회원, 역할 상한 밖)은 true —
 * 역할로 거르는 기존 조건이 그대로 본다.
 */
export function useCan(): (feature: string, action: PermissionAction) => boolean {
  const { user } = useAuth();
  const map = user?.effectivePermissions;
  return useCallback((feature, action) => map?.[`${feature}:${action}`] ?? true, [map]);
}
