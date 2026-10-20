-- 게시판 ADR-BRD-05(RFP F4-3 "현장→이용자 각 시설에 대한 공지") — 지점 공지의 대상 시설. null = 지점 전체.
-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "facilityId" TEXT;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- D28 DI-02 방식 — 공지의 시설은 공지와 같은 지점(전체 공지 branchId=null에는 시설을 둘 수 없다).
-- 앱이 먼저 403/400을 내고(BranchScopeGuard·PostService), 트리거는 최종 방어선이다.
CREATE FUNCTION "post_facility_branch"() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW."facilityId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Facility" WHERE "id" = NEW."facilityId" AND "branchId" = NEW."branchId") THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Post.facilityId(%)가 게시글 지점(%)과 다르다', NEW."facilityId", NEW."branchId"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "post_facility_branch" BEFORE INSERT OR UPDATE OF "branchId", "facilityId"
  ON "Post" FOR EACH ROW EXECUTE FUNCTION "post_facility_branch"();
