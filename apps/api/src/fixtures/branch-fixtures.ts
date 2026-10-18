import { sideBranchDataset } from './side-branch-fixtures';
import { BranchRecord, MockBranch } from './mock-data.types';

/**
 * 지점 원천 레코드 — D29. 원래 prisma/seed.ts(DB 원천)와 MockDataService(이름표 사본)가
 * **같은 목록**에서 만들어지도록 한 곳에 뒀다. D36으로 mock이 사라져 지금은 시드와 test/branch-parity.spec.ts만 쓴다. 예전에는 seed.ts가 서초·강남을 따로 적어
 * 계약 종료일 등이 mock과 달랐다.
 *
 * 서초점·강남점은 손으로 채운 "히어로" 지점(데모 로그인 계정이 여기 물려 있음)이고, 나머지 3곳은
 * side-branch-fixtures.ts의 계약 상태 대조군(갱신임박·만료·계약종료, 계약 날짜만 실행일 기준 상대값)이다(D58).
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
    // D58 — 갱신임박 대조군은 마포점이 맡는다(고정 날짜 2026-10-15가 지나 상태와 어긋났었다).
    contractEndAt: '2027-09-30',
    contractStatus: 'ACTIVE',
  },
];

/** 시드가 DB에 넣는 5개 지점 전체(D58 — 예전 수도권 83곳, D40). */
export function allBranchRecords(): BranchRecord[] {
  return [...HERO_BRANCHES, ...sideBranchDataset().branches];
}

/** 계약 필드를 뺀 mock 사본 — 계약 상태는 DB에서만 읽는다(BranchGate). */
export function toMockBranch(record: BranchRecord): MockBranch {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { contractPartner, contractStartAt, contractEndAt, contractStatus, ...rest } = record;
  return rest;
}
