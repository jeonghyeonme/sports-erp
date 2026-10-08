import { IsIn } from 'class-validator';
import { AssetStatus } from '../../../fixtures/mock-data.types';

const STATUSES: AssetStatus[] = ['NORMAL', 'REPAIRING', 'DISPOSAL_PENDING', 'DISPOSED'];

export class UpdateAssetStatusDto {
  @IsIn(STATUSES)
  status!: AssetStatus;
}
