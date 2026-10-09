-- log/093(사용자 결정 3, 2026-10-09) — D33·D34 숙제: 작성자·업로더·대상 직원 외래키, 업무일지 하루 1건 unique.
-- 적용 전 배포 DB 점검: 위반 행 0건(고아 FK 0, WorkLog 중복 0).
-- DropIndex
DROP INDEX "WorkLog_staffId_date_idx";

-- CreateIndex
CREATE INDEX "Document_relatedStaffId_idx" ON "Document"("relatedStaffId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkLog_staffId_date_key" ON "WorkLog"("staffId", "date");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_relatedStaffId_fkey" FOREIGN KEY ("relatedStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

