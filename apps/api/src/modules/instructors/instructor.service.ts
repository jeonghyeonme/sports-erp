import { Injectable } from '@nestjs/common';
import { Instructor } from '@prisma/client';
import { MockInstructor } from '../../mock-data/mock-data.types';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../prisma/prisma.service';

export type InstructorView = MockInstructor & { branchName?: string };

/**
 * 강사 — D31. 원천은 DB다.
 * D31에서 둔 mock 미러는 D32로 마지막 독자가 사라져 없앴다. 직원 파견이 강사 겸임을 푸는 것은
 * StaffService.assign 트랜잭션 안에서 끝난다(ADR-STF-04).
 */
@Injectable()
export class InstructorService {
  constructor(private readonly prisma: PrismaService) {}

  async list(branchId?: string): Promise<InstructorView[]> {
    const rows = await this.prisma.instructor.findMany({
      where: { branchId },
      include: { branch: { select: { name: true } } },
      orderBy: { id: 'asc' },
    });
    return rows.map((r) => ({ ...toMockInstructor(r), branchName: r.branch.name }));
  }

  async findById(id: string): Promise<MockInstructor | null> {
    const row = await this.prisma.instructor.findUnique({ where: { id } });
    return row ? toMockInstructor(row) : null;
  }

  // 강사프로그램게시 A-5 POST /instructors — BRANCH_ADMIN 전용(컨트롤러에서 강제).
  async hire(
    branchId: string,
    input: { name: string; specialty?: string; bio?: string; phone?: string },
  ): Promise<InstructorView> {
    const row = await this.prisma.instructor.create({
      data: { branchId, name: input.name, specialty: input.specialty, bio: input.bio, phone: input.phone },
    });
    return this.view(row.id);
  }

  // 강사프로그램게시 A-5 PATCH /instructors/:id. 강사프로그램게시 A-6 — 비활성화는 isActive=false(소프트 삭제), 연결된 프로그램은 유지.
  async update(
    id: string,
    input: Partial<Pick<MockInstructor, 'name' | 'specialty' | 'bio' | 'phone' | 'isActive'>>,
  ): Promise<InstructorView> {
    if (!(await this.prisma.instructor.findUnique({ where: { id }, select: { id: true } }))) {
      throw new AppException('INSTRUCTOR_NOT_FOUND', '강사를 찾을 수 없습니다.', 404);
    }
    await this.prisma.instructor.update({
      where: { id },
      data: {
        name: input.name,
        specialty: input.specialty,
        bio: input.bio,
        phone: input.phone,
        isActive: input.isActive,
      },
    });
    return this.view(id);
  }

  private async view(id: string): Promise<InstructorView> {
    const row = await this.prisma.instructor.findUniqueOrThrow({
      where: { id },
      include: { branch: { select: { name: true } } },
    });
    return { ...toMockInstructor(row), branchName: row.branch.name };
  }
}

function toMockInstructor(row: Instructor): MockInstructor {
  return {
    id: row.id,
    branchId: row.branchId,
    staffId: row.staffId ?? undefined,
    name: row.name,
    specialty: row.specialty ?? undefined,
    bio: row.bio ?? undefined,
    photoUrl: row.photoUrl ?? undefined,
    phone: row.phone ?? undefined,
    isActive: row.isActive,
  };
}
