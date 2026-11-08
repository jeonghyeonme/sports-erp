-- D69 2차(log/206) — 문서 실제 파일 업로드. 옛 문서는 주소(fileUrl)만, 새 문서는 저장소 경로(storagePath)만 갖는다.
-- 옛 주소 문서는 그대로 둔다(사용자 결정). 둘 중 정확히 하나만 있어야 한다(CHECK).
ALTER TABLE "Document" ALTER COLUMN "fileUrl" DROP NOT NULL;
ALTER TABLE "Document" ADD COLUMN "storagePath" TEXT;
ALTER TABLE "Document" ADD COLUMN "fileName" TEXT;
CREATE UNIQUE INDEX "Document_storagePath_key" ON "Document"("storagePath");
ALTER TABLE "Document" ADD CONSTRAINT "Document_file_source_ck"
  CHECK (("fileUrl" IS NULL) <> ("storagePath" IS NULL));
-- 올린 파일은 원래 파일 이름·형식·크기를 함께 둔다(저장소에서 다시 확인한 값).
ALTER TABLE "Document" ADD CONSTRAINT "Document_stored_file_meta_ck"
  CHECK ("storagePath" IS NULL OR ("fileName" IS NOT NULL AND "fileType" IS NOT NULL AND "fileSize" IS NOT NULL));
