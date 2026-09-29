-- D27(2-1_기술결정사항.md) — Lambda 이관 전제에 맞춘 스키마 보강. D26(스키마 동기화)이 남긴 세 가지 틈:
--   ① ADR의 "활성 상태만 유일" 제약이 전역 unique로 들어가 있던 것 → 부분 unique 인덱스(파일 끝)
--   ② "YYYY-MM-DD" 의미 필드의 DB 기본값 now()(UTC) → KST 날짜 버그 재발 경로, @db.Date + 기본값 제거
--   ③ 인스턴스 메모리에 있던 상태(연동 실패 횟수, 채번) → CodeSequence·MemberLinkAttempt 테이블
-- timestamp → DATE 변환은 기존 값의 시각을 잘라낸다. Supabase는 적용 시점에 데이터 0행이었다(2026-09-29 확인).

-- CreateEnum
CREATE TYPE "CodeSequenceKind" AS ENUM ('STAFF', 'MEMBER', 'ASSET');

-- DropIndex
DROP INDEX "Account_email_key";

-- DropIndex
DROP INDEX "Reservation_memberId_scheduleSlotId_key";

-- AlterTable
ALTER TABLE "Asset" ALTER COLUMN "acquiredAt" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "Branch" ALTER COLUMN "contractStartAt" SET DATA TYPE DATE,
ALTER COLUMN "contractEndAt" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "CourseEnrollment" ALTER COLUMN "enrolledAt" DROP DEFAULT,
ALTER COLUMN "enrolledAt" SET DATA TYPE DATE,
ALTER COLUMN "expiresAt" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "retentionUntil" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "Member" ALTER COLUMN "joinedAt" DROP DEFAULT,
ALTER COLUMN "joinedAt" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "PTSession" ALTER COLUMN "purchasedAt" DROP DEFAULT,
ALTER COLUMN "purchasedAt" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "publishedAt" DROP DEFAULT,
ALTER COLUMN "publishedAt" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "Staff" ALTER COLUMN "hireDate" SET DATA TYPE DATE,
ALTER COLUMN "resignDate" SET DATA TYPE DATE;

-- CreateTable
CREATE TABLE "CodeSequence" (
    "branchId" TEXT NOT NULL,
    "kind" "CodeSequenceKind" NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CodeSequence_pkey" PRIMARY KEY ("branchId","kind","prefix")
);

-- CreateTable
CREATE TABLE "MemberLinkAttempt" (
    "id" TEXT NOT NULL,
    "memberNo" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberLinkAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberLinkAttempt_memberNo_attemptedAt_idx" ON "MemberLinkAttempt"("memberNo", "attemptedAt");

-- CreateIndex
CREATE INDEX "Account_email_idx" ON "Account"("email");

-- CreateIndex
CREATE INDEX "Reservation_memberId_scheduleSlotId_idx" ON "Reservation"("memberId", "scheduleSlotId");

-- AddForeignKey
ALTER TABLE "CodeSequence" ADD CONSTRAINT "CodeSequence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 부분 unique 인덱스 — Prisma 5 스키마 문법으로 표현 불가라 여기에만 있다(schema.prisma 상단 주석) ──

-- ADR-MEM-02: 활성 계정끼리만 이메일 유일(탈퇴 회원 이메일 재사용 허용)
CREATE UNIQUE INDEX "Account_email_active_key" ON "Account"("email") WHERE "isActive";

-- ADR-STF-03: 직원당 진행 중인 파견(endDate IS NULL)은 최대 1건
CREATE UNIQUE INDEX "StaffAssignment_staffId_active_key" ON "StaffAssignment"("staffId") WHERE "endDate" IS NULL;

-- ADR-RSV-02: 같은 회원·같은 회차의 활성 예약은 1건(취소 후 재예약은 허용)
CREATE UNIQUE INDEX "Reservation_memberId_scheduleSlotId_active_key" ON "Reservation"("memberId", "scheduleSlotId") WHERE "status" IN ('REQUESTED', 'CONFIRMED');
