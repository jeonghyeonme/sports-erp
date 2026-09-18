import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { FacilityType } from '../../../mock-data/mock-data.types';

const TYPES: FacilityType[] = ['GYM', 'POOL', 'GOLF', 'READING_ROOM', 'ETC'];

export class UpdateFacilityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(TYPES)
  type?: FacilityType;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}
