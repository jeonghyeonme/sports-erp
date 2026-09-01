import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 00문서 §4 공통 에러 포맷({success:false, error:{code,message}})을 위한 커스텀 예외.
 * 컨트롤러/서비스에서는 이 예외를 던지면 AllExceptionsFilter가 일관된 응답으로 변환합니다.
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, status);
  }
}
