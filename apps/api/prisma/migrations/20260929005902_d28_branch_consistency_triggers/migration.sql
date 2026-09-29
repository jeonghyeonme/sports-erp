-- D28 DI-02(docs/architecture/data-integrity.md §3), ADR-STF-04 — 두 행의 branchId가 같아야 하는 규칙을
-- 트리거로 강제한다. SQL로만 추가한 복합 FK는 Prisma가 다음 마이그레이션에서 DROP하므로 트리거를 쓴다
-- (트리거·함수는 Prisma가 건드리지 않는다). 앱이 먼저 400/403을 내고, 트리거는 최종 방어선이다.
-- 위반 시 SQLSTATE 23514(check_violation), 메시지는 'BRANCH_MISMATCH: ...'.
-- 모든 트리거는 INSERT와 "지점 판정에 쓰는 컬럼"의 UPDATE에만 걸린다 — 다른 컬럼 수정엔 비용이 없다.

-- ── 쓰는 쪽: 참조 대상이 같은 지점인지 ────────────────────────────────

-- ADR-PRG-03(assertFacilityInBranch·assertInstructorInBranch): 프로그램의 시설·강사는 같은 지점
CREATE FUNCTION "program_branch_consistency"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."facilityId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Facility" WHERE "id" = NEW."facilityId" AND "branchId" = NEW."branchId") THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Program.facilityId(%)가 프로그램 지점(%)과 다르다', NEW."facilityId", NEW."branchId"
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."instructorId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Instructor" WHERE "id" = NEW."instructorId" AND "branchId" = NEW."branchId") THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Program.instructorId(%)가 프로그램 지점(%)과 다르다', NEW."instructorId", NEW."branchId"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "program_branch_consistency" BEFORE INSERT OR UPDATE OF "branchId", "facilityId", "instructorId"
  ON "Program" FOR EACH ROW EXECUTE FUNCTION "program_branch_consistency"();

-- MEM-T02(assertStaffInBranch): 회원의 담당 직원은 같은 지점
CREATE FUNCTION "member_assigned_staff_branch"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."assignedStaffId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Staff" WHERE "id" = NEW."assignedStaffId" AND "branchId" = NEW."branchId") THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Member.assignedStaffId(%)가 회원 지점(%)과 다르다', NEW."assignedStaffId", NEW."branchId"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "member_assigned_staff_branch" BEFORE INSERT OR UPDATE OF "branchId", "assignedStaffId"
  ON "Member" FOR EACH ROW EXECUTE FUNCTION "member_assigned_staff_branch"();

-- ADR-MEM-03(assertProgramInBranch): 수강·PT 세션의 프로그램은 회원과 같은 지점 — 두 테이블이 같은 함수를 쓴다
CREATE FUNCTION "member_program_branch"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Member" m JOIN "Program" p ON p."branchId" = m."branchId"
    WHERE m."id" = NEW."memberId" AND p."id" = NEW."programId") THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: %.programId(%)가 회원(%) 지점과 다르다', TG_TABLE_NAME, NEW."programId", NEW."memberId"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "course_enrollment_branch" BEFORE INSERT OR UPDATE OF "memberId", "programId"
  ON "CourseEnrollment" FOR EACH ROW EXECUTE FUNCTION "member_program_branch"();
CREATE TRIGGER "pt_session_branch" BEFORE INSERT OR UPDATE OF "memberId", "programId"
  ON "PTSession" FOR EACH ROW EXECUTE FUNCTION "member_program_branch"();

-- DI-02에서 발견한 공백(createReservation MEMBER_BRANCH_MISMATCH): 예약 회차의 프로그램은 회원과 같은 지점
CREATE FUNCTION "reservation_branch"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Member" m
    JOIN "ScheduleSlot" s ON s."id" = NEW."scheduleSlotId"
    JOIN "Program" p ON p."id" = s."programId" AND p."branchId" = m."branchId"
    WHERE m."id" = NEW."memberId") THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Reservation 회차(%)가 회원(%) 지점과 다르다', NEW."scheduleSlotId", NEW."memberId"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "reservation_branch" BEFORE INSERT OR UPDATE OF "memberId", "scheduleSlotId"
  ON "Reservation" FOR EACH ROW EXECUTE FUNCTION "reservation_branch"();

-- ADR-STF-04: 강사 프로필에 연결된 직원은 같은 지점(파견 시 연결을 해제해야 한다)
CREATE FUNCTION "instructor_staff_branch"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."staffId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Staff" WHERE "id" = NEW."staffId" AND "branchId" = NEW."branchId") THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Instructor.staffId(%)가 강사 지점(%)과 다르다', NEW."staffId", NEW."branchId"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "instructor_staff_branch" BEFORE INSERT OR UPDATE OF "branchId", "staffId"
  ON "Instructor" FOR EACH ROW EXECUTE FUNCTION "instructor_staff_branch"();

-- ── 참조되는 쪽: 직원의 지점 이동(파견) ──────────────────────────────
-- ADR-STF-04 A안을 DB가 강제한다 — 담당 회원 해제·강사 프로필 연결 해제를 같은 트랜잭션에서 **먼저** 하지 않으면
-- Staff.branchId 갱신이 거부된다. (Facility·Instructor·Program의 branchId를 바꾸는 경로는 앱에 없어 역방향은 두지 않았다.)
CREATE FUNCTION "staff_branch_move"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."branchId" IS DISTINCT FROM OLD."branchId" THEN
    IF EXISTS (SELECT 1 FROM "Member" WHERE "assignedStaffId" = NEW."id" AND "branchId" <> NEW."branchId") THEN
      RAISE EXCEPTION 'BRANCH_MISMATCH: 직원(%)을 담당자로 둔 다른 지점 회원이 남아 있다 — 파견 전에 담당을 해제할 것(ADR-STF-04)', NEW."id"
        USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM "Instructor" WHERE "staffId" = NEW."id" AND "branchId" <> NEW."branchId") THEN
      RAISE EXCEPTION 'BRANCH_MISMATCH: 직원(%)에 연결된 다른 지점 강사 프로필이 남아 있다 — 파견 전에 연결을 해제할 것(ADR-STF-04)', NEW."id"
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "staff_branch_move" BEFORE UPDATE OF "branchId"
  ON "Staff" FOR EACH ROW EXECUTE FUNCTION "staff_branch_move"();
