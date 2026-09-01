import { HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { RequestUser } from '../../common/types/request-user.interface';
import { Paginated } from '../../common/types/paginated.interface';
import { RegisterMemberDto } from './dto/register-member.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';

@Injectable()
export class MemberService {
  constructor(private readonly prisma: PrismaService) {}

  /** POST /members/register — 공개 앱 회원가입 */
  async register(dto: RegisterMemberDto) {
    const existing = await this.prisma.account.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new AppException('EMAIL_ALREADY_EXISTS', '이미 가입된 이메일입니다.', HttpStatus.CONFLICT);
    }
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
    if (!branch) {
      throw new AppException('BRANCH_NOT_FOUND', '존재하지 않는 지점입니다.', HttpStatus.NOT_FOUND);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const memberNo = await this.nextMemberNo(dto.branchId, branch.code);

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: { email: dto.email, passwordHash, role: 'MEMBER' },
      });
      const member = await tx.member.create({
        data: {
          accountId: account.id,
          branchId: dto.branchId,
          memberNo,
          name: dto.name,
          phone: dto.phone,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          gender: dto.gender,
        },
      });
      return { accountId: account.id, memberId: member.id, memberNo: member.memberNo };
    });
  }

  /** POST /members — BRANCH_ADMIN 현장(오프라인) 등록. Account 없이 Member만 생성 */
  async createOffline(dto: CreateMemberDto, actor: RequestUser) {
    if (!actor.branchId) {
      throw new AppException('NO_BRANCH_ASSIGNED', '지점에 소속되지 않은 계정입니다.', HttpStatus.FORBIDDEN);
    }
    const branch = await this.prisma.branch.findUniqueOrThrow({ where: { id: actor.branchId } });
    const memberNo = await this.nextMemberNo(actor.branchId, branch.code);

    return this.prisma.member.create({
      data: {
        branchId: actor.branchId,
        memberNo,
        name: dto.name,
        phone: dto.phone,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        gender: dto.gender,
        memo: dto.memo,
      },
    });
  }

  /** memberNo 형식: "{지점코드}{연도}-{순번}" (05문서 §3). 유니크 충돌 시 최대 3회 재시도 */
  private async nextMemberNo(branchId: string, branchCode: string): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const count = await this.prisma.member.count({
        where: { branchId, memberNo: { startsWith: `${branchCode}${year}` } },
      });
      const seq = (count + 1 + attempt).toString().padStart(3, '0');
      const memberNo = `${branchCode}${year}-${seq}`;
      const exists = await this.prisma.member.findUnique({ where: { memberNo } });
      if (!exists) return memberNo;
    }
    throw new AppException(
      'MEMBER_NO_CONFLICT',
      '회원번호 생성 중 충돌이 반복되었습니다. 다시 시도해주세요.',
      HttpStatus.CONFLICT,
    );
  }

  async list(query: ListMembersQueryDto, actor: RequestUser): Promise<Paginated<unknown>> {
    const where: Prisma.MemberWhereInput = {};
    if (actor.role === 'BRANCH_ADMIN') {
      if (!actor.branchId) {
        throw new AppException('NO_BRANCH_ASSIGNED', '지점에 소속되지 않은 계정입니다.', HttpStatus.FORBIDDEN);
      }
      where.branchId = actor.branchId;
    } else if (query.branchId) {
      where.branchId = query.branchId;
    }
    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q } },
        { memberNo: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.member.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.member.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * 리소스 id 기반 접근의 실제 권한 관문 — BranchScopeGuard가 걸러내지 못하는
   * `/members/:id`류 엔드포인트를 여기서 재검증합니다(00문서 §3.3 "2중 방어").
   */
  private async findAccessible(id: string, actor: RequestUser) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) {
      throw new AppException('MEMBER_NOT_FOUND', '존재하지 않는 회원입니다.', HttpStatus.NOT_FOUND);
    }
    if (actor.role === 'SUPER_ADMIN') return member;
    if (actor.role === 'BRANCH_ADMIN') {
      if (member.branchId !== actor.branchId) {
        throw new AppException('BRANCH_SCOPE_FORBIDDEN', '본인 지점 회원만 조회할 수 있습니다.', HttpStatus.FORBIDDEN);
      }
      return member;
    }
    if (actor.role === 'MEMBER') {
      if (member.id !== actor.memberId) {
        throw new AppException('FORBIDDEN', '본인 정보만 조회할 수 있습니다.', HttpStatus.FORBIDDEN);
      }
      return member;
    }
    // STAFF: 00문서 §3.4 권한 매트릭스상 회원 리소스는 대상 아님
    throw new AppException('FORBIDDEN', '이 리소스에 접근할 권한이 없습니다.', HttpStatus.FORBIDDEN);
  }

  async findOne(id: string, actor: RequestUser) {
    return this.findAccessible(id, actor);
  }

  async update(id: string, dto: UpdateMemberDto, actor: RequestUser) {
    const member = await this.findAccessible(id, actor);
    const data: Prisma.MemberUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    // 05문서 §7: 본인(MEMBER)은 이름·전화번호만 수정 가능 — memo는 관리자 전용
    if (dto.memo !== undefined && actor.role !== 'MEMBER') data.memo = dto.memo;
    return this.prisma.member.update({ where: { id: member.id }, data });
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'DORMANT' | 'WITHDRAWN', actor: RequestUser) {
    if (actor.role === 'MEMBER') {
      throw new AppException('FORBIDDEN', '회원 상태 변경은 지점 관리자만 가능합니다.', HttpStatus.FORBIDDEN);
    }
    const member = await this.findAccessible(id, actor);
    const updated = await this.prisma.member.update({ where: { id: member.id }, data: { status } });
    // 05문서 §6: 탈퇴 시 소프트 삭제 + 연결 계정 즉시 로그인 차단(결제/예약 이력은 보존)
    if (status === 'WITHDRAWN' && updated.accountId) {
      await this.prisma.account.update({ where: { id: updated.accountId }, data: { isActive: false } });
    }
    return updated;
  }

  async enrollments(id: string, actor: RequestUser) {
    const member = await this.findAccessible(id, actor);
    return this.prisma.courseEnrollment.findMany({
      where: { memberId: member.id },
      include: { program: true },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  async ptSessions(id: string, actor: RequestUser) {
    const member = await this.findAccessible(id, actor);
    const sessions = await this.prisma.pTSession.findMany({
      where: { memberId: member.id },
      include: { program: true },
      orderBy: { purchasedAt: 'desc' },
    });
    return sessions.map((s) => ({ ...s, remainingSessions: s.totalSessions - s.usedSessions }));
  }

  async usePtSession(id: string, sessionId: string, note: string | undefined, actor: RequestUser) {
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'BRANCH_ADMIN') {
      throw new AppException('FORBIDDEN', 'PT 세션 차감은 지점 관리자만 가능합니다.', HttpStatus.FORBIDDEN);
    }
    const member = await this.findAccessible(id, actor);
    const session = await this.prisma.pTSession.findUnique({ where: { id: sessionId } });
    if (!session || session.memberId !== member.id) {
      throw new AppException('PT_SESSION_NOT_FOUND', '존재하지 않는 PT 세션입니다.', HttpStatus.NOT_FOUND);
    }
    // 05문서 §6: remainingSessions는 항상 서버 계산 — 0 이하로 차감 시도하면 400
    if (session.usedSessions >= session.totalSessions) {
      throw new AppException('PT_SESSION_EXHAUSTED', '잔여 세션이 없습니다.', HttpStatus.BAD_REQUEST);
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pTSession.update({
        where: { id: sessionId },
        data: { usedSessions: { increment: 1 } },
      });
      await tx.pTSessionLog.create({ data: { ptSessionId: sessionId, note } });
      return { ...updated, remainingSessions: updated.totalSessions - updated.usedSessions };
    });
  }
}
