import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * 전역 설정(prefix·CORS·ValidationPipe·공통 에러 포맷)을 한 곳에 둔다 — D37 결정 5.
 * 서버(main.ts)·Lambda(lambda.ts)·테스트(test/helpers/app.ts)가 모두 이 함수를 불러, 진입점마다 설정이 어긋나지 않게 한다.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api/v1');
  app.enableCors({ credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // 이게 없으면 모든 에러 응답이 00문서 §4 공통 포맷({success:false, error:{code,message}}) 대신 Nest 기본 raw 포맷으로 나간다.
  app.useGlobalFilters(new AllExceptionsFilter());
  return app;
}
