import { MockAsset } from './mock-data.types';

/**
 * 자산의 시드 원천 — D35(2-1_기술결정사항.md). 원천은 DB이고, prisma/seed.ts만 이 목록을 쓴다.
 * 값은 예전 mock 그대로다(1-10문서 §4 — 서초점 데모 자산. 러닝머신은 100만원 초과라 FIXED_ASSET, 소독제는 CONSUMABLE).
 * 자산번호 시퀀스(CodeSequence ASSET)는 seed.ts가 이 목록의 prefix별 최대 순번으로 맞춘다.
 */
export function assetSeed(): MockAsset[] {
  return [
    {
      id: 'asset-seocho-treadmill',
      assetCode: 'SEOCHO-A001',
      branchId: 'branch-seocho',
      name: '러닝머신',
      category: 'EXERCISE_EQUIPMENT',
      assetType: 'FIXED_ASSET',
      acquiredAt: '2025-03-10',
      acquisitionCost: 3200000,
      usefulLifeYears: 5,
      status: 'NORMAL',
      quantity: 1,
      location: '2층 헬스장',
    },
    {
      id: 'asset-seocho-aed',
      assetCode: 'SEOCHO-A002',
      branchId: 'branch-seocho',
      name: '자동제세동기(AED)',
      category: 'SAFETY_EQUIPMENT',
      assetType: 'FIXED_ASSET',
      acquiredAt: '2025-06-01',
      acquisitionCost: 1800000,
      usefulLifeYears: 5,
      status: 'REPAIRING',
      quantity: 1,
      location: '1층 로비',
    },
    {
      id: 'asset-seocho-sanitizer',
      assetCode: 'SEOCHO-A003',
      branchId: 'branch-seocho',
      name: '손소독제',
      category: 'OTHER',
      assetType: 'CONSUMABLE',
      acquiredAt: '2026-08-01',
      acquisitionCost: 45000,
      status: 'NORMAL',
      quantity: 12,
    },
  ];
}
