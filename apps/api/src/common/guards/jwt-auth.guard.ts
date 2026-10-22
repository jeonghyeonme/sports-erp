import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_DURING_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator';
import { AppException } from '../exceptions/app.exception';
import { RequestUser } from '../interfaces/request-user.interface';

// 모든 요청의 JWT를 검증하고 req.user를 주입한다 (architecture/system-overview.md §3.3). AppModule에 APP_GUARD로 전역 등록.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (!(await super.canActivate(context))) return false;
    // 보안-6(log/164) — 채용 때 받은 임시 비밀번호를 바꾸기 전에는 내 정보·비밀번호 변경만 연다(서버가 판정, 화면은 안내).
    const user = context.switchToHttp().getRequest<{ user?: RequestUser }>().user;
    if (user?.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(ALLOW_DURING_PASSWORD_CHANGE_KEY, targets)) {
      throw new AppException('PASSWORD_CHANGE_REQUIRED', '임시 비밀번호를 먼저 바꿔야 합니다.', 403);
    }
    return true;
  }
}
