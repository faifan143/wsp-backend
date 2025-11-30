import { IsUUID, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class CreateSubscriptionDto {
  @IsUUID()
  clientId: string;

  @IsUUID()
  planId: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsBoolean()
  isAutoRenewed?: boolean;
}

