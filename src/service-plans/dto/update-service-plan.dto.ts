import { PartialType } from '@nestjs/mapped-types';
import { CreateServicePlanDto } from './create-service-plan.dto';

export class UpdateServicePlanDto extends PartialType(CreateServicePlanDto) {}

