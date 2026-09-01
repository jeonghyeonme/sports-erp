import { IsDateString, IsOptional, IsString } from 'class-validator';

/** POST /members — BRANCH_ADMIN의 현장(오프라인) 등록. Account 없이 Member만 생성 */
export class CreateMemberDto {
  @IsOptional()
  @IsString()
  // BranchScopeGuard가 본인 지점 값으로 덮어씁니다 — 서비스는 이 값을 신뢰하지 않고
  // actor.branchId를 사용합니다. whitelist 검증 통과를 위해 필드만 선언해둡니다.
  branchId?: string;

  @IsString()
  name!: string;

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
  memo?: string;
}
