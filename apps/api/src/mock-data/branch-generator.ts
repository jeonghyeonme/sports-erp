// 1-1문서 §1-1이 인용하는 원본 RFP 수치("전국 98개 업장")에 맞춰, 화면이 실제 규모에서도
// 스캔 가능한지 검증할 수 있도록 mock 지점을 96개 더 만든다(서초점·강남점 2개는 mock-data.service.ts에
// 히어로 데이터로 남아있고, 이 파일은 그 나머지를 채운다). 전부 인덱스 기반 결정적 생성이라
// 서버를 몇 번을 재기동해도 같은 결과가 나온다 — Math.random은 쓰지 않는다.

import { AgeGroup, MockBranch, MockFacility, MockInstructor, MockMember, MockProgram, MockStaff } from './mock-data.types';

// 지점명에 쓰는 구체적 지역(area)과, 대시보드에서 "지역별로 묶기"에 쓰는 광역 단위(region)를 분리한다 —
// "강동점"처럼 실제 동네 느낌은 살리면서도, 대시보드에서는 서울/부산/경기 같은 광역으로 접을 수 있게.
const AREAS: Array<{ name: string; region: string }> = [
  { name: '강동', region: '서울' },
  { name: '송파', region: '서울' },
  { name: '마포', region: '서울' },
  { name: '영등포', region: '서울' },
  { name: '노원', region: '서울' },
  { name: '은평', region: '서울' },
  { name: '성북', region: '서울' },
  { name: '동작', region: '서울' },
  { name: '관악', region: '서울' },
  { name: '서대문', region: '서울' },
  { name: '종로', region: '서울' },
  { name: '중구', region: '서울' },
  { name: '용산', region: '서울' },
  { name: '광진', region: '서울' },
  { name: '구로', region: '서울' },
  { name: '금천', region: '서울' },
  { name: '도봉', region: '서울' },
  { name: '강북', region: '서울' },
  { name: '성동', region: '서울' },
  { name: '양천', region: '서울' },
  { name: '강서', region: '서울' },
  { name: '부산', region: '부산' },
  { name: '대구', region: '대구' },
  { name: '인천', region: '인천' },
  { name: '대전', region: '대전' },
  { name: '광주', region: '광주' },
  { name: '울산', region: '울산' },
  { name: '수원', region: '경기' },
  { name: '성남', region: '경기' },
  { name: '고양', region: '경기' },
];
const COMPLEX_NAMES = ['코스모스', '센트럴파크', '그린빌', '라온', '한빛', '메트로', '스카이', '리버뷰'];

const STAFF_NAME_POOL = [
  '김도윤', '이서준', '박하은', '최지호', '정예은', '강민준', '조수아', '윤시우',
  '장다은', '임로운', '한소율', '오은우', '서지안', '신태윤', '권나윤', '황준서',
];
const STAFF_POSITIONS = ['트레이너', '지점장', '매니저'];

const PROGRAM_POOL: Array<{
  name: string;
  category: string;
  price: number;
  ageGroup: AgeGroup;
  description: string;
}> = [
  { name: '헬스장 자유이용', category: '헬스', price: 0, ageGroup: 'ALL', description: '헬스장 시설을 자유롭게 이용할 수 있는 상시 운영 프로그램입니다.' },
  { name: '아침 요가', category: '요가', price: 28000, ageGroup: 'ADULT', description: '기초 체력과 유연성을 함께 기르는 아침 요가 클래스입니다.' },
  { name: '필라테스', category: '필라테스', price: 38000, ageGroup: 'ADULT', description: '소규모 그룹으로 진행하는 필라테스 클래스입니다.' },
  { name: '퍼스널 트레이닝', category: 'PT', price: 65000, ageGroup: 'ADULT', description: '1:1 맞춤 트레이닝 프로그램(세션 차감형).' },
  { name: '스피닝', category: '스피닝', price: 25000, ageGroup: 'TEEN', description: '음악에 맞춰 진행하는 실내 사이클 클래스입니다.' },
];

function pad(n: number, width: number) {
  return String(n).padStart(width, '0');
}

function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

export interface GeneratedDataset {
  branches: MockBranch[];
  staff: MockStaff[];
  members: MockMember[];
  programs: MockProgram[];
  facilities: MockFacility[];
  instructors: MockInstructor[];
}

const LIGHT_BRANCH_COUNT = 96;

export function generateLightBranches(): GeneratedDataset {
  const branches: MockBranch[] = [];
  const staff: MockStaff[] = [];
  const members: MockMember[] = [];
  const programs: MockProgram[] = [];
  const facilities: MockFacility[] = [];
  const instructors: MockInstructor[] = [];
  const now = new Date();

  for (let i = 0; i < LIGHT_BRANCH_COUNT; i++) {
    const area = AREAS[i % AREAS.length];
    const complex = COMPLEX_NAMES[Math.floor(i / AREAS.length) % COMPLEX_NAMES.length];
    const branchId = `branch-gen-${pad(i + 1, 3)}`;
    const code = `GEN${pad(i + 1, 3)}`;
    const name = `${area.name}${complex}점`;

    // 계약 상태 분포(96개 기준): ACTIVE 80 / RENEWAL_DUE 9 / EXPIRED 4 / TERMINATED 3
    let contractStatus: MockBranch['contractStatus'];
    let contractEndAt: string;
    if (i < 80) {
      contractStatus = 'ACTIVE';
      contractEndAt = toDateStr(addDays(now, 400 + i * 3));
    } else if (i < 89) {
      contractStatus = 'RENEWAL_DUE';
      contractEndAt = toDateStr(addDays(now, 12 + ((i - 80) * 5)));
    } else if (i < 93) {
      contractStatus = 'EXPIRED';
      contractEndAt = toDateStr(addDays(now, -(20 + (i - 89) * 15)));
    } else {
      contractStatus = 'TERMINATED';
      contractEndAt = toDateStr(addDays(now, -(220 + (i - 93) * 30)));
    }
    const contractStartAt = toDateStr(addDays(now, -(365 * 2) - i * 7));

    branches.push({
      id: branchId,
      name,
      address: `${area.name} 일대`,
      region: area.region,
      code,
      standardCheckInTime: i % 2 === 0 ? '09:00' : '09:30',
      cancellationDeadlineHours: 24,
      contractPartner: `${area.name}${complex}아파트 입주자대표회의`,
      contractStartAt,
      contractEndAt,
      contractStatus,
    });

    const staffCount = 1 + (i % 3);
    const branchStaffIds: string[] = [];
    for (let s = 0; s < staffCount; s++) {
      const staffId = `staff-gen-${pad(i + 1, 3)}-${s + 1}`;
      branchStaffIds.push(staffId);
      staff.push({
        id: staffId,
        accountId: `account-gen-${pad(i + 1, 3)}-${s + 1}`,
        branchId,
        staffCode: `${code}-${pad(s + 1, 3)}`,
        name: STAFF_NAME_POOL[(i * 3 + s) % STAFF_NAME_POOL.length],
        position: STAFF_POSITIONS[s % STAFF_POSITIONS.length],
        employmentType: s === 0 ? '정규직' : '파트타임',
        hireDate: toDateStr(addDays(now, -(200 + (i * 3 + s) * 11))),
        status: 'ACTIVE',
      });
    }

    const memberCount = i % 5;
    for (let m = 0; m < memberCount; m++) {
      const assignToStaff = m % 2 === 0 && branchStaffIds.length > 0;
      members.push({
        id: `member-gen-${pad(i + 1, 3)}-${m + 1}`,
        branchId,
        assignedStaffId: assignToStaff ? branchStaffIds[m % branchStaffIds.length] : undefined,
        memberNo: `${code}2026-${pad(m + 1, 3)}`,
        name: STAFF_NAME_POOL[(i * 5 + m + 7) % STAFF_NAME_POOL.length],
        phone: `010-${pad((i * 7 + m) % 10000, 4)}-${pad((i * 13 + m) % 10000, 4)}`,
        status: (i + m) % 9 === 0 ? 'DORMANT' : 'ACTIVE',
        joinedAt: toDateStr(addDays(now, -(30 + (i * 5 + m) * 6))),
        guardianConsent: false,
      });
    }

    // 지점당 강사 1명(있으면 그 지점의 여러 프로그램을 함께 담당) — branchStaffIds가 있을 때만 생성.
    let branchInstructorId: string | undefined;
    if (branchStaffIds.length > 0) {
      branchInstructorId = `instructor-gen-${pad(i + 1, 3)}`;
      instructors.push({
        id: branchInstructorId,
        branchId,
        name: STAFF_NAME_POOL[i % STAFF_NAME_POOL.length],
        specialty: PROGRAM_POOL[i % PROGRAM_POOL.length].category,
        isActive: true,
      });
    }

    const programCount = 1 + (i % 2);
    for (let p = 0; p < programCount; p++) {
      const template = PROGRAM_POOL[(i + p) % PROGRAM_POOL.length];
      const status: MockProgram['status'] = (i + p) % 11 === 0 ? 'PREPARING' : (i + p) % 17 === 0 ? 'PAUSED' : 'RUNNING';
      programs.push({
        id: `program-gen-${pad(i + 1, 3)}-${p + 1}`,
        branchId,
        facilityId: `facility-gen-${pad(i + 1, 3)}`,
        instructorId: branchInstructorId,
        name: template.name,
        category: template.category,
        ageGroup: template.ageGroup,
        description: template.description,
        pricingType: template.price === 0 ? 'FREE_ACCESS' : p === 0 ? 'PAID_SESSION' : 'PT_PACKAGE',
        price: template.price,
        status,
        startDate: toDateStr(addDays(now, -(60 + (i + p) * 4))),
      });
    }

    const capacity = 40 + (i % 5) * 10;
    const currentCount = Math.round(capacity * (0.15 + ((i % 6) * 0.13)));
    facilities.push({
      id: `facility-gen-${pad(i + 1, 3)}`,
      branchId,
      name: `${name.replace('점', '')} 헬스장`,
      type: 'GYM',
      capacity,
      currentCount: Math.min(currentCount, capacity),
      level: Math.min(5, 1 + (i % 5)),
    });
  }

  return { branches, staff, members, programs, facilities, instructors };
}
