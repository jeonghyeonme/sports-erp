import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, BRANCH, createApp, login, mockData } from './helpers/app';
import { setBranchStatus } from './helpers/branch-status';

/**
 * D29 — 지점의 원천은 DB다. 아직 mock인 도메인은 계약 필드를 뺀 "이름표 사본"을 동기적으로 쓴다.
 * 사본이 DB와 어긋나면 지점명·코드(채번)·체크인 기준 시각(지각 판정)·취소 기준 시간이 조용히 틀어지므로 여기서 잡는다.
 * 어긋나면 시드(prisma/seed.ts)와 mock이 같은 원천(src/mock-data/branch-fixtures.ts)을 쓰는지부터 볼 것.
 */
describe('지점 원천(DB)과 mock 이름표 사본', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('mock 사본의 모든 필드가 DB 지점과 같다(98개)', async () => {
    const rows = await app.get(PrismaService).branch.findMany();
    const db = new Map(rows.map((r) => [r.id, r]));
    const mock = mockData(app).branches;

    expect(mock).toHaveLength(98);
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
    await setBranchStatus(BRANCH.gangnam, 'TERMINATED'); // mock은 건드리지 않는다
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
