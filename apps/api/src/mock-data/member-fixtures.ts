import { generateLightBranches } from './branch-generator';
import { MockCourseEnrollment, MockMember, MockPTSession, MockPTSessionLog } from './mock-data.types';

/**
 * 회원·회원 계정·수강·PT의 시드 원천 — D32(2-1_기술결정사항.md). 원천은 DB이고, prisma/seed.ts만 이 목록을 쓴다.
 * D30·D31과 달리 mock 미러가 없다 — 이 데이터를 동기적으로 읽는 mock 도메인이 남지 않았다(D32 결정 1).
 *
 * 히어로 id·값은 예전 mock 그대로다(member-sujin, pt-session-sujin 등).
 */

export interface MemberAccountRecord {
  id: string;
  email: string;
  name: string;
  memberId: string;
}

const HERO_MEMBERS: readonly MockMember[] = [
  {
    id: 'member-sujin',
    accountId: 'account-sujin',
    branchId: 'branch-seocho',
    assignedStaffId: 'staff-seoyeon', // 박서연 트레이너 담당
    memberNo: 'SEOCHO2026-001',
    name: '이수진',
    phone: '010-1234-5678',
    status: 'ACTIVE',
    joinedAt: '2026-03-15',
    guardianConsent: false,
  },
  {
    id: 'member-younghee',
    branchId: 'branch-gangnam',
    memberNo: 'GANGNAM2026-001',
    name: '오영희',
    phone: '010-2345-6789',
    status: 'ACTIVE',
    joinedAt: '2026-02-01',
    guardianConsent: false,
  },
  {
    id: 'member-dormant',
    branchId: 'branch-seocho',
    memberNo: 'SEOCHO2025-014',
    name: '한지민',
    phone: '010-9999-0000',
    status: 'DORMANT',
    joinedAt: '2025-05-20',
    guardianConsent: false,
  },
];

const MEMBER_ACCOUNTS: readonly MemberAccountRecord[] = [
  { id: 'account-sujin', email: 'lee.sujin@example.com', name: '이수진', memberId: 'member-sujin' },
];

// ADR-MEM-03 — 서초점 회원 이수진의 데모 수강내역·PT 세션.
const ENROLLMENTS: readonly MockCourseEnrollment[] = [
  {
    id: 'enrollment-sujin-yoga',
    memberId: 'member-sujin',
    programId: 'program-seocho-yoga',
    enrolledAt: '2026-08-01',
    status: 'ACTIVE',
  },
];

const PT_SESSIONS: readonly MockPTSession[] = [
  {
    id: 'pt-session-sujin',
    memberId: 'member-sujin',
    programId: 'program-seocho-pt',
    totalSessions: 10,
    usedSessions: 3,
    purchasedAt: '2026-08-01',
  },
];

const PT_SESSION_LOGS: readonly MockPTSessionLog[] = [
  { id: 'pt-log-1', ptSessionId: 'pt-session-sujin', usedAt: '2026-08-05T10:00:00.000Z' },
  { id: 'pt-log-2', ptSessionId: 'pt-session-sujin', usedAt: '2026-08-12T10:00:00.000Z' },
  { id: 'pt-log-3', ptSessionId: 'pt-session-sujin', usedAt: '2026-08-19T10:00:00.000Z' },
];

export interface MemberSeed {
  members: MockMember[];
  accounts: MemberAccountRecord[];
  enrollments: MockCourseEnrollment[];
  ptSessions: MockPTSession[];
  ptSessionLogs: MockPTSessionLog[];
}

/** 시드가 DB에 넣는 회원 전체(히어로 3 + 생성 지점분)와 회원 계정·수강·PT. */
export function memberSeed(): MemberSeed {
  return {
    members: [...HERO_MEMBERS, ...generateLightBranches().members],
    accounts: [...MEMBER_ACCOUNTS],
    enrollments: [...ENROLLMENTS],
    ptSessions: [...PT_SESSIONS],
    ptSessionLogs: [...PT_SESSION_LOGS],
  };
}
