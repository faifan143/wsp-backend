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
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { CreateUsageLogDto } from './dto/create-usage-log.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Roles } from '../users/decorators/roles.decorator';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { Capabilities } from '../common/decorators/capabilities.decorator';
import { SubscriptionStatus, Capability, UserRole } from '@prisma/client';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard, CapabilitiesGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.SUBSCRIPTIONS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createSubscriptionDto: CreateSubscriptionDto, @Request() req) {
    return this.subscriptionsService.create(createSubscriptionDto, req.user);
  }

  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.SUBSCRIPTIONS_READ)
  findAll(@Query() query: any, @Request() req) {
    return this.subscriptionsService.findAll(query, req.user);
  }

  @Get(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.SUBSCRIPTIONS_READ)
  findOne(@Param('id') id: string, @Request() req) {
    return this.subscriptionsService.findOne(id, req.user);
  }

  @Patch(':id/terminate')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.SUBSCRIPTIONS_TERMINATE)
  terminate(@Param('id') id: string, @Request() req) {
    return this.subscriptionsService.terminate(id, req.user);
  }

  @Post(':id/renew')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.SUBSCRIPTIONS_RENEW)
  @HttpCode(HttpStatus.OK)
  renew(@Param('id') id: string, @Body() renewSubscriptionDto: RenewSubscriptionDto, @Request() req) {
    return this.subscriptionsService.renew(id, renewSubscriptionDto, req.user);
  }

  @Post(':id/upgrade')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.SUBSCRIPTIONS_UPGRADE)
  @HttpCode(HttpStatus.OK)
  upgrade(
    @Param('id') id: string,
    @Body() upgradeSubscriptionDto: UpgradeSubscriptionDto,
    @Request() req,
  ) {
    return this.subscriptionsService.upgrade(id, upgradeSubscriptionDto, req.user);
  }

  @Post(':id/usage-log')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.USAGE_LOGS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  createUsageLog(
    @Param('id') id: string,
    @Body() createUsageLogDto: CreateUsageLogDto,
    @Request() req,
  ) {
    return this.subscriptionsService.createUsageLog(id, createUsageLogDto, req.user);
  }

  @Get(':id/usage-log')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.USAGE_LOGS_READ)
  getUsageLogs(@Param('id') id: string, @Request() req) {
    return this.subscriptionsService.getUsageLogs(id, req.user);
  }
}

