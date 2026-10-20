-- D60 — 세부 권한(역할 상한 + 역할 기본값 + 개인 예외). 권한관리 ADR-AUTH-07.
-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT');

-- CreateTable
CREATE TABLE "RolePermission" (
    "role" "Role" NOT NULL,
    "feature" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("role","feature","action")
);

-- CreateTable
CREATE TABLE "AccountPermission" (
    "accountId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountPermission_pkey" PRIMARY KEY ("accountId","feature","action")
);

-- AddForeignKey
ALTER TABLE "AccountPermission" ADD CONSTRAINT "AccountPermission_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 세부 권한 표는 지점 관리자·직원만 다룬다(본사는 항상 전부, 회원은 본인 화면만 — D60 결정 2).
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_role_check" CHECK ("role" IN ('BRANCH_ADMIN', 'STAFF'));
