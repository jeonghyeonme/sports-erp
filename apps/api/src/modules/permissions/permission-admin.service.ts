import { Injectable } from "@nestjs/common";
import { PermissionAction, Prisma } from "@prisma/client";
import { AppException } from "../../common/exceptions/app.exception";
import {
  ACTION_LABEL,
  FeatureDef,
  GOVERNED_ROLES,
  GovernedRole,
  PERMISSION_CATALOG,
  permissionKey,
  withinCeiling,
} from "../../common/permissions/permission-catalog";
import { PermissionService } from "../../common/permissions/permission.service";
import { recordAudit } from "../../prisma/audit";
import { PrismaService } from "../../prisma/prisma.service";

const ACTIONS: PermissionAction[] = [
  "READ",
  "CREATE",
  "UPDATE",
  "DELETE",
  "EXPORT",
];

export interface PermissionCell {
  feature: string;
  action: PermissionAction;
  allowed: boolean;
}

/**
 * D60 2단계 — 본사가 역할 기본값·개인 예외를 바꾼다(권한관리 ADR-AUTH-07). 판정은 PermissionGuard,
 * 여기는 쓰기·조회만. 상한 밖 칸은 400(표가 다루지 않는 칸 — 써도 효과가 없어 혼란만 준다).
 * 변경은 같은 트랜잭션에서 AuditLog `PERMISSION_CHANGED`로 남긴다(D44 방식).
 */
@Injectable()
export class PermissionAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
  ) {}

  catalog() {
    return {
      roles: GOVERNED_ROLES,
      actions: ACTIONS.map((a) => ({ action: a, label: ACTION_LABEL[a] })),
      features: Object.entries(
        PERMISSION_CATALOG as Record<string, FeatureDef>,
      ).map(([feature, def]) => ({
        feature,
        label: def.label,
        ceiling: def.ceiling,
      })),
    };
  }

  /** 역할별 적용 값 — 상한 안 칸마다 허용 여부(행이 없으면 true). */
  async roleMatrix(): Promise<Record<GovernedRole, PermissionCell[]>> {
    const rows = await this.prisma.rolePermission.findMany();
    const set = new Map(
      rows.map((r) => [
        `${r.role}|${permissionKey(r.feature, r.action)}`,
        r.allowed,
      ]),
    );
    const out = {} as Record<GovernedRole, PermissionCell[]>;
    for (const role of GOVERNED_ROLES) {
      out[role] = cellsOf(role).map(({ feature, action }) => ({
        feature,
        action,
        allowed: set.get(`${role}|${permissionKey(feature, action)}`) ?? true,
      }));
    }
    return out;
  }

  async setRoleCell(role: string, cell: PermissionCell, actorId: string) {
    if (!GOVERNED_ROLES.includes(role as GovernedRole)) {
      throw new AppException(
        "PERMISSION_ROLE_NOT_GOVERNED",
        "세부 권한은 지점 관리자·직원 역할만 바꿀 수 있습니다.",
        400,
      );
    }
    assertWithinCeiling(role, cell.feature, cell.action);
    const r = role as GovernedRole;
    const where = {
      role_feature_action: {
        role: r,
        feature: cell.feature,
        action: cell.action,
      },
    };
    await this.prisma.$transaction(async (tx) => {
      const before =
        (await tx.rolePermission.findUnique({ where }))?.allowed ?? true;
      if (before === cell.allowed) return;
      // 허용 = 상한대로 → 행을 지운다("바꾼 칸만 행", D60 결정 4).
      if (cell.allowed) await tx.rolePermission.delete({ where });
      else
        await tx.rolePermission.create({
          data: {
            role: r,
            feature: cell.feature,
            action: cell.action,
            allowed: false,
            updatedBy: actorId,
          },
        });
      await recordAudit(tx, {
        actorId,
        entity: "Role",
        entityId: role,
        action: "PERMISSION_CHANGED",
        before: { feature: cell.feature, action: cell.action, allowed: before },
        after: {
          feature: cell.feature,
          action: cell.action,
          allowed: cell.allowed,
        },
      });
    });
    this.permissions.invalidate();
    return (await this.roleMatrix())[r];
  }

  /** 한 직원의 칸별 상태 — 역할 기본값, 개인 예외(없으면 null), 실제 적용 값. */
  async staffMatrix(staffId: string) {
    const staff = await this.loadStaff(staffId);
    const role = staff.account.role;
    if (!GOVERNED_ROLES.includes(role as GovernedRole))
      return { staffId, role, cells: [] };
    const defaults = await this.roleMatrix();
    const personal = new Map(
      staff.account.permissions.map((p) => [
        permissionKey(p.feature, p.action),
        p.allowed,
      ]),
    );
    return {
      staffId,
      role,
      cells: defaults[role as GovernedRole].map((c) => {
        const override = personal.get(permissionKey(c.feature, c.action));
        return {
          feature: c.feature,
          action: c.action,
          roleDefault: c.allowed,
          override: override === undefined ? null : override,
          effective: override ?? c.allowed,
        };
      }),
    };
  }

  async setStaffCell(
    staffId: string,
    cell: {
      feature: string;
      action: PermissionAction;
      mode: "DEFAULT" | "ALLOW" | "DENY";
    },
    actorId: string,
  ) {
    const staff = await this.loadStaff(staffId);
    const role = staff.account.role;
    if (!GOVERNED_ROLES.includes(role as GovernedRole)) {
      throw new AppException(
        "PERMISSION_ROLE_NOT_GOVERNED",
        "세부 권한은 지점 관리자·직원 역할만 바꿀 수 있습니다.",
        400,
      );
    }
    assertWithinCeiling(role, cell.feature, cell.action);
    const accountId = staff.accountId;
    const where = {
      accountId_feature_action: {
        accountId,
        feature: cell.feature,
        action: cell.action,
      },
    };
    const next = cell.mode === "DEFAULT" ? null : cell.mode === "ALLOW";
    await this.prisma.$transaction(async (tx) => {
      const prev =
        (await tx.accountPermission.findUnique({ where }))?.allowed ?? null;
      if (prev === next) return;
      if (next === null) await tx.accountPermission.delete({ where });
      else
        await tx.accountPermission.upsert({
          where,
          create: {
            accountId,
            feature: cell.feature,
            action: cell.action,
            allowed: next,
            grantedBy: actorId,
          },
          update: { allowed: next, grantedBy: actorId },
        });
      await recordAudit(tx, {
        actorId,
        entity: "Staff",
        entityId: staffId,
        action: "PERMISSION_CHANGED",
        before: {
          feature: cell.feature,
          action: cell.action,
          override: prev,
        } as Prisma.InputJsonObject,
        after: {
          feature: cell.feature,
          action: cell.action,
          override: next,
        } as Prisma.InputJsonObject,
      });
    });
    // 개인 예외는 매 요청 계정 조회로 읽어 캐시가 없다 — 다음 요청부터 바로 반영된다.
    return this.staffMatrix(staffId);
  }

  private async loadStaff(staffId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        accountId: true,
        account: { select: { role: true, permissions: true } },
      },
    });
    if (!staff)
      throw new AppException(
        "STAFF_NOT_FOUND",
        "직원을 찾을 수 없습니다.",
        404,
      );
    return staff;
  }
}

function cellsOf(
  role: GovernedRole,
): Array<{ feature: string; action: PermissionAction }> {
  return Object.entries(
    PERMISSION_CATALOG as Record<string, FeatureDef>,
  ).flatMap(([feature, def]) =>
    (def.ceiling[role] ?? []).map((action) => ({ feature, action })),
  );
}

function assertWithinCeiling(
  role: string,
  feature: string,
  action: PermissionAction,
) {
  if (!withinCeiling(role, feature, action)) {
    throw new AppException(
      "PERMISSION_OUTSIDE_CEILING",
      "이 역할이 처음부터 할 수 없는 기능입니다 — 세부 권한은 역할 상한 안에서만 바꿀 수 있습니다(D60).",
      400,
    );
  }
}
