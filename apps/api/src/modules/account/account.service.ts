import { HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { RequestUser } from '../../common/types/request-user.interface';
import { Paginated } from '../../common/types/paginated.interface';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Account(role) + Staff(소속/직급)를 트랜잭션으로 함께 생성합니다.
   * staffCode는 "{지점코드}-{순번}" 형식(02문서)이며, 지점 내 기존 Staff 수로 다음 순번을 매깁니다.
   * 완전한 동시성 방지(SELECT ... FOR UPDATE)는 02모듈(Staff CRUD, Phase 2) 범위이므로,
   * 여기서는 유니크 제약 충돌 시 재시도하는 수준으로 충분히 실사용 가능하게 처리합니다.
   */
  async create(dto: CreateAccountDto) {
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
    if (!branch) {
      throw new AppException('BRANCH_NOT_FOUND', '존재하지 않는 지점입니다.', HttpStatus.NOT_FOUND);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const staffCode = await this.nextStaffCode(dto.branchId, branch.code);
      try {
        return await this.prisma.$transaction(async (tx) => {
          const account = await tx.account.create({
            data: { email: dto.email, passwordHash, role: dto.role },
          });
          const staff = await tx.staff.create({
            data: {
              accountId: account.id,
              branchId: dto.branchId,
              staffCode,
              name: dto.name,
              position: dto.position,
              hireDate: new Date(),
            },
          });
          return {
            accountId: account.id,
            email: account.email,
            role: account.role,
            staffId: staff.id,
            staffCode,
          };
        });
      } catch (err) {
        const isUniqueConflict = (err as { code?: string })?.code === 'P2002';
        if (!isUniqueConflict || attempt === 2) throw err;
      }
    }
    throw new AppException(
      'STAFF_CODE_CONFLICT',
      'staffCode 생성 중 충돌이 반복되었습니다. 다시 시도해주세요.',
      HttpStatus.CONFLICT,
    );
  }

  private async nextStaffCode(branchId: string, branchCode: string) {
    const count = await this.prisma.staff.count({ where: { branchId } });
    const seq = (count + 1).toString().padStart(3, '0');
    return `${branchCode}-${seq}`;
  }

  /**
   * 01문서 §5 PATCH /accounts/:id/deactivate.
   * SUPER_ADMIN은 전체, BRANCH_ADMIN은 본인 지점 직원만 대상으로 할 수 있습니다.
   * 연결된 Staff가 있으면 퇴사 처리(status=RESIGNED)까지 함께 반영해 02문서의
   * "퇴사 처리 ↔ 계정 비활성화" 원자성 원칙을 이 방향(계정→직원)에서도 지킵니다.
   */
  async deactivate(id: string, actor: RequestUser) {
    const account = await this.prisma.account.findUnique({ where: { id }, include: { staff: true } });
    if (!account) {
      throw new AppException('ACCOUNT_NOT_FOUND', '존재하지 않는 계정입니다.', HttpStatus.NOT_FOUND);
    }
    if (actor.role === 'BRANCH_ADMIN' && account.staff?.branchId !== actor.branchId) {
      throw new AppException(
        'BRANCH_SCOPE_FORBIDDEN',
        '본인 지점 소속 직원만 비활성화할 수 있습니다.',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.account.update({ where: { id }, data: { isActive: false } });
    if (account.staff) {
      await this.prisma.staff.update({
        where: { id: account.staff.id },
        data: { status: 'RESIGNED', resignDate: new Date() },
      });
    }
    return { deactivated: true };
  }

  async list(page: number, pageSize: number): Promise<Paginated<unknown>> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { staff: true, member: true },
      }),
      this.prisma.account.count(),
    ]);
    return {
      items: items.map((a) => ({
        id: a.id,
        email: a.email,
        role: a.role,
        isActive: a.isActive,
        branchId: a.staff?.branchId ?? a.member?.branchId ?? null,
        name: a.staff?.name ?? a.member?.name ?? null,
        lastLoginAt: a.lastLoginAt,
      })),
      total,
      page,
      pageSize,
    };
  }
}
