// 계약 상태 대조군 지점 3곳 — D58. 예전 branch-generator.ts(수도권 81곳, D40)를 대체한다.
// 서초점(ACTIVE)·강남점(ACTIVE) 히어로 옆에 갱신임박·만료·계약종료 지점을 하나씩 두어, 기준 시드만으로도
// 계약 상태별 동작(차단은 TERMINATED만)과 재배치 대기를 볼 수 있게 한다. 데이터는 최소로 손으로 적고,
// 계약 날짜만 시드 실행일 기준 상대값이다(갱신임박·만료가 날짜가 지나 어긋나지 않게). Math.random은 쓰지 않는다.
// 시연용 고밀도 데이터는 prisma/demo-layer.ts가 이 위에 얹는다.

import { BranchRecord, MockFacility, MockInstructor, MockMember, MockProgram, MockStaff } from './mock-data.types';

export interface SideBranchDataset {
  branches: BranchRecord[];
  staff: MockStaff[];
  members: MockMember[];
  programs: MockProgram[];
  facilities: MockFacility[];
  instructors: MockInstructor[];
}

function dateFromToday(days: number) {
  // 날짜 문자열만 쓰므로 KST 오늘을 기준으로 잡는다(00:00~08:59 KST에 돌려도 하루 밀리지 않게).
  const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const d = new Date(`${kstToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface SideBranchSpec {
  key: string;
  code: string;
  name: string;
  area: string;
  contractStatus: BranchRecord['contractStatus'];
  contractStartDays: number;
  contractEndDays: number;
  staff: Array<{ name: string; position: string; employmentType: string; phone: string; hireDays: number }>;
  members: Array<{ name: string; phone: string; joinedDays: number; status?: MockMember['status'] }>;
  program: { name: string; category: string; price: number };
}

const SPECS: readonly SideBranchSpec[] = [
  {
    key: 'mapo',
    code: 'MAPO',
    name: '마포점',
    area: '마포',
    contractStatus: 'RENEWAL_DUE',
    contractStartDays: -700,
    contractEndDays: 35,
    staff: [
      { name: '윤재현', position: '지점장', employmentType: '정규직', phone: '010-4100-0001', hireDays: -690 },
      { name: '한소율', position: '트레이너', employmentType: '정규직', phone: '010-4100-0002', hireDays: -400 },
    ],
    members: [
      { name: '문가은', phone: '010-5100-0001', joinedDays: -200 },
      { name: '배준호', phone: '010-5100-0002', joinedDays: -90 },
    ],
    program: { name: '필라테스', category: '필라테스', price: 38000 },
  },
  {
    key: 'songpa',
    code: 'SONGPA',
    name: '송파점',
    area: '송파',
    contractStatus: 'EXPIRED',
    contractStartDays: -760,
    contractEndDays: -20,
    staff: [
      { name: '강민준', position: '지점장', employmentType: '정규직', phone: '010-4200-0001', hireDays: -750 },
      { name: '조수아', position: '트레이너', employmentType: '파트타임', phone: '010-4200-0002', hireDays: -300 },
    ],
    members: [{ name: '임하린', phone: '010-5200-0001', joinedDays: -320 }],
    program: { name: '아침 요가', category: '요가', price: 28000 },
  },
  {
    key: 'nowon',
    code: 'NOWON',
    name: '노원점',
    area: '노원',
    contractStatus: 'TERMINATED',
    contractStartDays: -900,
    contractEndDays: -120,
    staff: [
      { name: '서지안', position: '지점장', employmentType: '정규직', phone: '010-4300-0001', hireDays: -880 },
      { name: '신태윤', position: '트레이너', employmentType: '정규직', phone: '010-4300-0002', hireDays: -500 },
    ],
    members: [{ name: '권나윤', phone: '010-5300-0001', joinedDays: -400, status: 'DORMANT' }],
    program: { name: '스피닝', category: '스피닝', price: 25000 },
  },
];

export function sideBranchDataset(): SideBranchDataset {
  const out: SideBranchDataset = { branches: [], staff: [], members: [], programs: [], facilities: [], instructors: [] };
  for (const s of SPECS) {
    const branchId = `branch-${s.key}`;
    out.branches.push({
      id: branchId,
      name: s.name,
      address: `서울시 ${s.area}구`,
      region: '서울',
      code: s.code,
      standardCheckInTime: '09:00',
      cancellationDeadlineHours: 24,
      contractPartner: `${s.area} OO아파트 입주자대표회의`,
      contractStartAt: dateFromToday(s.contractStartDays),
      contractEndAt: dateFromToday(s.contractEndDays),
      contractStatus: s.contractStatus,
    });
    const staffIds = s.staff.map((st, i) => {
      const id = `staff-${s.key}-${i + 1}`;
      out.staff.push({
        id,
        accountId: `account-${s.key}-${i + 1}`,
        branchId,
        staffCode: `${s.code}-${String(i + 1).padStart(3, '0')}`,
        name: st.name,
        phone: st.phone,
        position: st.position,
        employmentType: st.employmentType,
        hireDate: dateFromToday(st.hireDays),
        status: 'ACTIVE',
      });
      return id;
    });
    s.members.forEach((m, i) => {
      out.members.push({
        id: `member-${s.key}-${i + 1}`,
        branchId,
        // 인사정보관리 ADR-STF-07 — 계약 종료 지점은 전이 때 담당이 풀린 상태라 시드에도 담당을 두지 않는다(log/103).
        assignedStaffId: s.contractStatus !== 'TERMINATED' && i === 0 ? staffIds[1] : undefined,
        memberNo: `${s.code}2026-${String(i + 1).padStart(3, '0')}`,
        name: m.name,
        phone: m.phone,
        status: m.status ?? 'ACTIVE',
        joinedAt: dateFromToday(m.joinedDays),
        guardianConsent: false,
      });
    });
    const facilityId = `facility-${s.key}-gym`;
    out.facilities.push({
      id: facilityId,
      branchId,
      name: `${s.name} 헬스장`,
      type: 'GYM',
      capacity: 40,
      currentCount: 8,
      level: 1,
      lastUpdatedAt: '2026-09-01T09:00:00.000Z',
      isActive: true,
    });
    const instructorId = `instructor-${s.key}`;
    out.instructors.push({ id: instructorId, branchId, name: s.staff[1].name, specialty: s.program.category, isActive: true });
    out.programs.push({
      id: `program-${s.key}-1`,
      branchId,
      facilityId,
      instructorId,
      name: s.program.name,
      category: s.program.category,
      ageGroup: 'ADULT',
      description: `${s.name}에서 운영하는 ${s.program.name} 클래스입니다.`,
      pricingType: 'PAID_SESSION',
      price: s.program.price,
      capacity: 10, // ADR-PRG-01 — PAID_SESSION은 정원 필수
      status: s.contractStatus === 'TERMINATED' ? 'ENDED' : 'RUNNING',
      startDate: dateFromToday(s.contractStartDays + 30),
    });
  }
  return out;
}
