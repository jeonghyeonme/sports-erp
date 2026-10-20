import { IsBoolean, IsIn, IsString } from "class-validator";
import { PermissionAction } from "@prisma/client";

const ACTIONS: PermissionAction[] = [
  "READ",
  "CREATE",
  "UPDATE",
  "DELETE",
  "EXPORT",
];

// D60 — 역할 기본값 한 칸. allowed=true는 "상한대로"(행 삭제), false는 차단 행.
export class RolePermissionCellDto {
  @IsString()
  feature!: string;

  @IsIn(ACTIONS)
  action!: PermissionAction;

  @IsBoolean()
  allowed!: boolean;
}

// D60 — 개인 예외 한 칸. DEFAULT는 예외를 지워 역할 기본값을 따르게 한다.
export class AccountPermissionCellDto {
  @IsString()
  feature!: string;

  @IsIn(ACTIONS)
  action!: PermissionAction;

  @IsIn(["DEFAULT", "ALLOW", "DENY"])
  mode!: "DEFAULT" | "ALLOW" | "DENY";
}
