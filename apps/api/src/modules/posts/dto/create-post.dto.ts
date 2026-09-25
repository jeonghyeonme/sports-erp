import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PostCategory } from '../../../mock-data/mock-data.types';

const CATEGORIES: PostCategory[] = ['NOTICE', 'TRAINING_MATERIAL', 'EVENT', 'OTHER'];

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsIn(CATEGORIES)
  category!: PostCategory;

  // SUPER_ADMIN만 사용 — 특정 지점 대상 공지. 비우면 전체공지(branchId=null).
  @IsOptional()
  @IsString()
  branchId?: string;

  // ADR-BRD-01, SUPER_ADMIN(HQ_TO_BRANCH)만 의미 있음 — 미지정 시 기본 false.
  // BRANCH_ADMIN이 보내도 서비스가 무시한다(BRANCH_TO_MEMBER는 항상 회원에게 노출).
  @IsOptional()
  @IsBoolean()
  visibleToMember?: boolean;
}
