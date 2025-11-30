import { IsString, IsOptional } from 'class-validator';

export class RejectPppoeRequestDto {
  @IsString()
  rejectionReason: string;

  @IsOptional()
  @IsString()
  note?: string;
}

