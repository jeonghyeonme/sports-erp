import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PostCategory } from '../../../fixtures/mock-data.types';

const CATEGORIES: PostCategory[] = ['NOTICE', 'TRAINING_MATERIAL', 'EVENT', 'OTHER'];

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: PostCategory;
}
