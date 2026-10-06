import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { allBranchRecords, toMockBranch } from '../src/mock-data/branch-fixtures';
import { ACCOUNTS, BRANCH, createApp, login } from './helpers/app';
import { setBranchStatus } from './helpers/branch-status';

/**
 * D29 — 지점의 원천은 DB다. D36으로 mock 이름표 사본(MockDataService.branches)은 독자가 사라져 없앴고,
 * 이제는 시드 원천(src/mock-data/branch-fixtures.ts)이 DB에 그대로 들어갔는지를 본다 — 어긋나면 지점명·코드(채번)·
 * 체크인 기준 시각(지각 판정)·취소 기준 시간이 조용히 틀어진다.
 */
describe('지점 원천(DB)과 시드 원천', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('시드 원천의 모든 이름표 필드가 DB 지점과 같다(83개, D40 수도권)', async () => {
    const rows = await app.get(PrismaService).branch.findMany();
    const db = new Map(rows.map((r) => [r.id, r]));
    const mock = allBranchRecords().map(toMockBranch);

    expect(mock).toHaveLength(83);
    expect(rows).toHaveLength(mock.length);
    // DB의 null과 mock의 undefined(필드 생략)는 같은 뜻이라 맞춰서 비교한다.
    const fromDb = (id: string) => {
      const r = db.get(id);
      return r && {
        id: r.id,
        name: r.name,
        code: r.code,
        address: r.address ?? undefined,
        region: r.region,
        standardCheckInTime: r.standardCheckInTime ?? undefined,
        cancellationDeadlineHours: r.cancellationDeadlineHours ?? undefined,
      };
    };
    for (const b of mock) {
      expect(fromDb(b.id)).toEqual(b);
    }
  });

  it('GET /branches의 계약 상태는 DB에서 온다 — DB만 바꿔도 응답이 바뀐다', async () => {
    const token = await login(app, ACCOUNTS.superAdmin);
    const statusOf = async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/branches').set('Authorization', token);
      expect(res.status).toBe(200);
      return (res.body.data as Array<{ id: string; contractStatus: string }>).find((b) => b.id === BRANCH.gangnam)
        ?.contractStatus;
    };

    expect(await statusOf()).toBe('RENEWAL_DUE'); // 시드 값(대조군)
    await setBranchStatus(BRANCH.gangnam, 'TERMINATED'); // DB만 바꾼다
    expect(await statusOf()).toBe('TERMINATED');
  });

  it('GET /branches는 이관 전과 같은 형식(계약 날짜 YYYY-MM-DD + 건수)을 돌려준다', async () => {
    const token = await login(app, ACCOUNTS.seochoAdmin);
    const res = await request(app.getHttpServer()).get('/api/v1/branches').set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: BRANCH.seocho,
        name: '서초점',
        region: '서울',
        contractStatus: 'ACTIVE',
        contractStartAt: '2024-03-01',
        contractEndAt: '2027-02-28',
        memberCount: expect.any(Number),
        staffCount: expect.any(Number),
        runningProgramCount: expect.any(Number),
      }),
    ]);
  });
});
