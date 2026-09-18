import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
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
}
