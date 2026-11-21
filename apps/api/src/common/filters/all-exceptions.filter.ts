import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception';

/**
 * JSON 본문 파싱 실패 — Nest가 body-parser의 SyntaxError를 `new BadRequestException(파서 메시지)`로 바꿔 넘긴다.
 * 이 저장소의 코드는 BadRequestException을 직접 던지지 않으므로(AppException·ValidationPipe만 쓴다), JSON 요청에서
 * 문자열 메시지에 "JSON"이 든 BadRequestException은 파서 오류다. 파서 문구(오류 위치 등)는 응답에 내보내지 않는다.
 */
function isJsonParseError(exception: HttpException, request: Request): boolean {
  const raw = exception.getResponse() as { message?: unknown };
  return (
    exception instanceof BadRequestException &&
    typeof raw?.message === 'string' &&
    /JSON/.test(raw.message) &&
    (request.headers['content-type'] ?? '').includes('json')
  );
}

/**
 * 모든 예외를 architecture/system-overview.md §4 공통 에러 envelope({success:false, error:{code,message}})으로 변환합니다.
 * - AppException: 지정한 code를 그대로 사용
 * - JSON 본문 파싱 실패: code=INVALID_JSON, 고정 문구(파서 상세는 숨김)
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

    if (exception instanceof HttpException && isJsonParseError(exception, ctx.getRequest<Request>())) {
      response.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: { code: 'INVALID_JSON', message: '요청 본문(JSON) 형식이 올바르지 않습니다.' },
      });
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
