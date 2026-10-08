import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { MOCK_DEMO_PASSWORD } from '../src/fixtures/demo-password';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp } from './helpers/app';

/**
 * D27 — Account.email이 전역 unique에서 "활성 계정끼리만 unique"(ADR-MEM-02 부분 인덱스)로 바뀌면서
 * 같은 이메일의 탈퇴 계정과 재가입 계정이 Prisma에 공존할 수 있게 됐다. 로그인(findFirst)이
 * ① 둘이 공존하면 활성 계정을 고르고 ② 비활성 계정뿐이면 mock 폴백으로 새지 않고 ACCOUNT_INACTIVE로
 * 거부하는지 고정한다. 실제 DB(Prisma) 경로를 타므로 테스트용 계정은 afterAll에서 지운다.
 */
describe('D27 로그인 — 같은 이메일의 탈퇴·재가입 계정 공존', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const REUSED = 'd27.reuse@example.com';
  const ONLY_INACTIVE = 'd27.inactive@example.com';
  const IDS = ['d27-withdrawn', 'd27-rejoined', 'd27-only-inactive'];

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    await prisma.account.deleteMany({ where: { id: { in: IDS } } });
    const passwordHash = await bcrypt.hash(MOCK_DEMO_PASSWORD, 10);
    await prisma.account.createMany({
      data: [
        { id: 'd27-withdrawn', email: REUSED, passwordHash, role: 'MEMBER', name: '탈퇴', isActive: false },
        { id: 'd27-rejoined', email: REUSED, passwordHash, role: 'MEMBER', name: '재가입' },
        { id: 'd27-only-inactive', email: ONLY_INACTIVE, passwordHash, role: 'MEMBER', name: '비활성', isActive: false },
      ],
    });
  });

  afterAll(async () => {
    await prisma.account.deleteMany({ where: { id: { in: IDS } } });
    await app.close();
  });

  it('탈퇴 계정과 재가입 계정이 같은 이메일로 공존하면 활성(재가입) 계정으로 로그인된다', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: REUSED, password: MOCK_DEMO_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.accountId).toBe('d27-rejoined');
  });

  it('비활성 계정뿐이면 ACCOUNT_INACTIVE(401) — mock 폴백의 INVALID_CREDENTIALS로 새지 않는다', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ONLY_INACTIVE, password: MOCK_DEMO_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  it('DB가 활성 계정끼리의 이메일 중복을 거부한다(부분 unique 인덱스)', async () => {
    await expect(
      prisma.account.create({
        data: { email: REUSED, passwordHash: 'x', role: 'MEMBER', name: '중복' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
