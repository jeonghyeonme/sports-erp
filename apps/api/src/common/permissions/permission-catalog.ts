import { PermissionAction } from '@prisma/client';

/**
 * D60 — 세부 권한 카탈로그(권한관리 ADR-AUTH-07). 기능 × 동작(조회·입력·수정·삭제·출력)마다 역할별 **상한**을 적는다.
 * 상한은 지금 라우트의 @Roles가 허용하는 것과 같아야 한다 — `permission-coverage.spec.ts`가 라우트 표와 대조한다.
 * 역할 기본값(RolePermission)·개인 예외(AccountPermission)는 이 상한 안에서만 끄고 켠다.
 *
 * 표에 넣지 않는 것(@PermissionExempt): 인사 권한(채용·발령·역할 전환·퇴사·계약 상태 — 인사 권한 분리),
 * 본인 업무(출퇴근·내 휴가·내 업무일지·비밀번호·회원 본인 예약·결제), 본사 전용·공개 라우트.
 */
export type GovernedRole = 'BRANCH_ADMIN' | 'STAFF';
export const GOVERNED_ROLES: GovernedRole[] = ['BRANCH_ADMIN', 'STAFF'];

export interface FeatureDef {
  label: string;
  ceiling: Partial<Record<GovernedRole, PermissionAction[]>>;
}

export const PERMISSION_CATALOG = {
  member: { label: '회원', ceiling: { BRANCH_ADMIN: ['READ', 'CREATE', 'UPDATE', 'EXPORT'] } },
  program: { label: '프로그램·회차', ceiling: { BRANCH_ADMIN: ['READ', 'CREATE', 'UPDATE', 'DELETE'], STAFF: ['READ'] } },
  reservation: { label: '예약(취소·체크인)', ceiling: { BRANCH_ADMIN: ['READ', 'UPDATE'] } },
  payment: { label: '결제', ceiling: { BRANCH_ADMIN: ['READ', 'EXPORT'] } },
  attendance: { label: '근태 관리(요약·정정·결근 확정)', ceiling: { BRANCH_ADMIN: ['READ', 'UPDATE', 'EXPORT'] } },
  leave: { label: '휴가 승인', ceiling: { BRANCH_ADMIN: ['READ', 'UPDATE'] } },
  worklog: { label: '업무일지 열람', ceiling: { BRANCH_ADMIN: ['READ'] } },
  staff: { label: '직원 일상 관리(정보 수정·변경 신청 승인)', ceiling: { BRANCH_ADMIN: ['READ', 'UPDATE'] } },
  branch: { label: '지점 현황·운영 실적', ceiling: { BRANCH_ADMIN: ['READ'] } },
  post: { label: '게시판', ceiling: { BRANCH_ADMIN: ['READ', 'CREATE', 'UPDATE', 'DELETE'], STAFF: ['READ'] } },
  facility: { label: '시설·혼잡도', ceiling: { BRANCH_ADMIN: ['READ', 'CREATE', 'UPDATE'], STAFF: ['READ'] } },
  instructor: { label: '강사', ceiling: { BRANCH_ADMIN: ['READ', 'CREATE', 'UPDATE', 'DELETE'], STAFF: ['READ'] } },
  asset: { label: '자산', ceiling: { BRANCH_ADMIN: ['READ', 'CREATE', 'UPDATE'] } },
  document: { label: '문서', ceiling: { BRANCH_ADMIN: ['READ', 'CREATE'] } },
  support: { label: '업무지원 요청', ceiling: { BRANCH_ADMIN: ['READ', 'CREATE'] } },
} satisfies Record<string, FeatureDef>;

export type PermissionFeature = keyof typeof PERMISSION_CATALOG;

export const ACTION_LABEL: Record<PermissionAction, string> = {
  READ: '조회',
  CREATE: '입력',
  UPDATE: '수정',
  DELETE: '삭제',
  EXPORT: '출력',
};

/** 이 역할·기능·동작이 상한 안인가(표가 다루는 칸인가). */
export function withinCeiling(role: string, feature: string, action: PermissionAction): boolean {
  const def = (PERMISSION_CATALOG as Record<string, FeatureDef>)[feature];
  return !!def && (def.ceiling[role as GovernedRole] ?? []).includes(action);
}

export const permissionKey = (feature: string, action: PermissionAction) => `${feature}:${action}`;
