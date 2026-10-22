import { SetMetadata } from '@nestjs/common';

export const ALLOW_DURING_PASSWORD_CHANGE_KEY = 'allowDuringPasswordChange';

// 보안-6(log/164) — 임시 비밀번호 상태(mustChangePassword)인 계정도 부를 수 있는 라우트(내 정보·비밀번호 변경).
// 나머지 인증 라우트는 JwtAuthGuard가 403 PASSWORD_CHANGE_REQUIRED로 막는다. 로그인·갱신·로그아웃은 @Public이라 해당 없음.
export const AllowDuringPasswordChange = () => SetMetadata(ALLOW_DURING_PASSWORD_CHANGE_KEY, true);
