import { generateLightBranches } from './branch-generator';
import { MockFacility, MockInstructor, MockProgram, MockScheduleSlot } from './mock-data.types';

/**
 * 시설·강사·프로그램·회차의 시드 원천 — D31. 원천은 DB이고, prisma/seed.ts만 이 목록을 쓴다.
 * mock은 앱이 뜰 때 DB에서 미러를 채우므로(FacilityService·InstructorService·ProgramService.onModuleInit)
 * 이 파일을 직접 읽지 않는다.
 *
 * 히어로 값은 예전 mock 값 그대로다(화면에 보이던 값). id도 mock 값이라 아직 mock인 수강·PT·예약 데이터가
 * 그대로 가리킨다(CLAUDE.md "데모 계정은 mock과 id를 맞출 것").
 */

const HERO_FACILITIES: readonly MockFacility[] = [
  {
    id: 'facility-seocho-gym',
    branchId: 'branch-seocho',
    name: '서초점 헬스장',
    type: 'GYM',
    capacity: 60,
    currentCount: 18,
    level: 2,
    lastUpdatedAt: '2026-09-01T09:00:00.000Z',
    isActive: true,
  },
  {
    id: 'facility-seocho-pool',
    branchId: 'branch-seocho',
    name: '서초점 수영장',
    type: 'POOL',
    capacity: 30,
    currentCount: 26,
    level: 5,
    lastUpdatedAt: '2026-09-01T09:00:00.000Z',
    isActive: true,
  },
  {
    id: 'facility-gangnam-gym',
    branchId: 'branch-gangnam',
    name: '강남점 헬스장',
    type: 'GYM',
    capacity: 50,
    currentCount: 12,
    level: 2,
    lastUpdatedAt: '2026-09-01T09:00:00.000Z',
    isActive: true,
  },
];

const HERO_INSTRUCTORS: readonly MockInstructor[] = [
  {
    id: 'instructor-seoyeon',
    branchId: 'branch-seocho',
    // 서초점 트레이너 박서연이 겸임한다(DB Instructor.staffId). 파견 시 ADR-STF-04가 이 연결을 푼다.
    staffId: 'staff-seoyeon',
    name: '박서연',
    specialty: '요가·필라테스',
    isActive: true,
  },
];

const HERO_PROGRAMS: readonly MockProgram[] = [
  {
    id: 'program-seocho-yoga',
    branchId: 'branch-seocho',
    facilityId: 'facility-seocho-gym',
    instructorId: 'instructor-seoyeon',
    name: '아침 요가',
    category: '요가',
    ageGroup: 'ADULT',
    description: '기초 체력과 유연성을 함께 기르는 아침 요가 클래스입니다.',
    pricingType: 'PAID_SESSION',
    price: 30000,
    capacity: 15,
    status: 'RUNNING',
    startDate: '2026-01-05',
  },
  {
    id: 'program-seocho-pt',
    branchId: 'branch-seocho',
    facilityId: 'facility-seocho-gym',
    instructorId: 'instructor-seoyeon',
    name: '퍼스널 트레이닝',
    category: 'PT',
    ageGroup: 'ADULT',
    description: '1:1 맞춤 트레이닝 프로그램(세션 차감형).',
    pricingType: 'PT_PACKAGE',
    price: 60000,
    status: 'RUNNING',
    startDate: '2026-01-05',
  },
  {
    id: 'program-seocho-freegym',
    branchId: 'branch-seocho',
    facilityId: 'facility-seocho-gym',
    name: '헬스장 자유이용',
    category: '헬스',
    ageGroup: 'ALL',
    description: '헬스장 시설을 자유롭게 이용할 수 있는 상시 운영 프로그램입니다.',
    pricingType: 'FREE_ACCESS',
    price: 0,
    status: 'RUNNING',
    startDate: '2025-01-01',
  },
  {
    id: 'program-seocho-pilates',
    branchId: 'branch-seocho',
    facilityId: 'facility-seocho-gym',
    instructorId: 'instructor-seoyeon',
    name: '필라테스 (10월 개강 예정)',
    category: '필라테스',
    ageGroup: 'ADULT',
    description: '10월 개강 예정인 소규모 필라테스 클래스입니다.',
    pricingType: 'PAID_SESSION',
    price: 35000,
    capacity: 12,
    status: 'PREPARING',
    startDate: '2026-10-01',
  },
  {
    id: 'program-gangnam-pilates',
    branchId: 'branch-gangnam',
    facilityId: 'facility-gangnam-gym',
    name: '강남점 필라테스',
    category: '필라테스',
    ageGroup: 'ADULT',
    description: '강남점에서 운영하는 필라테스 클래스입니다.',
    pricingType: 'PAID_SESSION',
    price: 40000,
    capacity: 10,
    status: 'RUNNING',
    startDate: '2026-02-01',
  },
];

// 예약및결제 A-3 — '아침 요가'(PAID_SESSION, capacity 15)에 데모용 회차 2건.
// 두 번째 회차는 정원을 일부러 작게 잡아 SLOT_FULL(정원 초과) 케이스를 바로 테스트할 수 있게 한다.
const HERO_SLOTS: readonly MockScheduleSlot[] = [
  {
    id: 'slot-seocho-yoga-1',
    programId: 'program-seocho-yoga',
    date: '2026-09-21',
    startTime: '07:00',
    endTime: '08:00',
    capacity: 15,
  },
  {
    id: 'slot-seocho-yoga-2',
    programId: 'program-seocho-yoga',
    date: '2026-09-22',
    startTime: '07:00',
    endTime: '08:00',
    capacity: 2,
  },
];

export interface CatalogSeed {
  facilities: MockFacility[];
  instructors: MockInstructor[];
  programs: MockProgram[];
  slots: MockScheduleSlot[];
}

/** 시드가 DB에 넣는 시설·강사·프로그램·회차 전체(히어로 + 생성 81개 지점분). */
export function catalogSeed(): CatalogSeed {
  const g = generateLightBranches();
  return {
    facilities: [...HERO_FACILITIES, ...g.facilities],
    instructors: [...HERO_INSTRUCTORS, ...g.instructors],
    programs: [...HERO_PROGRAMS, ...g.programs],
    slots: [...HERO_SLOTS],
  };
}
