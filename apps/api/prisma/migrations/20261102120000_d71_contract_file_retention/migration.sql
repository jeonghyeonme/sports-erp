-- D71 — 계약 파일 보존: 실물 이관 표시(언제든)와 시스템 파일 정리(이관 완료 + 회차 끝난 날 + 3년 경과 뒤, 본사).
-- 이관해도 보존 기간 안에는 열람된다. 정리하면 저장소 객체를 지우고 행은 남긴다(이관·정리 기록).

-- AlterTable
ALTER TABLE "ContractFile" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" TEXT,
ADD COLUMN     "purgedAt" TIMESTAMP(3),
ADD COLUMN     "purgedBy" TEXT;

-- 정리는 이관 뒤에만 — 앱이 먼저 409를 내고 이 제약은 최종 방어선이다(DI-01).
ALTER TABLE "ContractFile" ADD CONSTRAINT "ContractFile_purge_after_archive_ck"
  CHECK ("purgedAt" IS NULL OR "archivedAt" IS NOT NULL);

-- AddForeignKey
ALTER TABLE "ContractFile" ADD CONSTRAINT "ContractFile_archivedBy_fkey" FOREIGN KEY ("archivedBy") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractFile" ADD CONSTRAINT "ContractFile_purgedBy_fkey" FOREIGN KEY ("purgedBy") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
