import { MockDocument } from './mock-data.types';

/**
 * 문서의 시드 원천 — D34. 원천은 DB이고, prisma/seed.ts만 이 목록을 쓴다.
 * 값은 예전 mock 그대로다(자원문서관리 부록 A — 전사 매뉴얼은 영구 보관).
 * D69 — 위탁운영 계약서는 문서가 아니라 계약 회차에 있어 뺐다. 그 자리(예전 'doc-seocho-contract')는 지점 문서 격리·삭제 테스트용
 * 서초점 기타 문서로 바꿨다 — 직원 인사서류로 두면 직원별 인사서류 목록 테스트가 흔들리고, 재직자 인사서류는 보존기한이 정해지지 않는다.
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
      id: 'doc-seocho-ops',
      category: 'OTHER',
      branchId: 'branch-seocho',
      title: '서초점 시설 운영 점검표',
      fileUrl: 'https://files.example/spoism/seocho-ops.pdf',
      fileType: 'pdf',
      fileSize: 1024000,
      uploadedBy: 'account-haneul',
      createdAt: '2026-01-05T09:00:00.000Z',
    },
  ];
}
