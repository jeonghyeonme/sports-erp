/**
 * 시드 스크립트 — docs/00_공통설계서.md SHEET 04(가상 회사 시나리오) 데이터를 그대로 재현합니다.
 * 등장인물: 정하늘(본사) · 김민수(서초점장) · 박서연(트레이너/강사) · 이수진(회원)
 *
 * 실행: npm run prisma:seed --workspace=apps/api  (package.json의 prisma.seed 설정 참고)
 */
import { PrismaClient, Role, PricingType, ProgramStatus, AgeGroup, FacilityType, ReservationStatus, PaymentMethod, PaymentStatus, CongestionSource, CodeSequenceKind } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { todayKst } from '../src/common/date/kst-date';
import { allBranchRecords } from '../src/mock-data/branch-fixtures';
import { staffSeed } from '../src/mock-data/staff-fixtures';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'demo-password-1234'; // 로컬 시연용. 실제 배포에서는 절대 사용 금지.

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ── 지점 — D29: mock과 같은 원천(branch-fixtures.ts)에서 98개 전부 ──────────────
  // 예전엔 서초·강남 2개를 여기 따로 적어 계약 종료일 등이 mock과 달랐다. 이제 지점의 원천은 DB이고,
  // mock에는 계약 필드를 뺀 이름표 사본만 남는다(test/branch-parity.spec.ts가 둘이 같은지 검증).
  // update에도 같은 값을 넣어 시드를 다시 돌리면 지점이 원천과 다시 맞춰지게 한다.
  for (const b of allBranchRecords()) {
    const data = {
      name: b.name,
      code: b.code,
      address: b.address,
      region: b.region,
      standardCheckInTime: b.standardCheckInTime,
      cancellationDeadlineHours: b.cancellationDeadlineHours,
      contractPartner: b.contractPartner,
      contractStartAt: new Date(`${b.contractStartAt}T00:00:00Z`),
      contractEndAt: b.contractEndAt ? new Date(`${b.contractEndAt}T00:00:00Z`) : null,
      contractStatus: b.contractStatus,
    };
    await prisma.branch.upsert({ where: { id: b.id }, update: data, create: { id: b.id, ...data } });
  }
  const seocho = { id: 'branch-seocho' };

  // ── 직원·파견·관리자 계정 — D30: 원천은 DB, mock은 앱이 뜰 때 여기서 미러를 채운다 ─────────
  // 히어로 id는 예전 mock 값 그대로다(아직 mock인 회원 담당 직원 등이 이 id를 가리킴).
  // update에도 같은 값을 넣어 시드를 다시 돌리면 원천과 다시 맞춰지게 한다(비밀번호·활성 여부 포함).
  const staffData = staffSeed();
  for (const a of staffData.accounts) {
    const data = { email: a.email, passwordHash, role: a.role as Role, name: a.name, isActive: true };
    await prisma.account.upsert({ where: { id: a.id }, update: data, create: { id: a.id, ...data } });
  }
  const dateOf = (d: string) => new Date(`${d}T00:00:00Z`);
  for (const st of staffData.staff) {
    const data = {
      accountId: st.accountId,
      branchId: st.branchId,
      staffCode: st.staffCode,
      name: st.name,
      phone: st.phone ?? null,
      position: st.position ?? null,
      employmentType: st.employmentType ?? null,
      offDays: st.offDays ?? [],
      hireDate: dateOf(st.hireDate),
      resignDate: st.resignDate ? dateOf(st.resignDate) : null,
      status: st.status,
    };
    await prisma.staff.upsert({ where: { id: st.id }, update: data, create: { id: st.id, ...data } });
  }
  for (const as of staffData.assignments) {
    const data = {
      staffId: as.staffId,
      branchId: as.branchId,
      startDate: dateOf(as.startDate),
      endDate: as.endDate ? dateOf(as.endDate) : null,
      assignedBy: as.assignedBy,
      note: as.note ?? null,
    };
    await prisma.staffAssignment.upsert({ where: { id: as.id }, update: data, create: { id: as.id, ...data } });
  }
  const hqAccount = { id: 'account-haneul' };
  const minsuAccount = { id: 'account-minsu' };
  const seoyeonStaff = { id: 'staff-seoyeon' };

  const seoyeonInstructor = await prisma.instructor.upsert({
    where: { staffId: seoyeonStaff.id },
    update: {},
    create: {
      branchId: seocho.id,
      staffId: seoyeonStaff.id,
      name: '박서연',
      specialty: '요가 · 필라테스',
      bio: '5년차 요가 강사, 하타/빈야사 전문',
    },
  });

  // 이수진 — 서초점 회원(회원 도메인은 아직 mock이 원천 — D29 순서상 4단계)
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

  // ── 채번 시퀀스 — D28/DI-03, D30 ────────────────────────
  // 번호를 직접 박아 넣은 직원·회원만큼 시퀀스를 올려 둔다. 안 그러면 allocateBranchCode의 첫 채번이
  // 기존 번호(SEOCHO-001 등)와 unique 충돌한다. 직원은 지점별 "{코드}-" prefix의 최대 순번으로 맞춘다.
  const staffSeq = new Map<string, { branchId: string; prefix: string; lastValue: number }>();
  const branchByCode = new Map(allBranchRecords().map((b) => [b.code, b.id]));
  for (const st of staffData.staff) {
    const m = /^(.+)-(\d+)$/.exec(st.staffCode);
    const branchId = m && branchByCode.get(m[1]);
    if (!m || !branchId) throw new Error(`시드 직원번호 형식 오류: ${st.staffCode}`);
    const key = `${branchId}|${m[1]}-`;
    const cur = staffSeq.get(key);
    staffSeq.set(key, { branchId, prefix: `${m[1]}-`, lastValue: Math.max(cur?.lastValue ?? 0, Number(m[2])) });
  }
  for (const seq of [
    ...[...staffSeq.values()].map((v) => ({ ...v, kind: CodeSequenceKind.STAFF })),
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
