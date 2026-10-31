import { Type } from 'class-transformer';
import { IsDateString, IsDefined, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { ContractFileRefDto } from './contract-file.dto';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// D69 결정 3 — 갱신 = 새 회차. 새 계약서가 있어야 하고, 상대방·기간은 계약서를 보고 직접 넣는다(종료일 필수).
export class RenewContractDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  contractPartner!: string;

  @Matches(DATE_ONLY, { message: '날짜는 YYYY-MM-DD 형식입니다.' })
  @IsDateString({ strict: true })
  contractStartAt!: string;

  @Matches(DATE_ONLY, { message: '날짜는 YYYY-MM-DD 형식입니다.' })
  @IsDateString({ strict: true })
  contractEndAt!: string;

  @IsDefined({ message: '갱신하려면 새 계약서를 올려야 합니다.' })
  @ValidateNested()
  @Type(() => ContractFileRefDto)
  contractFile!: ContractFileRefDto;
}
