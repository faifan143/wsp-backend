import { IsUUID, IsOptional, IsDateString } from 'class-validator';

export class UpgradeSubscriptionDto {
  @IsUUID()
  newPlanId: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}

