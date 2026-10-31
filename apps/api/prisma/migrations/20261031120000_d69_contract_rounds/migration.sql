-- D69 — 위탁계약 회차와 계약서 파일. 지점의 계약 칸(상대방·시작일·종료일)을 1회차로 옮기고 지점에서 없앤다.
-- 문서(Document)의 계약서(CONTRACT) 분류는 없앤다 — 계약서는 계약 화면에서만 다룬다(D69 결정 6).

-- CreateEnum
CREATE TYPE "ContractFileKind" AS ENUM ('CONTRACT', 'TERMINATION_AGREEMENT');

-- CreateTable
CREATE TABLE "ContractRound" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "roundNo" INTEGER NOT NULL,
    "partner" TEXT NOT NULL,
    "startAt" DATE NOT NULL,
    "endAt" DATE NOT NULL,
    "terminatedAt" DATE,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractFile" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "kind" "ContractFileKind" NOT NULL,
    "path" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacedAt" TIMESTAMP(3),

    CONSTRAINT "ContractFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractRound_branchId_roundNo_key" ON "ContractRound"("branchId", "roundNo");
CREATE UNIQUE INDEX "ContractFile_path_key" ON "ContractFile"("path");
CREATE INDEX "ContractFile_roundId_idx" ON "ContractFile"("roundId");

-- D69 — 회차·종류마다 지금 파일(교체되지 않은 행)은 하나. 교체는 옛 행에 replacedAt을 남기고 새 행을 만든다.
CREATE UNIQUE INDEX "ContractFile_current_key" ON "ContractFile"("roundId", "kind") WHERE "replacedAt" IS NULL;

-- 회차 번호는 1부터, 기간은 시작일 ≤ 종료일(앱이 먼저 400을 내고 이 제약은 최종 방어선이다).
ALTER TABLE "ContractRound" ADD CONSTRAINT "ContractRound_round_no_ck" CHECK ("roundNo" >= 1);
ALTER TABLE "ContractRound" ADD CONSTRAINT "ContractRound_period_ck" CHECK ("startAt" <= "endAt");

-- AddForeignKey
ALTER TABLE "ContractRound" ADD CONSTRAINT "ContractRound_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractRound" ADD CONSTRAINT "ContractRound_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractFile" ADD CONSTRAINT "ContractFile_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ContractRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractFile" ADD CONSTRAINT "ContractFile_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 지점의 지금 계약을 1회차로 옮긴다. 계약서 파일은 없다(본사가 화면에서 올린다). 처리자도 없다(createdBy null).
-- 종료일이 비어 있는 지점(상시 계약)이 있으면 endAt NOT NULL에 걸려 이 마이그레이션 전체가 실패한다 —
-- 종료일 필수(D69 결정 3)라 값을 지어내지 않고 멈춘다. 적용 전에 확인: SELECT "id" FROM "Branch" WHERE "contractEndAt" IS NULL;
INSERT INTO "ContractRound" ("id", "branchId", "roundNo", "partner", "startAt", "endAt", "createdAt")
SELECT gen_random_uuid()::text, "id", 1, "contractPartner", "contractStartAt", "contractEndAt", "createdAt"
FROM "Branch";

-- DropIndex / AlterTable
DROP INDEX "Branch_contractEndAt_idx";
ALTER TABLE "Branch" DROP COLUMN "contractEndAt",
DROP COLUMN "contractPartner",
DROP COLUMN "contractStartAt";

-- 계약서 문서 행을 지우고(문서 관리의 계약서는 파일 주소 문자열뿐이었다, 자원문서관리 A-8) 분류를 없앤다.
-- 분류를 비교하는 CHECK 제약은 enum을 바꾸는 동안 옛 타입을 붙잡으므로 내렸다가 HR_RECORD 것만 다시 건다.
DELETE FROM "Document" WHERE "category" = 'CONTRACT';
ALTER TABLE "Document" DROP CONSTRAINT "Document_contract_retention_ck";
ALTER TABLE "Document" DROP CONSTRAINT "Document_hr_record_staff_ck";

-- AlterEnum
CREATE TYPE "DocumentCategory_new" AS ENUM ('HR_RECORD', 'MANUAL', 'OTHER');
ALTER TABLE "Document" ALTER COLUMN "category" TYPE "DocumentCategory_new" USING ("category"::text::"DocumentCategory_new");
ALTER TYPE "DocumentCategory" RENAME TO "DocumentCategory_old";
ALTER TYPE "DocumentCategory_new" RENAME TO "DocumentCategory";
DROP TYPE "DocumentCategory_old";

-- RES-T05: HR_RECORD 문서는 대상 직원 필수(STAFF_REQUIRED) — d28_integrity_checks와 같은 제약
ALTER TABLE "Document" ADD CONSTRAINT "Document_hr_record_staff_ck"
  CHECK ("category" <> 'HR_RECORD' OR "relatedStaffId" IS NOT NULL);
