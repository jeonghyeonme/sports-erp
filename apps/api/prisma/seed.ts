/**
 * 시드 스크립트 — docs/00_공통설계서.md SHEET 04(가상 회사 시나리오) 데이터를 그대로 재현합니다.
 * 등장인물: 정하늘(본사) · 김민수(서초점장) · 박서연(트레이너/강사) · 이수진(회원)
 *
 * 실행: npm run prisma:seed --workspace=apps/api  (package.json의 prisma.seed 설정 참고)
 */
import { PrismaClient, Role, PricingType, ProgramStatus, AgeGroup, FacilityType, CongestionSource, CodeSequenceKind, MemberStatus, EnrollmentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { allBranchRecords } from '../src/mock-data/branch-fixtures';
import { staffSeed } from '../src/mock-data/staff-fixtures';
import { catalogSeed } from '../src/mock-data/catalog-fixtures';
import { memberSeed } from '../src/mock-data/member-fixtures';

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
  // 회원은 "{코드}{연도}" prefix별 최대 순번(D32) — SEOCHO2025-014처럼 지난 연도 번호도 그 prefix의 시퀀스를 올린다.
  const memberData = memberSeed();
  const memberSeq = new Map<string, { branchId: string; prefix: string; lastValue: number }>();
  for (const mb of memberData.members) {
    const m = /^(.+)-(\d+)$/.exec(mb.memberNo);
    if (!m) throw new Error(`시드 회원번호 형식 오류: ${mb.memberNo}`);
    const key = `${mb.branchId}|${m[1]}`;
    const cur = memberSeq.get(key);
    memberSeq.set(key, { branchId: mb.branchId, prefix: m[1], lastValue: Math.max(cur?.lastValue ?? 0, Number(m[2])) });
  }
  for (const seq of [
    ...[...staffSeq.values()].map((v) => ({ ...v, kind: CodeSequenceKind.STAFF })),
    ...[...memberSeq.values()].map((v) => ({ ...v, kind: CodeSequenceKind.MEMBER })),
  ]) {
    await prisma.codeSequence.upsert({
      where: { branchId_kind_prefix: { branchId: seq.branchId, kind: seq.kind, prefix: seq.prefix } },
      update: { lastValue: seq.lastValue },
      create: seq,
    });
  }

  // ── 시설·강사·프로그램·회차 — D31: 원천은 DB, mock은 앱이 뜰 때 여기서 미러를 채운다 ─────────
  // 히어로 id·값은 예전 mock 그대로다(catalog-fixtures.ts). update에도 같은 값을 넣어 시드를 다시 돌리면
  // 원천과 다시 맞춰지게 한다. 참조 순서: 시설·강사 → 프로그램(D28 지점 일치 트리거) → 회차.
  const catalog = catalogSeed();
  for (const f of catalog.facilities) {
    const data = {
      branchId: f.branchId,
      name: f.name,
      type: f.type as FacilityType,
      capacity: f.capacity,
      currentCount: f.currentCount,
      level: f.level,
      lastUpdatedAt: new Date(f.lastUpdatedAt),
      isActive: f.isActive,
    };
    await prisma.facility.upsert({ where: { id: f.id }, update: data, create: { id: f.id, ...data } });
  }
  for (const ins of catalog.instructors) {
    const data = {
      branchId: ins.branchId,
      staffId: ins.staffId ?? null,
      name: ins.name,
      specialty: ins.specialty ?? null,
      bio: ins.bio ?? null,
      photoUrl: ins.photoUrl ?? null,
      phone: ins.phone ?? null,
      isActive: ins.isActive,
    };
    await prisma.instructor.upsert({ where: { id: ins.id }, update: data, create: { id: ins.id, ...data } });
  }
  for (const p of catalog.programs) {
    const data = {
      branchId: p.branchId,
      facilityId: p.facilityId ?? null,
      instructorId: p.instructorId ?? null,
      name: p.name,
      category: p.category,
      ageGroup: p.ageGroup as AgeGroup,
      description: p.description ?? null,
      pricingType: p.pricingType as PricingType,
      price: p.price,
      capacity: p.capacity ?? null,
      status: p.status as ProgramStatus,
      startDate: dateOf(p.startDate),
      endDate: p.endDate ? dateOf(p.endDate) : null,
    };
    await prisma.program.upsert({ where: { id: p.id }, update: data, create: { id: p.id, ...data } });
  }
  for (const sl of catalog.slots) {
    const data = {
      programId: sl.programId,
      date: dateOf(sl.date),
      startTime: sl.startTime,
      endTime: sl.endTime,
      capacity: sl.capacity,
    };
    await prisma.scheduleSlot.upsert({ where: { id: sl.id }, update: data, create: { id: sl.id, ...data } });
  }
  const gym = { id: 'facility-seocho-gym' };

  // ── 회원·회원 계정·수강·PT — D32: 원천은 DB(미러 없음). 값은 예전 mock 그대로(member-fixtures.ts) ─────
  // 참조 순서: 계정 → 회원(지점·담당 직원) → 수강·PT(프로그램) → PT 사용 기록. 예전에 여기서 만들던
  // 예약·결제 데모 행과 그 회차는 mock에 없던 데이터라 뺐다(D32 "데이터").
  for (const a of memberData.accounts) {
    const data = { email: a.email, passwordHash, role: Role.MEMBER, name: a.name, isActive: true };
    await prisma.account.upsert({ where: { id: a.id }, update: data, create: { id: a.id, ...data } });
  }
  for (const mb of memberData.members) {
    const data = {
      accountId: mb.accountId ?? null,
      branchId: mb.branchId,
      assignedStaffId: mb.assignedStaffId ?? null,
      memberNo: mb.memberNo,
      name: mb.name,
      phone: mb.phone ?? null,
      birthDate: mb.birthDate ? dateOf(mb.birthDate) : null,
      gender: mb.gender ?? null,
      joinedAt: dateOf(mb.joinedAt),
      status: mb.status as MemberStatus,
      guardianConsent: mb.guardianConsent,
      memo: mb.memo ?? null,
    };
    await prisma.member.upsert({ where: { id: mb.id }, update: data, create: { id: mb.id, ...data } });
  }
  for (const e of memberData.enrollments) {
    const data = {
      memberId: e.memberId,
      programId: e.programId,
      enrolledAt: dateOf(e.enrolledAt),
      expiresAt: e.expiresAt ? dateOf(e.expiresAt) : null,
      status: e.status as EnrollmentStatus,
    };
    await prisma.courseEnrollment.upsert({ where: { id: e.id }, update: data, create: { id: e.id, ...data } });
  }
  for (const pt of memberData.ptSessions) {
    const data = {
      memberId: pt.memberId,
      programId: pt.programId,
      totalSessions: pt.totalSessions,
      usedSessions: pt.usedSessions,
      purchasedAt: dateOf(pt.purchasedAt),
    };
    await prisma.pTSession.upsert({ where: { id: pt.id }, update: data, create: { id: pt.id, ...data } });
  }
  for (const log of memberData.ptSessionLogs) {
    const data = { ptSessionId: log.ptSessionId, usedAt: new Date(log.usedAt), note: log.note ?? null };
    await prisma.pTSessionLog.upsert({ where: { id: log.id }, update: data, create: { id: log.id, ...data } });
  }
  const sujinMember = { id: 'member-sujin' };

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
