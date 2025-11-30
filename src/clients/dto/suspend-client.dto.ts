import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SuspensionReason } from '@prisma/client';

export class SuspendClientDto {
  @IsEnum(SuspensionReason)
  reason: SuspensionReason;

  @IsOptional()
  @IsString()
  reasonDetails?: string;
}

