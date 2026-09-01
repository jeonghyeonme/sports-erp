import { IsOptional, IsString } from 'class-validator';

/** PATCH /members/:id — MEMBER 본인은 name/phone만, BRANCH_ADMIN/SUPER_ADMIN은 memo까지 반영(서비스에서 분기) */
export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  memo?: string;
}
