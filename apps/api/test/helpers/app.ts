import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { MOCK_DEMO_PASSWORD } from '../../src/fixtures/demo-password';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * 실제 서버(main.ts)·Lambda(lambda.ts)와 같은 전역 설정으로 앱을 띄운다 — 셋 다 configureApp()을 부른다(D37 결정 5).
 *
 * D36부터 모든 도메인의 원천이 DB라(MockDataService 제거) 테스트 간 격리는 워커 DB 재생성(resetWorkerDb)이 맡는다.
 * 앱은 여전히 스위트(또는 테스트)마다 새로 띄운다 — 인증 토큰 등 앱 인스턴스 상태를 섞지 않기 위해서다.
 */
export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication());
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
