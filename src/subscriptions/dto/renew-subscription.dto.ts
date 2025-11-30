import { IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class RenewSubscriptionDto {
  @IsOptional()
  @IsDateString()
  renewalDate?: string;

  @IsOptional()
  @IsBoolean()
  isAutoRenewed?: boolean;
}

