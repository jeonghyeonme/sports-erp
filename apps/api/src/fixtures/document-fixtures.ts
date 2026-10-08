import { MockDocument } from './mock-data.types';

/**
 * 문서의 시드 원천 — D34. 원천은 DB이고, prisma/seed.ts만 이 목록을 쓴다.
 * 값은 예전 mock 그대로다(자원문서관리 부록 A — 전사 매뉴얼은 영구 보관, 서초점 위탁계약서는 보존기한 임박 목록 시연용).
 */
export function documentSeed(): MockDocument[] {
  return [
    {
      id: 'doc-hq-manual',
      category: 'MANUAL',
      title: 'ERP 이용자 매뉴얼 v1',
      fileUrl: 'https://files.example/spoism/erp-manual-v1.pdf',
      fileType: 'pdf',
      fileSize: 2048000,
      uploadedBy: 'account-haneul',
      createdAt: '2026-08-20T09:00:00.000Z',
    },
    {
      id: 'doc-seocho-contract',
      category: 'CONTRACT',
      branchId: 'branch-seocho',
      title: '서초점 위탁운영계약서',
      fileUrl: 'https://files.example/spoism/seocho-contract.pdf',
      fileType: 'pdf',
      fileSize: 1024000,
      uploadedBy: 'account-haneul',
      retentionUntil: '2026-10-05',
      createdAt: '2026-01-05T09:00:00.000Z',
    },
  ];
}
