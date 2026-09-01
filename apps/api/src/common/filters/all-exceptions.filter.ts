import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AppException } from '../exceptions/app.exception';

/**
 * 모든 예외를 00문서 §4 공통 에러 envelope({success:false, error:{code,message}})으로 변환합니다.
 * - AppException: 지정한 code를 그대로 사용
 * - class-validator(ValidationPipe)의 BadRequestException: code=VALIDATION_ERROR
 * - 그 외 HttpException: code는 HTTP status 이름(예: FORBIDDEN)으로 대체
 * - 알 수 없는 예외: 500 + code=INTERNAL_ERROR (스택은 서버 로그에만 남기고 응답에는 노출하지 않음)
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof AppException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as { code: string; message: string };
      response.status(status).json({ success: false, error: body });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      let code = HttpStatus[status] ?? 'ERROR';
      let message = exception.message;

      if (typeof raw === 'object' && raw !== null) {
        const body = raw as { message?: string | string[] };
        if (Array.isArray(body.message)) {
          code = 'VALIDATION_ERROR';
          message = body.message.join(', ');
        } else if (typeof body.message === 'string') {
          message = body.message;
        }
      }

      response.status(status).json({ success: false, error: { code, message } });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '서버 내부 오류가 발생했습니다.' },
    });
  }
}
