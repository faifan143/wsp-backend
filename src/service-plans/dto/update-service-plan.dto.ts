import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsBoolean } from 'class-validator';
import { CreateServicePlanDto } from './create-service-plan.dto';

export class UpdateServicePlanDto extends PartialType(CreateServicePlanDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

