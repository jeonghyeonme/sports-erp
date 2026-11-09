-- 예약및결제 ADR-RSV-09 — 회원 앱 PT 패키지 구매(모의 결제)와 PT 회차 예약(횟수를 예약 때 잡고 체크인 때 차감).
-- 현장 판매(관리자 등록)·"세션 사용" 차감은 그대로 둔다. CHECK는 schema.prisma에 없고 이 SQL에만 있다(D28).

-- AlterTable
ALTER TABLE "PTSessionLog" ADD COLUMN     "reservationId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "ptSessionId" TEXT,
ALTER COLUMN "reservationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "ptPackageSessions" INTEGER;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "ptSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PTSessionLog_reservationId_key" ON "PTSessionLog"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_ptSessionId_key" ON "Payment"("ptSessionId");

-- CreateIndex
CREATE INDEX "Reservation_ptSessionId_idx" ON "Reservation"("ptSessionId");

-- AddForeignKey
ALTER TABLE "PTSessionLog" ADD CONSTRAINT "PTSessionLog_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_ptSessionId_fkey" FOREIGN KEY ("ptSessionId") REFERENCES "PTSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_ptSessionId_fkey" FOREIGN KEY ("ptSessionId") REFERENCES "PTSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 결제 하나는 회차 예약 또는 PT 패키지 구매 중 정확히 하나에 붙는다.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_target_ck"
  CHECK (("reservationId" IS NULL) <> ("ptSessionId" IS NULL));

-- 패키지 횟수는 PT_PACKAGE 프로그램에만, 1회 이상.
ALTER TABLE "Program" ADD CONSTRAINT "Program_pt_package_ck"
  CHECK ("ptPackageSessions" IS NULL OR ("pricingType" = 'PT_PACKAGE' AND "ptPackageSessions" > 0));
