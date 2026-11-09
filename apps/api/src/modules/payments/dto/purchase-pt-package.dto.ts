import { IsString, MinLength } from 'class-validator';

// 예약및결제 ADR-RSV-09 — 회원 앱 PT 패키지 구매. 금액·횟수는 서버가 프로그램에서 정한다(클라이언트 값 받지 않음).
export class PurchasePTPackageDto {
  @IsString()
  @MinLength(1)
  programId!: string;
}
