import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// 로그인처럼 인증 없이 열어야 하는 라우트에 붙입니다. JwtAuthGuard가 이 메타데이터를 확인합니다.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
