import { IsString, IsOptional, IsEnum, IsInt, Min, IsNumber } from 'class-validator';
import { ServiceType, DurationType } from '@prisma/client';

export class CreateServicePlanDto {
  @IsString()
  planName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @IsEnum(DurationType)
  durationType: DurationType;

  @IsInt()
  @Min(1)
  durationDays: number;

  @IsNumber()
  @Min(0)
  cost: number;

  @IsNumber()
  @Min(1)
  downloadSpeedMbps: number;

  @IsNumber()
  @Min(1)
  uploadSpeedMbps: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dataCapacityGb?: number;
}

