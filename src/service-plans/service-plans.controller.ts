import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ServicePlansService } from './service-plans.service';
import { CreateServicePlanDto } from './dto/create-service-plan.dto';
import { UpdateServicePlanDto } from './dto/update-service-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Roles } from '../users/decorators/roles.decorator';
import { ServiceType } from '@prisma/client';

@Controller('service-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServicePlansController {
  constructor(private readonly servicePlansService: ServicePlansService) {}

  @Post()
  @Roles('WSP_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createServicePlanDto: CreateServicePlanDto) {
    return this.servicePlansService.create(createServicePlanDto);
  }

  @Get()
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  findAll(
    @Query('isActive') isActive?: string,
    @Query('serviceType') serviceType?: ServiceType,
  ) {
    const isActiveFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.servicePlansService.findAll(isActiveFilter, serviceType);
  }

  @Get(':id')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  findOne(@Param('id') id: string) {
    return this.servicePlansService.findOne(id);
  }

  @Patch(':id')
  @Roles('WSP_ADMIN')
  update(@Param('id') id: string, @Body() updateServicePlanDto: UpdateServicePlanDto) {
    return this.servicePlansService.update(id, updateServicePlanDto);
  }

  @Patch(':id/activate')
  @Roles('WSP_ADMIN')
  activate(@Param('id') id: string) {
    return this.servicePlansService.activate(id);
  }

  @Patch(':id/deactivate')
  @Roles('WSP_ADMIN')
  deactivate(@Param('id') id: string) {
    return this.servicePlansService.deactivate(id);
  }
}

