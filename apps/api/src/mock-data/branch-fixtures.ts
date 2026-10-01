import { generateLightBranches } from './branch-generator';
import { BranchRecord, MockBranch } from './mock-data.types';

/**
 * 지점 원천 레코드 — D29. 원래 prisma/seed.ts(DB 원천)와 MockDataService(이름표 사본)가
 * **같은 목록**에서 만들어지도록 한 곳에 뒀다. D36으로 mock이 사라져 지금은 시드와 test/branch-parity.spec.ts만 쓴다. 예전에는 seed.ts가 서초·강남을 따로 적어
 * 계약 종료일 등이 mock과 달랐다.
 *
 * 서초점·강남점은 손으로 채운 "히어로" 지점(데모 로그인 계정이 여기 물려 있음)이고, 나머지 96개는
 * branch-generator.ts가 인덱스 기반으로 결정적으로 만든다(계약 날짜만 실행 시각 기준 상대값).
 */
export const HERO_BRANCHES: readonly BranchRecord[] = [
  {
    id: 'branch-seocho',
    name: '서초점',
    address: '서울시 서초구',
    region: '서울',
    code: 'SEOCHO',
    standardCheckInTime: '09:00',
    cancellationDeadlineHours: 24,
    contractPartner: '서초 OO아파트 입주자대표회의',
    contractStartAt: '2024-03-01',
    contractEndAt: '2027-02-28',
    contractStatus: 'ACTIVE',
  },
  {
    id: 'branch-gangnam',
    name: '강남점',
    address: '서울시 강남구',
    region: '서울',
    code: 'GANGNAM',
    standardCheckInTime: '09:30',
    cancellationDeadlineHours: 24,
    contractPartner: '강남 OO오피스텔 관리사무소',
    contractStartAt: '2023-10-01',
    contractEndAt: '2026-10-15',
    contractStatus: 'RENEWAL_DUE',
  },
];

/** 시드가 DB에 넣는 98개 지점 전체. */
export function allBranchRecords(): BranchRecord[] {
  return [...HERO_BRANCHES, ...generateLightBranches().branches];
}

/** 계약 필드를 뺀 mock 사본 — 계약 상태는 DB에서만 읽는다(BranchGate). */
export function toMockBranch(record: BranchRecord): MockBranch {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { contractPartner, contractStartAt, contractEndAt, contractStatus, ...rest } = record;
  return rest;
}
