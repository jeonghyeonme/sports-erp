import { SetMetadata } from '@nestjs/common';
import { PermissionAction } from '@prisma/client';
import { PermissionFeature } from './permission-catalog';

export const PERMISSION_KEY = 'permission';
export const PERMISSION_EXEMPT_KEY = 'permissionExempt';

export interface PermissionMeta {
  feature: PermissionFeature;
  action: PermissionAction;
  /** 목록 출력(CSV, D54) — `?export=true`로 부르면 출력 권한도 본다. */
  exportable?: boolean;
}

/**
 * D60 — 이 라우트가 쓰는 세부 권한. 전역 PermissionGuard가 지점 관리자·직원에게만 본다(본사·회원은 표 밖).
 * 사용 예: `@Permission('member', 'CREATE')`, `@Permission('member', 'READ', { exportable: true })`.
 */
export const Permission = (feature: PermissionFeature, action: PermissionAction, options: { exportable?: boolean } = {}) =>
  SetMetadata<string, PermissionMeta>(PERMISSION_KEY, { feature, action, exportable: options.exportable });

/** D60 — 세부 권한 표 밖인 라우트(인사 권한·본인 업무 등). 이유를 남긴다(permission-coverage가 본다). */
export const PermissionExempt = (reason: string) => SetMetadata(PERMISSION_EXEMPT_KEY, reason);

export const EXEMPT = {
  self: '본인 업무 — 끄면 자기 일을 못 한다(D60 결정 2)',
  hr: '인사 권한 — 표 밖, 인사 권한 분리 불변식(D60 결정 2)',
  common: '화면 공통 정보 — 로그인한 모두가 쓴다',
};
