import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { todayKst } from '../src/common/date/kst-date';
import {
  ACTIVE_RESERVATION_STATUSES,
  allocateBranchCode,
  allocateSequence,
  lockScheduleSlot,
} from '../src/prisma/integrity';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp } from './helpers/app';

/**
 * docs/architecture/data-integrity.md DI-03 — 도메인 이관 때 가져다 쓸 트랜잭션 헬퍼를 실DB 위에서
 * 동시 요청으로 검증한다. mock은 단일 Node 프로세스라 이 경합을 재현할 수 없다(Lambda 병렬 인스턴스에서
 * 처음 드러나는 종류의 결함). 테스트가 만든 행은 afterAll에서 지운다.
 */
describe('정합성 헬퍼 — 채번(ADR-STF-02)·회차 행 락(ADR-RSV-01)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const RUN = randomUUID().slice(0, 8);
  const SEQ_PREFIX = `TEST-${RUN}-`;
  const PROGRAM_ID = `d28-program-${RUN}`;
  const memberIds = Array.from({ length: 5 }, (_, i) => `d28-member-${RUN}-${i}`);
  const slotIds: string[] = [];

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    await prisma.program.create({
      data: {
        id: PROGRAM_ID,
        branchId: 'branch-seocho',
        name: 'D28 동시성 테스트',
        category: '요가',
        pricingType: 'PAID_SESSION',
        capacity: 2,
        startDate: new Date('2026-01-01'),
      },
    });
    await prisma.member.createMany({
      data: memberIds.map((id, i) => ({
        id,
        branchId: 'branch-seocho',
        memberNo: `D28-${RUN}-${i}`,
        name: `동시성${i}`,
        joinedAt: new Date(`${todayKst()}T00:00:00Z`),
      })),
    });
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { scheduleSlotId: { in: slotIds } } });
    await prisma.scheduleSlot.deleteMany({ where: { id: { in: slotIds } } });
    await prisma.program.deleteMany({ where: { id: PROGRAM_ID } });
    await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
    await prisma.codeSequence.deleteMany({ where: { prefix: SEQ_PREFIX } });
    await app.close();
  });

  async function newSlot(capacity: number): Promise<string> {
    const slot = await prisma.scheduleSlot.create({
      data: { programId: PROGRAM_ID, date: new Date('2026-12-01'), startTime: '10:00', endTime: '11:00', capacity },
    });
    slotIds.push(slot.id);
    return slot.id;
  }

  /** "정원 확인 → 잠깐 지연 → 예약 삽입". withLock=false면 ADR-RSV-01 이전(무잠금) 흐름. */
  async function reserve(slotId: string, memberId: string, withLock: boolean): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const capacity = withLock
        ? (await lockScheduleSlot(tx, slotId))!.capacity
        : (await tx.scheduleSlot.findUniqueOrThrow({ where: { id: slotId } })).capacity;
      const active = await tx.reservation.count({
        where: { scheduleSlotId: slotId, status: { in: [...ACTIVE_RESERVATION_STATUSES] } },
      });
      await tx.$executeRaw`SELECT pg_sleep(0.2)`; // 경합 창을 넓혀 동시 요청이 확실히 겹치게 한다
      if (active >= capacity) throw new Error('SLOT_FULL');
      await tx.reservation.create({ data: { memberId, scheduleSlotId: slotId, status: 'CONFIRMED' } });
    });
  }

  it('채번: 같은 prefix에 동시 20건 — 첫 채번(행 없음)부터 1..20이 중복·누락 없이 나온다', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        prisma.$transaction((tx) => allocateSequence(tx, 'branch-seocho', 'STAFF', SEQ_PREFIX)),
      ),
    );
    expect([...results].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('채번: 시드된 직원·회원 번호와 충돌하지 않는 다음 번호를 mock과 같은 형식으로 낸다', async () => {
    const rollback = new Error('rollback');
    let staffCode = '';
    let memberNo = '';
    await expect(
      prisma.$transaction(async (tx) => {
        const branch = { id: 'branch-seocho', code: 'SEOCHO' };
        staffCode = await allocateBranchCode(tx, branch, 'STAFF');
        memberNo = await allocateBranchCode(tx, branch, 'MEMBER');
        throw rollback; // 시퀀스를 실제로 소모하지 않도록 되돌린다
      }),
    ).rejects.toBe(rollback);

    expect(staffCode).toMatch(/^SEOCHO-\d{3}$/);
    expect(memberNo).toMatch(new RegExp(`^SEOCHO${todayKst().slice(0, 4)}-\\d{3}$`));
    expect(await prisma.staff.count({ where: { staffCode } })).toBe(0);
    expect(await prisma.member.count({ where: { memberNo } })).toBe(0);
  });

  it('회차 행 락: 예약 0건인 신규 회차(정원 2)에 5명 동시 요청 → 정확히 2건만 확정', async () => {
    const slotId = await newSlot(2);
    const outcomes = await Promise.allSettled(memberIds.map((m) => reserve(slotId, m, true)));
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(2);
    expect(await prisma.reservation.count({ where: { scheduleSlotId: slotId } })).toBe(2);
  });

  it('대조군: 락 없이 같은 흐름이면 정원 2를 넘겨 확정된다(팬텀 삽입) — 락이 실제로 막고 있다는 증거', async () => {
    const slotId = await newSlot(2);
    await Promise.allSettled(memberIds.map((m) => reserve(slotId, m, false)));
    expect(await prisma.reservation.count({ where: { scheduleSlotId: slotId } })).toBeGreaterThan(2);
  });

  it('CHECK 제약(D28): 앱 검증을 우회한 직접 쓰기도 DB가 거부한다 — PT 사용 횟수 초과', async () => {
    const pt = await prisma.pTSession.findFirstOrThrow();
    await expect(
      prisma.pTSession.update({ where: { id: pt.id }, data: { usedSessions: pt.totalSessions + 1 } }),
    ).rejects.toThrow(/PTSession_usage_range_ck/);
  });
  describe('교차 테이블 지점 일치 트리거(DI-02, ADR-STF-04) — 파견 트랜잭션 순서', () => {
    const rollback = new Error('rollback');

    it('담당 회원을 남긴 채 직원 지점을 옮기면 DB가 거부한다', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.staff.update({ where: { id: 'staff-seoyeon' }, data: { branchId: 'branch-gangnam' } });
        }),
      ).rejects.toThrow(/BRANCH_MISMATCH/);
    });

    it('대조군: 담당 해제 → 강사 프로필 연결 해제 → 지점 이동 순서면 통과한다(롤백으로 되돌림)', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.member.updateMany({ where: { assignedStaffId: 'staff-seoyeon' }, data: { assignedStaffId: null } });
          await tx.instructor.updateMany({ where: { staffId: 'staff-seoyeon' }, data: { isActive: false, staffId: null } });
          await tx.staff.update({ where: { id: 'staff-seoyeon' }, data: { branchId: 'branch-gangnam' } });
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    });

    it('다른 지점 회차 예약은 앱을 우회해도 DB가 거부한다', async () => {
      const slotId = await newSlot(5); // 서초 프로그램의 회차
      const gangnamMember = await prisma.member.create({
        data: { branchId: 'branch-gangnam', memberNo: `D28-GN-${RUN}`, name: '강남회원', joinedAt: new Date('2026-09-29') },
      });
      memberIds.push(gangnamMember.id);
      await expect(
        prisma.reservation.create({ data: { memberId: gangnamMember.id, scheduleSlotId: slotId, status: 'REQUESTED' } }),
      ).rejects.toThrow(/BRANCH_MISMATCH/);
    });
  });
});
