-- CreateEnum
CREATE TYPE "SupportRequestCategory" AS ENUM ('FACILITY', 'STAFFING', 'SUPPLIES', 'IT', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'DONE', 'REJECTED');

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "category" "SupportRequestCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "handlerId" TEXT,
    "response" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportRequest_branchId_status_idx" ON "SupportRequest"("branchId", "status");

-- CreateIndex
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_handlerId_fkey" FOREIGN KEY ("handlerId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- D56 — 한 행 안에서 판정 가능한 상태 규칙을 CHECK로 이중화한다(D28과 같은 방식, schema.prisma에는 표현되지 않는다).
-- 반려에는 답변이 있어야 하고, 완료·반려일 때만 처리 시각이 있다.
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_rejected_response_ck"
  CHECK ("status" <> 'REJECTED' OR ("response" IS NOT NULL AND length(btrim("response")) > 0));
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_resolved_at_ck"
  CHECK (("status" IN ('DONE', 'REJECTED')) = ("resolvedAt" IS NOT NULL));
