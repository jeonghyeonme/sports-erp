import { IsIn, IsInt, IsString, Min, MinLength } from 'class-validator';
import { FacilityType } from '../../../fixtures/mock-data.types';

const TYPES: FacilityType[] = ['GYM', 'POOL', 'GOLF', 'READING_ROOM', 'ETC'];

export class CreateFacilityDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(TYPES)
  type!: FacilityType;

  // 혼잡도관리 A-6 — capacity=0이면 이용률 계산에서 나눗셈 오류가 나므로 1 이상 필수.
  @IsInt()
  @Min(1)
  capacity!: number;
}
