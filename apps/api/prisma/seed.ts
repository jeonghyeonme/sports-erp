/**
 * 시드 스크립트 — docs/00_공통설계서.md SHEET 04(가상 회사 시나리오) 데이터를 그대로 재현합니다.
 * 등장인물: 정하늘(본사) · 김민수(서초점장) · 박서연(트레이너/강사) · 이수진(회원)
 *
 * 실행: npm run prisma:seed --workspace=apps/api  (package.json의 prisma.seed 설정 참고)
 */
import { PrismaClient, Role, PricingType, AgeGroup, FacilityType, ReservationStatus, PaymentMethod, PaymentStatus, CongestionSource } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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
      address: '서울시 서초구',
      standardCheckInTime: '09:00',
    },
  });

  const gangnam = await prisma.branch.upsert({
    where: { id: 'branch-gangnam' },
    update: {},
    create: {
      id: 'branch-gangnam',
      name: '강남점',
      address: '서울시 강남구',
      standardCheckInTime: '09:00',
    },
  });

  // ── 계정 · 인물 ────────────────────────────────────

  // 정하늘 — 본사 운영팀장 (SUPER_ADMIN)
  const hqAccount = await prisma.account.upsert({
    where: { email: 'jeong.haneul@spoism.example' },
    update: {},
    create: {
      email: 'jeong.haneul@spoism.example',
      passwordHash,
      role: Role.SUPER_ADMIN,
    },
  });

  // 김민수 — 서초점 지점장 (BRANCH_ADMIN)
  const minsuAccount = await prisma.account.upsert({
    where: { email: 'kim.minsu@spoism.example' },
    update: {},
    create: {
      email: 'kim.minsu@spoism.example',
      passwordHash,
      role: Role.BRANCH_ADMIN,
    },
  });
  const minsuStaff = await prisma.staff.upsert({
    where: { accountId: minsuAccount.id },
    update: {},
    create: {
      accountId: minsuAccount.id,
      branchId: seocho.id,
      staffCode: 'SEOCHO-001',
      name: '김민수',
      position: '지점장',
      employmentType: '정규직',
      hireDate: new Date('2021-03-02'),
    },
  });

  // 박서연 — 서초점 트레이너 겸 요가 강사 (Staff 계정, 로그인은 관리자 화면 미사용 가정이라 Account 없이 Staff만 둘 수도 있지만
  // 근태/업무일지를 본인이 기록해야 하므로 Account를 만들고 role은 BRANCH_ADMIN이 아닌 별도 직원 로그인이 필요 — 여기서는
  // 01문서 범위상 Staff 로그인도 결국 하나의 Account/Role 체계를 쓰므로 BRANCH_ADMIN이 아닌 일반 직원 로그인 확장은
  // Phase 2에서 별도 처리하고, 시드에서는 Staff 레코드만 생성합니다(계정 없이 관리자가 대리 입력하는 경우를 재현).
  const seoyeonStaff = await prisma.staff.create({
    data: {
      accountId: (
        await prisma.account.upsert({
          where: { email: 'park.seoyeon@spoism.example' },
          update: {},
          create: {
            email: 'park.seoyeon@spoism.example',
            passwordHash,
            role: Role.BRANCH_ADMIN, // TODO(Phase 2): STAFF 전용 역할 분리
          },
        })
      ).id,
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
    where: { email: 'lee.sujin@example.com' },
    update: {},
    create: {
      email: 'lee.sujin@example.com',
      passwordHash,
      role: Role.MEMBER,
    },
  });
  const sujinMember = await prisma.member.upsert({
    where: { accountId: sujinAccount.id },
    update: {},
    create: {
      accountId: sujinAccount.id,
      branchId: seocho.id,
      memberNo: 'SEOCHO2026-001',
      name: '이수진',
      phone: '010-1234-5678',
      joinedAt: new Date('2026-03-15'),
    },
  });

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
    },
  });

  // ── 예약 + 결제 (이수진이 아침 요가 예약) ──────────────
  const today = new Date();
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
