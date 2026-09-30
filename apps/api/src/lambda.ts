import { NestFactory } from '@nestjs/core';
import serverlessExpress from '@codegenie/serverless-express';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { timingSafeEqual } from 'crypto';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { secretFromEnv } from './common/config/secrets';
import { PrismaService } from './prisma/prisma.service';

/**
 * AWS Lambda 진입점 — D37(2-1_기술결정사항.md). Function URL(페이로드 2.0) 이벤트를 Nest(Express)로 넘긴다.
 * - Nest 앱은 모듈을 불러올 때(init 단계) 한 번만 만들고, 따뜻한 호출에서 재사용한다(결정 3).
 * - Worker가 붙인 비밀 헤더가 없으면 Nest까지 가지 않고 403 — Function URL 직접 호출로 Worker rate limit을 우회하지 못하게 한다(결정 4).
 * - EventBridge Scheduler의 워밍 이벤트({"warmup":true})는 HTTP 처리 없이 끝내고, 1시간에 한 번 DB에 `SELECT 1`을 보낸다
 *   (Supabase 무료 프로젝트의 7일 비활성 일시정지 방지, 결정 3).
 */

type Proxy = ReturnType<typeof serverlessExpress>;

const ORIGIN_HEADER = 'x-origin-secret';
const DB_PING_INTERVAL_MS = 55 * 60 * 1000;

// 비밀값이 없으면 여기서 던져 init이 실패한다 — 배포 환경에서 조용히 열린 채로 뜨지 않는다.
const originSecret = Buffer.from(secretFromEnv('ORIGIN_SECRET', 'local-origin-secret'));

async function bootstrap(): Promise<{ proxy: Proxy; prisma: PrismaService }> {
  const app = configureApp(await NestFactory.create(AppModule));
  await app.init();
  return { proxy: serverlessExpress({ app: app.getHttpAdapter().getInstance() }), prisma: app.get(PrismaService) };
}

const ready = bootstrap();
// 실패는 첫 호출의 await가 받아서 드러낸다 — 여기서는 처리되지 않은 거부로 프로세스가 먼저 죽지 않게만 한다.
ready.catch(() => undefined);

let lastDbPing = 0;

export type WarmupEvent = { warmup: true };

function isWarmup(event: unknown): event is WarmupEvent {
  return typeof event === 'object' && event !== null && (event as Partial<WarmupEvent>).warmup === true;
}

function originAllowed(headers: APIGatewayProxyEventV2['headers'] | undefined): boolean {
  const given = headers?.[ORIGIN_HEADER];
  if (!given) return false;
  const buf = Buffer.from(given);
  return buf.length === originSecret.length && timingSafeEqual(buf, originSecret);
}

export async function handler(
  event: APIGatewayProxyEventV2 | WarmupEvent,
  context: Context,
): Promise<APIGatewayProxyResultV2 | { warmed: true; dbPinged: boolean }> {
  const { proxy, prisma } = await ready;

  if (isWarmup(event)) {
    const now = Date.now();
    const dbPinged = now - lastDbPing >= DB_PING_INTERVAL_MS;
    if (dbPinged) {
      await prisma.$queryRaw`SELECT 1`;
      lastDbPing = now;
    }
    return { warmed: true, dbPinged };
  }

  if (!originAllowed(event.headers)) {
    return {
      statusCode: 403,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ success: false, error: { code: 'FORBIDDEN_ORIGIN', message: '허용되지 않은 경로의 요청입니다.' } }),
    };
  }

  return proxy(event, context, () => undefined) as Promise<APIGatewayProxyResultV2>;
}
