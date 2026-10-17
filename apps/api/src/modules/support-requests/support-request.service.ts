import { Injectable } from '@nestjs/common';
import { Prisma, SupportRequest, SupportRequestStatus } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { PageRequest } from '../../common/http/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchService } from '../branches/branch.service';

export interface SupportRequestView {
  id: string;
  branchId: string;
  branchName?: string;
  requesterId: string;
  requesterName?: string;
  category: SupportRequest['category'];
  title: string;
  content: string;
  status: SupportRequestStatus;
  handlerId?: string;
  handlerName?: string;
  response?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// D56 — 상태 전이표. 완료·반려는 종결이다.
const TRANSITIONS: Record<SupportRequestStatus, SupportRequestStatus[]> = {
  REQUESTED: ['IN_PROGRESS', 'DONE', 'REJECTED'],
  IN_PROGRESS: ['DONE', 'REJECTED'],
  DONE: [],
  REJECTED: [],
};
const STATUSES = Object.keys(TRANSITIONS) as SupportRequestStatus[];

const withNames = {
  branch: { select: { name: true } },
  requester: { select: { name: true } },
  handler: { select: { name: true } },
} as const;
type Row = Prisma.SupportRequestGetPayload<{ include: typeof withNames }>;

/**
 * 업무지원 요청(RFP 개념도 현장→본사, D56). 지점 관리자가 요청하고 본사가 처리한다.
 * - 계약 종료 지점은 새 요청 409(CLAUDE.md 계약 종료 차단 — 신규 활동). 과거 요청 조회는 유지.
 * - 상태 변경은 "읽은 상태 그대로일 때만"(조건부 갱신) — 두 본사 관리자가 동시에 바꾸면 한쪽은 409.
 */
@Injectable()
export class SupportRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchService: BranchService,
  ) {}

  async create(
    requester: { accountId: string; branchId: string },
    input: { category: SupportRequest['category']; title: string; content: string },
  ): Promise<SupportRequestView> {
    if ((await this.branchService.loadGate()).isTerminated(requester.branchId)) {
      throw new AppException('BRANCH_TERMINATED', '위탁계약이 종료된 지점에서는 새 업무지원 요청을 올릴 수 없습니다.', 409);
    }
    const row = await this.prisma.supportRequest.create({
      data: {
        branchId: requester.branchId,
        requesterId: requester.accountId,
        category: input.category,
        title: input.title.trim(),
        content: input.content.trim(),
      },
      include: withNames,
    });
    return toView(row);
  }

  // 최근 것부터. 지점 관리자는 가드가 branchId를 본인 지점으로 고정해 넘긴다(D46).
  async list(filter: { branchId?: string; status?: string }, page: PageRequest): Promise<{ items: SupportRequestView[]; total: number }> {
    if (filter.status && !STATUSES.includes(filter.status as SupportRequestStatus)) return { items: [], total: 0 };
    const where: Prisma.SupportRequestWhereInput = {
      branchId: filter.branchId || undefined,
      status: (filter.status as SupportRequestStatus) || undefined,
    };
    const [total, rows] = await Promise.all([
      this.prisma.supportRequest.count({ where }),
      this.prisma.supportRequest.findMany({
        where,
        include: withNames,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: page.skip,
        take: page.pageSize,
      }),
    ]);
    return { items: rows.map(toView), total };
  }

  async findById(id: string): Promise<SupportRequestView> {
    const row = await this.prisma.supportRequest.findUnique({ where: { id }, include: withNames });
    if (!row) throw notFound();
    return toView(row);
  }

  async changeStatus(
    id: string,
    handlerId: string,
    input: { status: Exclude<SupportRequestStatus, 'REQUESTED'>; response?: string },
  ): Promise<SupportRequestView> {
    const response = input.response?.trim() || undefined;
    if (input.status === 'REJECTED' && !response) {
      throw new AppException('RESPONSE_REQUIRED', '반려하려면 답변(사유)을 넣으세요.', 400);
    }
    const current = await this.prisma.supportRequest.findUnique({ where: { id }, select: { status: true } });
    if (!current) throw notFound();
    if (!TRANSITIONS[current.status].includes(input.status)) throw invalidTransition(current.status, input.status);

    const terminal = input.status === 'DONE' || input.status === 'REJECTED';
    const { count } = await this.prisma.supportRequest.updateMany({
      where: { id, status: current.status },
      data: {
        status: input.status,
        handlerId,
        ...(response !== undefined ? { response } : {}),
        resolvedAt: terminal ? new Date() : null,
      },
    });
    if (count === 0) {
      const now = await this.prisma.supportRequest.findUniqueOrThrow({ where: { id }, select: { status: true } });
      throw invalidTransition(now.status, input.status);
    }
    return this.findById(id);
  }
}

function notFound() {
  return new AppException('SUPPORT_REQUEST_NOT_FOUND', '업무지원 요청을 찾을 수 없습니다.', 404);
}

function invalidTransition(from: SupportRequestStatus, to: SupportRequestStatus) {
  return new AppException('INVALID_STATUS_TRANSITION', `${from} 상태에서 ${to}(으)로 바꿀 수 없습니다.`, 409);
}

function toView(r: Row): SupportRequestView {
  return {
    id: r.id,
    branchId: r.branchId,
    branchName: r.branch.name,
    requesterId: r.requesterId,
    requesterName: r.requester.name,
    category: r.category,
    title: r.title,
    content: r.content,
    status: r.status,
    handlerId: r.handlerId ?? undefined,
    handlerName: r.handler?.name,
    response: r.response ?? undefined,
    resolvedAt: r.resolvedAt?.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
