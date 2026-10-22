import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// 새로 정하는 비밀번호의 규칙 — 8~72자, 영문과 숫자를 각각 하나 이상(개발보안 점검표 보안-9, log/164).
// 72자 상한은 bcrypt가 72바이트 뒤를 버리기 때문이다. 로그인은 이 규칙을 보지 않는다(기존 비밀번호는 그대로 쓴다).
// 두 웹의 같은 규칙: admin-web·member-web `lib/password-rule.ts`.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
const MESSAGE = `비밀번호는 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자이고 영문과 숫자를 모두 포함해야 합니다.`;

export function IsNewPassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH, { message: MESSAGE }),
    MaxLength(PASSWORD_MAX_LENGTH, { message: MESSAGE }),
    Matches(/[A-Za-z]/, { message: MESSAGE }),
    Matches(/[0-9]/, { message: MESSAGE }),
  );
}
