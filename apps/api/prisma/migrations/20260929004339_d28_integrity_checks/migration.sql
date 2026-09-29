-- D28(2-1_기술결정사항.md), docs/architecture/data-integrity.md DI-01 —
-- 한 행 안에서 판정 가능한 정합성 규칙을 DB CHECK 제약으로 이중화한다.
-- 원칙: **앱이 이미 검증하는 규칙만** 옮긴다. 앱이 먼저 친절한 400/409를 내고, DB는 우회 경로(직접 SQL,
-- 새 코드 경로의 검증 누락, Lambda 병렬 실행 중 경합)에 대한 최종 방어선이다. 앱에 검증이 없는 규칙을
-- DB에만 걸면 사용자 입력 오류가 500으로 터지므로 여기 넣지 않는다(data-integrity.md "앱 검증 공백" 표).
-- Prisma 5는 CHECK 제약을 스키마로 표현·관리하지 않는다 — schema.prisma 상단 주석 참고.

-- ── 강사프로그램게시 ─────────────────────────────────────
-- ADR-PRG-01: PAID_SESSION은 정원 1명 이상 필수(assertCapacityForPricingType), 정원·가격은 음수 불가(DTO @Min(0))
ALTER TABLE "Program" ADD CONSTRAINT "Program_paid_session_capacity_ck"
  CHECK ("pricingType" <> 'PAID_SESSION' OR ("capacity" IS NOT NULL AND "capacity" >= 1));
ALTER TABLE "Program" ADD CONSTRAINT "Program_capacity_nonneg_ck" CHECK ("capacity" IS NULL OR "capacity" >= 0);
ALTER TABLE "Program" ADD CONSTRAINT "Program_price_nonneg_ck" CHECK ("price" >= 0);

-- ── 예약및결제 ───────────────────────────────────────────
-- ADR-RSV-01 전제: 회차 정원은 1 이상(CreateScheduleSlotDto @Min(1))
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_capacity_positive_ck" CHECK ("capacity" >= 1);
-- 불변규칙 4(결제 금액 서버 계산): 공급가액 + 부가세 = 결제금액, 음수 불가
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_split_ck"
  CHECK ("amount" >= 0 AND "supplyAmount" >= 0 AND "vat" >= 0 AND "supplyAmount" + "vat" = "amount");

-- ── 회원관리 ─────────────────────────────────────────────
-- ADR-MEM-03: PT 사용 횟수는 0 이상 총 횟수 이하(usePTSession 소진 시 409), 총 횟수 1 이상(DTO @Min(1))
ALTER TABLE "PTSession" ADD CONSTRAINT "PTSession_usage_range_ck"
  CHECK ("totalSessions" >= 1 AND "usedSessions" >= 0 AND "usedSessions" <= "totalSessions");

-- ── 게시판 ───────────────────────────────────────────────
-- ADR-BRD-01: 지점 공지(BRANCH_TO_MEMBER)는 항상 회원 공개이고 지점이 있어야 한다(createPost가 강제)
ALTER TABLE "Post" ADD CONSTRAINT "Post_branch_notice_visible_ck"
  CHECK ("scope" <> 'BRANCH_TO_MEMBER' OR ("visibleToMember" AND "branchId" IS NOT NULL));

-- ── 혼잡도관리 ───────────────────────────────────────────
-- 정원 1 이상(DTO @Min(1)), 현재 인원 0 이상(ManualCongestionDto @Min(0)), 단계 1~5(computeCongestionLevel)
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_congestion_range_ck"
  CHECK ("capacity" >= 1 AND "currentCount" >= 0 AND "level" BETWEEN 1 AND 5);
ALTER TABLE "CongestionSnapshot" ADD CONSTRAINT "CongestionSnapshot_range_ck"
  CHECK ("capacity" >= 1 AND "currentCount" >= 0 AND "level" BETWEEN 1 AND 5);

-- ── 자원문서관리 ─────────────────────────────────────────
-- 고정자산은 수량 1(createAsset·updateAsset), 수량·취득가액 음수 불가, 내용연수 1 이상(DTO)
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_quantity_ck"
  CHECK ("quantity" >= 0 AND ("assetType" <> 'FIXED_ASSET' OR "quantity" = 1));
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_amounts_nonneg_ck"
  CHECK ("acquisitionCost" >= 0 AND ("usefulLifeYears" IS NULL OR "usefulLifeYears" >= 1));
-- ADR-RES-03: CONTRACT 문서는 보존기한 필수(RETENTION_UNTIL_REQUIRED)
ALTER TABLE "Document" ADD CONSTRAINT "Document_contract_retention_ck"
  CHECK ("category" <> 'CONTRACT' OR "retentionUntil" IS NOT NULL);
-- RES-T05: HR_RECORD 문서는 대상 직원 필수(STAFF_REQUIRED)
ALTER TABLE "Document" ADD CONSTRAINT "Document_hr_record_staff_ck"
  CHECK ("category" <> 'HR_RECORD' OR "relatedStaffId" IS NOT NULL);

-- ── 인사정보관리·근태관리 ────────────────────────────────
-- ATT-T05/STF-T04: 휴무 요일은 0~6(DTO @Min(0)/@Max(6)), 파트타임은 휴무 요일 없음(서비스가 비움)
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_off_days_ck"
  CHECK ("offDays" <@ ARRAY[0,1,2,3,4,5,6] AND ("employmentType" IS DISTINCT FROM '파트타임' OR cardinality("offDays") = 0));
-- 파견 이력: endDate(배타적)는 startDate 이상 — ADR-ATT-03 branchIdForStaffOnDate의 구간 판정 전제
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_period_ck"
  CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
-- ADR-ATT-01: 휴가 기간·일수(INVALID_DATE_RANGE), 연차 잔여는 음수 가능(ATT-T03)이지만 사용·부여일수 자체는 음수 불가
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_period_ck" CHECK ("endDate" >= "startDate" AND "days" >= 1);
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_nonneg_ck" CHECK ("totalDays" >= 0 AND "usedDays" >= 0);
-- 체크아웃은 체크인 이후(서버 시각 사용)
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_checkout_after_checkin_ck"
  CHECK ("checkInAt" IS NULL OR "checkOutAt" IS NULL OR "checkOutAt" >= "checkInAt");
