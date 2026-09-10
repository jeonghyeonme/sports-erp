import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

// PATCH /members/:id 바디. MEMBER 본인은 name/phone/birthDate/gender만 허용되고
// assignedStaffId/memo는 컨트롤러에서 role 검사 후 걸러진다(05문서 §7).
export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  assignedStaffId?: string;

  @IsOptional()
  @IsString()
  memo?: string;
}
