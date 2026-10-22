import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * 전역 설정(prefix·CORS·ValidationPipe·공통 에러 포맷)을 한 곳에 둔다 — D37 결정 5.
 * 서버(main.ts)·Lambda(lambda.ts)·테스트(test/helpers/app.ts)가 모두 이 함수를 불러, 진입점마다 설정이 어긋나지 않게 한다.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api/v1');
  // log/166 — NestJS 11은 Express 5 위에서 돈다. Express 5는 (1) 쿼리 파서 기본값이 "simple"이고 (2) req.query를
  // 읽을 때마다 새로 만드는 getter라 값을 써 넣어도 사라진다. BranchScopeGuard가 지점 관리자의 branchId를
  // req.query에 넣어 서비스가 거르게 하는데(D46), 이 주입이 사라져 남의 지점 목록이 보였다(branch-isolation 실패로 발견).
  // Express 4와 같은 파서를 쓰고, 요청마다 한 번 읽은 쿼리를 쓸 수 있는 보통 속성으로 고정한다.
  (app as unknown as NestExpressApplication).set('query parser', 'extended');
  app.use((req: Request, _res: Response, next: NextFunction) => {
    Object.defineProperty(req, 'query', { value: { ...req.query }, writable: true, configurable: true, enumerable: true });
    next();
  });
  app.enableCors({ credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // 이게 없으면 모든 에러 응답이 architecture/system-overview.md §4 공통 포맷({success:false, error:{code,message}}) 대신 Nest 기본 raw 포맷으로 나간다.
  app.useGlobalFilters(new AllExceptionsFilter());
  return app;
}
