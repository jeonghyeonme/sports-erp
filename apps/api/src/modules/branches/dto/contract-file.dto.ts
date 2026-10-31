import { ContractFileKind } from '@prisma/client';
import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

// D69 — 계약 파일은 브라우저가 저장소에 먼저 올리고(업로드 URL은 RequestUploadDto, 게시판 첨부와 같은 한도 D57),
// 갱신·지점 등록·파일 올리기 요청에 그 경로를 싣는다. 서버가 저장소에서 크기·형식을 다시 확인한다.
export class ContractFileRefDto {
  @IsString()
  @Matches(/^contracts\/[0-9a-f-]{36}\.[a-z0-9]+$/, { message: '잘못된 계약 파일 경로입니다.' })
  path!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName!: string;
}

// 진행 중인 회차에 계약서를 올리거나 바꾸고, 종료 확정 전에 해지 합의서를 올린다(D69 결정 4·5).
export class SetContractFileDto extends ContractFileRefDto {
  @IsIn(['CONTRACT', 'TERMINATION_AGREEMENT'])
  kind!: ContractFileKind;
}
