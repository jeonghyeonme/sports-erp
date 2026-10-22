import { IsString } from 'class-validator';
import { IsNewPassword } from '../../../common/validation/password-policy';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsNewPassword()
  newPassword!: string;
}
