import { MockPost } from './mock-data.types';

/**
 * 게시글의 시드 원천 — D36. 원천은 DB이고, prisma/seed.ts만 이 목록을 쓴다.
 * 값·id는 예전 mock 그대로다(전사 매뉴얼 공지는 회원 비노출 — ADR-BRD-01, 서초점 이벤트는 회원 노출).
 * createdAt은 목록 순서(등록순)를 mock과 같게 하려고 게시일 기준으로 넣는다.
 */
export function postSeed(): Array<MockPost & { createdAt: string }> {
  return [
    {
      id: 'post-hq-manual',
      scope: 'HQ_TO_BRANCH',
      authorId: 'account-haneul',
      category: 'TRAINING_MATERIAL',
      title: 'ERP 시스템 사용 매뉴얼 안내',
      content: '전 지점 팀장급 직원 대상 ERP 사용법 매뉴얼을 게시판에 업로드했습니다.',
      viewCount: 0,
      publishedAt: '2026-08-20',
      visibleToMember: false,
      createdAt: '2026-08-20T00:00:00.000Z',
    },
    {
      id: 'post-seocho-event',
      scope: 'BRANCH_TO_MEMBER',
      branchId: 'branch-seocho',
      authorId: 'account-minsu',
      category: 'EVENT',
      title: '9월 아침 요가 이벤트 안내',
      content: '9월 한 달간 아침 요가 신규 회원 20% 할인 이벤트를 진행합니다.',
      viewCount: 0,
      publishedAt: '2026-08-28',
      visibleToMember: true,
      createdAt: '2026-08-28T00:00:00.000Z',
    },
  ];
}
