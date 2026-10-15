import { Injectable } from '@nestjs/common';
import { ChangeRequestStatus, StaffProfileChangeRequest } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { maskPhone } from '../../common/privacy/mask-phone';
import { recordAudit } from '../../prisma/audit';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangeableField } from './dto/create-change-request.dto';

export interface ChangeRequestView {
  id: string;
  staffId: string;
  staffName?: string;
  field: string;
  oldValue?: string;
  newValue: string;
  status: ChangeRequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

const STATUSES: ChangeRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

/**
 * 인사 변경 신청 → 지점 관리자 1단계 승인(D11, 인사정보관리 ADR-STF-09).
 * - 신청은 STAFF 본인, 항목은 이름·연락처. 같은 항목에 대기 신청이 있으면 409(먼저 것을 취소한다).
 * - 대기 신청 검사와 생성은 직원 행 락 위에서 한다 — 동시에 두 번 눌러도 대기 1건.
 * - 승인은 "대기 상태일 때만"(조건부 갱신) 바꾸고, 같은 트랜잭션에서 직원 값 반영 + 변경 이력(STAFF_PROFILE_CHANGED, D52 방식).
 *   연락처는 이력에 값을 넣지 않는다(D44 결정 4). 반려는 값을 바꾸지 않고 이력도 남기지 않는다(신청 행이 기록).
 */
@Injectable()
export class StaffChangeRequestService {
  constructor(private readonly prisma: PrismaService) {}

  async create(staffId: string, field: ChangeableField, newValue: string): Promise<ChangeRequestView> {
    const value = newValue.trim();
    if (!value) throw new AppException('VALIDATION_ERROR', '바꿀 값을 넣으세요.', 400);
    if (field === 'phone' && !/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(value)) {
      throw new AppException('VALIDATION_ERROR', '연락처는 010-1234-5678 형식으로 넣으세요.', 400);
    }
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Staff" WHERE "id" = ${staffId} FOR UPDATE`;
      const staff = await tx.staff.findUnique({ where: { id: staffId }, select: { name: true, phone: true, status: true } });
      if (!staff) throw new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
      if (staff.status === 'RESIGNED') throw new AppException('STAFF_ALREADY_RESIGNED', '퇴사한 직원은 신청할 수 없습니다.', 409);
      const current = staff[field] ?? undefined;
      if (current === value) throw new AppException('CHANGE_REQUEST_NO_CHANGE', '지금 값과 같습니다.', 400);
      const pending = await tx.staffProfileChangeRequest.count({ where: { staffId, field, status: 'PENDING' } });
      if (pending > 0) {
        throw new AppException('CHANGE_REQUEST_PENDING', '같은 항목에 대기 중인 신청이 있습니다. 먼저 취소하세요.', 409);
      }
      return tx.staffProfileChangeRequest.create({ data: { staffId, field, oldValue: current ?? null, newValue: value } });
    });
    return toView(row);
  }

  async listMine(staffId: string): Promise<ChangeRequestView[]> {
    const rows = await this.prisma.staffProfileChangeRequest.findMany({ where: { staffId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => toView(r));
  }

  // 신청함 — 지점 관리자는 자기 지점(신청자의 현재 소속) 것만, 본사는 전체(조회). 연락처 값은 목록이라 마스킹한다(ADR-MEM-04).
  async listForReview(filter: { branchId?: string; status?: string }): Promise<ChangeRequestView[]> {
    if (filter.status && !STATUSES.includes(filter.status as ChangeRequestStatus)) return [];
    const rows = await this.prisma.staffProfileChangeRequest.findMany({
      where: {
        status: filter.status as ChangeRequestStatus | undefined,
        staff: filter.branchId ? { branchId: filter.branchId } : undefined,
      },
      include: { staff: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => {
      const view = toView(r, r.staff.name);
      return r.field === 'phone' ? { ...view, oldValue: maskPhone(view.oldValue), newValue: maskPhone(view.newValue) } : view;
    });
  }

  // 대기 중인 본인 신청만 지운다(취소). 상태 값에 "취소"가 없어 행을 지운다 — 스키마 변경 없이(ADR-STF-09).
  async cancel(id: string): Promise<{ id: string }> {
    const { count } = await this.prisma.staffProfileChangeRequest.deleteMany({ where: { id, status: 'PENDING' } });
    if (count === 0) throw alreadyReviewed();
    return { id };
  }

  async approve(id: string, reviewer: { accountId: string }): Promise<ChangeRequestView> {
    const row = await this.prisma.$transaction(async (tx) => {
      const req = await this.claim(tx, id, 'APPROVED', reviewer.accountId);
      const field = req.field as ChangeableField;
      const staff = await tx.staff.findUniqueOrThrow({ where: { id: req.staffId }, select: { name: true, phone: true, branchId: true } });
      await tx.staff.update({ where: { id: req.staffId }, data: { [field]: req.newValue } });
      await recordAudit(tx, {
        actorId: reviewer.accountId,
        entity: 'Staff',
        entityId: req.staffId,
        action: 'STAFF_PROFILE_CHANGED',
        // 연락처는 값을 남기지 않는다(D44 결정 4) — 바뀐 항목만.
        before: field === 'name' ? { field, name: staff.name } : { field },
        after: field === 'name' ? { field, name: req.newValue, requestId: id, branchId: staff.branchId } : { field, requestId: id, branchId: staff.branchId },
      });
      return req;
    });
    return toView(row);
  }

  async reject(id: string, reviewer: { accountId: string }): Promise<ChangeRequestView> {
    const row = await this.prisma.$transaction((tx) => this.claim(tx, id, 'REJECTED', reviewer.accountId));
    return toView(row);
  }

  // 대기 상태일 때만 바꾼다 — 동시 승인·반려·취소 중 하나만 이긴다.
  private async claim(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    id: string,
    status: ChangeRequestStatus,
    reviewedBy: string,
  ): Promise<StaffProfileChangeRequest> {
    const { count } = await tx.staffProfileChangeRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status, reviewedBy, reviewedAt: new Date() },
    });
    if (count === 0) throw alreadyReviewed();
    return tx.staffProfileChangeRequest.findUniqueOrThrow({ where: { id } });
  }
}

function alreadyReviewed() {
  return new AppException('CHANGE_REQUEST_ALREADY_REVIEWED', '이미 처리됐거나 취소된 신청입니다. 화면을 새로고침하세요.', 409);
}

function toView(r: StaffProfileChangeRequest, staffName?: string): ChangeRequestView {
  return {
    id: r.id,
    staffId: r.staffId,
    staffName,
    field: r.field,
    oldValue: r.oldValue ?? undefined,
    newValue: r.newValue,
    status: r.status,
    reviewedBy: r.reviewedBy ?? undefined,
    reviewedAt: r.reviewedAt?.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}
