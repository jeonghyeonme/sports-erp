import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { MOCK_DEMO_PASSWORD } from '../../src/mock-data/demo-password';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * 실제 서버(main.ts)와 같은 전역 설정으로 앱을 띄운다. main.ts의 bootstrap()은 listen까지 하므로
 * 재사용할 수 없어 설정을 여기에 복제했다 — main.ts의 전역 prefix/pipe/filter를 바꾸면 같이 바꿀 것.
 *
 * D36부터 모든 도메인의 원천이 DB라(MockDataService 제거) 테스트 간 격리는 워커 DB 재생성(resetWorkerDb)이 맡는다.
 * 앱은 여전히 스위트(또는 테스트)마다 새로 띄운다 — 인증 토큰 등 앱 인스턴스 상태를 섞지 않기 위해서다.
 */
export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

/** 모든 도메인의 원천은 DB다(D36) — 테스트의 상태 확인·준비는 여기로 읽고 쓴다. */
export function db(app: INestApplication): PrismaService {
  return app.get(PrismaService);
}

// 시드된 데모 계정 (mock-data.service.ts). 서초점 소속 3명, 강남점 관리자, 본사 관리자.
export const ACCOUNTS = {
  superAdmin: 'jeong.haneul@spoism.example',
  seochoAdmin: 'kim.minsu@spoism.example',
  seochoStaff: 'park.seoyeon@spoism.example',
  seochoMember: 'lee.sujin@example.com',
  gangnamAdmin: 'choi.gangnam@spoism.example',
} as const;

export const BRANCH = { seocho: 'branch-seocho', gangnam: 'branch-gangnam' } as const;

/** 로그인해서 Authorization 헤더 값을 돌려준다. */
export async function login(app: INestApplication, email: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password: MOCK_DEMO_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`로그인 실패(${email}): ${res.status} ${JSON.stringify(res.body)}`);
  }
  return `Bearer ${res.body.data.accessToken}`;
}
