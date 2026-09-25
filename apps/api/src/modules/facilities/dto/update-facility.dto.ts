import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
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

  // ADR-FAC-02 — 운영 중단/재개를 표시. false로 보내면 비활성화(목록 기본 노출에서 제외), true로 되돌리면 재활성화.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
