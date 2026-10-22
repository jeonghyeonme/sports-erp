import { IsEmail, IsString, MinLength } from 'class-validator';
import { IsNewPassword } from '../../../common/validation/password-policy';

// ADR-MEM-01 — 오프라인↔앱 연동. memberNo+phone으로 본인을 증명하고 새 앱 계정(email+password)을 만든다.
export class LinkMemberDto {
  @IsString()
  @MinLength(1)
  memberNo!: string;

  @IsString()
  @MinLength(1)
  phone!: string;

  @IsEmail()
  email!: string;

  @IsNewPassword()
  password!: string;
}
