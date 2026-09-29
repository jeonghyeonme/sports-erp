/**
 * 시드 스크립트 — docs/00_공통설계서.md SHEET 04(가상 회사 시나리오) 데이터를 그대로 재현합니다.
 * 등장인물: 정하늘(본사) · 김민수(서초점장) · 박서연(트레이너/강사) · 이수진(회원)
 *
 * 실행: npm run prisma:seed --workspace=apps/api  (package.json의 prisma.seed 설정 참고)
 */
import { PrismaClient, Role, PricingType, ProgramStatus, AgeGroup, FacilityType, ReservationStatus, PaymentMethod, PaymentStatus, CongestionSource, CodeSequenceKind } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { todayKst } from '../src/common/date/kst-date';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'demo-password-1234'; // 로컬 시연용. 실제 배포에서는 절대 사용 금지.

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ── 지점 ──────────────────────────────────────────
  const seocho = await prisma.branch.upsert({
    where: { id: 'branch-seocho' },
    update: {},
    create: {
      id: 'branch-seocho',
      name: '서초점',
      code: 'SEOCHO',
      address: '서울시 서초구',
      region: '서울',
      standardCheckInTime: '09:00',
      contractPartner: '서초 OO아파트 입주자대표회의',
      contractStartAt: new Date('2024-03-01'),
    },
  });

  const gangnam = await prisma.branch.upsert({
    where: { id: 'branch-gangnam' },
    update: {},
    create: {
      id: 'branch-gangnam',
      name: '강남점',
      code: 'GANGNAM',
      address: '서울시 강남구',
      region: '서울',
      standardCheckInTime: '09:00',
      contractPartner: '강남 OO오피스텔 관리사무소',
      contractStartAt: new Date('2023-10-01'),
    },
  });

  // ── 계정 · 인물 ────────────────────────────────────

  // D26(2026-09-28) — 이 4명은 MockDataService에도 똑같은 이메일로 존재하는 "과도기 공유 계정"이다
  // (auth.service.ts의 Prisma-우선/mock-폴백 로그인 참고). id를 mock-data.service.ts의 값과 동일하게
  // 맞춰야 req.user.staffId/memberId가 아직 이관 안 된 mock 도메인 컨트롤러에서도 그대로 유효하다 —
  // 안 맞추면 Prisma로 로그인한 요청이 mock 쪽 STAFF_NOT_FOUND로 깨진다(처음엔 무작위 uuid로 만들었다가
  // test/branch-isolation.spec.ts 등에서 이 문제를 실제로 겪고 나서 고쳤다).

  // 정하늘 — 본사 운영팀장 (SUPER_ADMIN)
  const hqAccount = await prisma.account.upsert({
    where: { id: 'account-haneul' }, // D27 — email은 부분 unique라 upsert 키로 못 씀
    update: {},
    create: {
      id: 'account-haneul',
      email: 'jeong.haneul@spoism.example',
      passwordHash,
      role: Role.SUPER_ADMIN,
      name: '정하늘',
    },
  });

  // 김민수 — 서초점 지점장 (BRANCH_ADMIN)
  const minsuAccount = await prisma.account.upsert({
    where: { id: 'account-minsu' }, // D27 — email은 부분 unique라 upsert 키로 못 씀
    update: {},
    create: {
      id: 'account-minsu',
      email: 'kim.minsu@spoism.example',
      passwordHash,
      role: Role.BRANCH_ADMIN,
      name: '김민수',
    },
  });
  const minsuStaff = await prisma.staff.upsert({
    where: { accountId: minsuAccount.id },
    update: {},
    create: {
      id: 'staff-minsu',
      accountId: minsuAccount.id,
      branchId: seocho.id,
      staffCode: 'SEOCHO-001',
      name: '김민수',
      position: '지점장',
      employmentType: '정규직',
      hireDate: new Date('2021-03-02'),
    },
  });

  // 박서연 — 서초점 트레이너 겸 요가 강사 (Role=STAFF: 관리 권한 없이 본인 근태/업무일지만 셀프서비스)
  const seoyeonAccount = await prisma.account.upsert({
    where: { id: 'account-seoyeon' }, // D27 — email은 부분 unique라 upsert 키로 못 씀
    update: {},
    create: {
      id: 'account-seoyeon',
      email: 'park.seoyeon@spoism.example',
      passwordHash,
      role: Role.STAFF,
      name: '박서연',
    },
  });
  const seoyeonStaff = await prisma.staff.upsert({
    where: { accountId: seoyeonAccount.id },
    update: {},
    create: {
      id: 'staff-seoyeon',
      accountId: seoyeonAccount.id,
      branchId: seocho.id,
      staffCode: 'SEOCHO-002',
      name: '박서연',
      position: '트레이너',
      employmentType: '정규직',
      hireDate: new Date('2022-07-11'),
    },
  });

  const seoyeonInstructor = await prisma.instructor.create({
    data: {
      branchId: seocho.id,
      staffId: seoyeonStaff.id,
      name: '박서연',
      specialty: '요가 · 필라테스',
      bio: '5년차 요가 강사, 하타/빈야사 전문',
    },
  });

  // 이수진 — 서초점 회원
  const sujinAccount = await prisma.account.upsert({
    where: { id: 'account-sujin' }, // D27 — email은 부분 unique라 upsert 키로 못 씀
    update: {},
    create: {
      id: 'account-sujin',
      email: 'lee.sujin@example.com',
      passwordHash,
      role: Role.MEMBER,
      name: '이수진',
    },
  });
  const sujinMember = await prisma.member.upsert({
    where: { accountId: sujinAccount.id },
    update: {},
    create: {
      id: 'member-sujin',
      accountId: sujinAccount.id,
      branchId: seocho.id,
      assignedStaffId: seoyeonStaff.id,
      memberNo: 'SEOCHO2026-001',
      name: '이수진',
      phone: '010-1234-5678',
      joinedAt: new Date('2026-03-15'),
    },
  });

  // ── 채번 시퀀스 — D28/DI-03 ────────────────────────
  // 위에서 번호를 직접 박아 넣은 직원·회원만큼 시퀀스를 올려 둔다. 안 그러면 allocateBranchCode의 첫 채번이
  // SEOCHO-001/SEOCHO2026-001로 나와 기존 행과 unique 충돌한다(실데이터 이관 때도 같은 초기화가 필요).
  for (const seq of [
    { branchId: seocho.id, kind: CodeSequenceKind.STAFF, prefix: 'SEOCHO-', lastValue: 2 },
    { branchId: seocho.id, kind: CodeSequenceKind.MEMBER, prefix: 'SEOCHO2026', lastValue: 1 },
  ]) {
    await prisma.codeSequence.upsert({
      where: { branchId_kind_prefix: { branchId: seq.branchId, kind: seq.kind, prefix: seq.prefix } },
      update: { lastValue: seq.lastValue },
      create: seq,
    });
  }

  // ── 시설 ──────────────────────────────────────────
  const gym = await prisma.facility.upsert({
    where: { id: 'facility-seocho-gym' },
    update: {},
    create: { id: 'facility-seocho-gym', branchId: seocho.id, name: '서초점 헬스장', type: FacilityType.GYM, capacity: 60 },
  });
  await prisma.facility.upsert({
    where: { id: 'facility-seocho-pool' },
    update: {},
    create: { id: 'facility-seocho-pool', branchId: seocho.id, name: '서초점 수영장', type: FacilityType.POOL, capacity: 30 },
  });

  // ── 프로그램 (pricingType 세 갈래를 모두 시연) ─────────

  // PAID_SESSION — 요가 그룹 클래스 (유료 회차 예약)
  const yogaProgram = await prisma.program.upsert({
    where: { id: 'program-seocho-yoga' },
    update: {},
    create: {
      id: 'program-seocho-yoga',
      branchId: seocho.id,
      facilityId: gym.id,
      instructorId: seoyeonInstructor.id,
      name: '아침 요가',
      category: '요가',
      ageGroup: AgeGroup.ADULT,
      price: 30000,
      pricingType: PricingType.PAID_SESSION,
      capacity: 15,
      status: ProgramStatus.RUNNING,
      startDate: new Date('2026-01-05'),
    },
  });

  // PT_PACKAGE — 개인 PT (세션 차감형)
  const ptProgram = await prisma.program.upsert({
    where: { id: 'program-seocho-pt' },
    update: {},
    create: {
      id: 'program-seocho-pt',
      branchId: seocho.id,
      facilityId: gym.id,
      instructorId: seoyeonInstructor.id,
      name: '퍼스널 트레이닝',
      category: 'PT',
      ageGroup: AgeGroup.ADULT,
      price: 60000, // 1회당 단가(참고용, 결제는 세션 패키지 구매 시 별도 처리)
      pricingType: PricingType.PT_PACKAGE,
      status: ProgramStatus.RUNNING,
      startDate: new Date('2026-01-05'),
    },
  });

  // FREE_ACCESS — 헬스장 자유이용 (예약 없이 이용)
  await prisma.program.upsert({
    where: { id: 'program-seocho-freegym' },
    update: {},
    create: {
      id: 'program-seocho-freegym',
      branchId: seocho.id,
      facilityId: gym.id,
      name: '헬스장 자유이용',
      category: '헬스',
      ageGroup: AgeGroup.ALL,
      pricingType: PricingType.FREE_ACCESS,
      status: ProgramStatus.RUNNING,
      startDate: new Date('2025-01-01'),
    },
  });

  // 준비중 상태 예시 — 다음 달 개강 예정인 신규 프로그램(지점별 "진행중/준비중" 구분을 보여주기 위한 데이터)
  await prisma.program.upsert({
    where: { id: 'program-seocho-pilates' },
    update: {},
    create: {
      id: 'program-seocho-pilates',
      branchId: seocho.id,
      facilityId: gym.id,
      instructorId: seoyeonInstructor.id,
      name: '필라테스 (10월 개강 예정)',
      category: '필라테스',
      ageGroup: AgeGroup.ADULT,
      price: 35000,
      pricingType: PricingType.PAID_SESSION,
      capacity: 12,
      status: ProgramStatus.PREPARING,
      startDate: new Date('2026-10-01'),
    },
  });

  // ── 예약 + 결제 (이수진이 아침 요가 예약) ──────────────
  // D27 — @db.Date 컬럼은 KST 기준 날짜 문자열로 넣는다(new Date()를 그대로 넣으면 UTC 날짜로 잘린다).
  const today = new Date(`${todayKst()}T00:00:00Z`);
  const slot = await prisma.scheduleSlot.create({
    data: {
      programId: yogaProgram.id,
      date: today,
      startTime: '10:00',
      endTime: '11:00',
      capacity: 15,
    },
  });

  const reservation = await prisma.reservation.create({
    data: {
      memberId: sujinMember.id,
      scheduleSlotId: slot.id,
      status: ReservationStatus.CONFIRMED,
    },
  });

  await prisma.payment.create({
    data: {
      reservationId: reservation.id,
      memberId: sujinMember.id,
      amount: 30000,
      supplyAmount: 27273, // Math.round(30000 / 1.1)
      vat: 2727,
      method: PaymentMethod.MOCK_CARD,
      status: PaymentStatus.APPROVED,
      mockApprovalNo: 'MOCK-APPROVAL-000001',
      approvedAt: new Date(),
    },
  });

  // ── PT 잔여세션 (이수진, 10회 중 3회 사용) ──────────────
  await prisma.pTSession.create({
    data: {
      memberId: sujinMember.id,
      programId: ptProgram.id,
      totalSessions: 10,
      usedSessions: 3,
      purchasedAt: new Date('2026-08-01'), // D27 — DB 기본값 없음(@db.Date)
    },
  });

  // ── 게시판 ────────────────────────────────────────
  await prisma.post.create({
    data: {
      scope: 'HQ_TO_BRANCH',
      branchId: null, // 전체 지점 공지
      authorId: hqAccount.id,
      category: 'TRAINING_MATERIAL',
      title: 'ERP 시스템 사용 매뉴얼 안내',
      content: '전 지점 팀장급 직원 대상 ERP 사용법 매뉴얼을 게시판에 업로드했습니다.',
      publishedAt: new Date('2026-08-20'), // D27 — DB 기본값 없음(@db.Date)
    },
  });

  await prisma.post.create({
    data: {
      scope: 'BRANCH_TO_MEMBER',
      branchId: seocho.id,
      authorId: minsuAccount.id,
      category: 'EVENT',
      title: '9월 아침 요가 이벤트 안내',
      content: '9월 한 달간 아침 요가 신규 회원 20% 할인 이벤트를 진행합니다.',
      publishedAt: new Date('2026-08-28'),
      visibleToMember: true,
    },
  });

  // ── 혼잡도 스냅샷 + 체크인 ─────────────────────────
  await prisma.facilityCheckIn.create({
    data: { facilityId: gym.id, memberId: sujinMember.id },
  });

  await prisma.congestionSnapshot.create({
    data: {
      facilityId: gym.id,
      currentCount: 18,
      capacity: 60,
      level: 2,
      source: CongestionSource.AUTO,
    },
  });

  console.log('시드 완료:');
  console.log(`  로그인 테스트 계정 (모두 동일 비밀번호: ${DEMO_PASSWORD})`);
  console.log('  - jeong.haneul@spoism.example  (SUPER_ADMIN · 본사)');
  console.log('  - kim.minsu@spoism.example     (BRANCH_ADMIN · 서초점)');
  console.log('  - park.seoyeon@spoism.example  (STAFF · 서초점 트레이너)');
  console.log('  - lee.sujin@example.com        (MEMBER · 서초점)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
