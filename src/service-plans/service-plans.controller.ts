import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ServicePlansService } from './service-plans.service';
import { CreateServicePlanDto } from './dto/create-service-plan.dto';
import { UpdateServicePlanDto } from './dto/update-service-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Roles } from '../users/decorators/roles.decorator';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { Capabilities } from '../common/decorators/capabilities.decorator';
import { ServiceType, Capability, UserRole } from '@prisma/client';

@Controller('service-plans')
@UseGuards(JwtAuthGuard, RolesGuard, CapabilitiesGuard)
export class ServicePlansController {
  constructor(private readonly servicePlansService: ServicePlansService) {}

  @Post()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.SERVICE_PLANS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createServicePlanDto: CreateServicePlanDto, @Request() req) {
    return this.servicePlansService.create(createServicePlanDto, req.user);
  }

  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.SERVICE_PLANS_READ)
  findAll(
    @Query('isActive') isActive?: string,
    @Query('serviceType') serviceType?: ServiceType,
  ) {
    const isActiveFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.servicePlansService.findAll(isActiveFilter, serviceType);
  }

  @Get(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.SERVICE_PLANS_READ)
  findOne(@Param('id') id: string) {
    return this.servicePlansService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.SERVICE_PLANS_UPDATE)
  update(@Param('id') id: string, @Body() updateServicePlanDto: UpdateServicePlanDto, @Request() req) {
    return this.servicePlansService.update(id, updateServicePlanDto, req.user);
  }

  @Patch(':id/activate')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.SERVICE_PLANS_UPDATE)
  activate(@Param('id') id: string, @Request() req) {
    return this.servicePlansService.activate(id, req.user);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.SERVICE_PLANS_UPDATE)
  deactivate(@Param('id') id: string, @Request() req) {
    return this.servicePlansService.deactivate(id, req.user);
  }
}

