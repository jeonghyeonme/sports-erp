import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * SUPER_ADMIN이 지점 관리자/직원 계정을 발급합니다.
 * Account(role)와 Staff(소속 지점)는 1:1(00문서 §2 ERD)이므로 두 레코드를 트랜잭션으로 함께 만듭니다.
 * SUPER_ADMIN 계정 자체는 이 API로 만들 수 없습니다 — 최상위 권한 발급 경로를 API로 열어두지
 * 않는다는 보안 판단이며, 신규 SUPER_ADMIN이 필요하면 시드/DB 직접 조작으로 처리합니다.
 */
export class CreateAccountDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(['BRANCH_ADMIN', 'STAFF'])
  role!: 'BRANCH_ADMIN' | 'STAFF';

  @IsString()
  branchId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  position?: string;
}
