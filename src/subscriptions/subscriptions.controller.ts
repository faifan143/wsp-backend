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
import { SubscriptionStatus } from '@prisma/client';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createSubscriptionDto: CreateSubscriptionDto, @Request() req) {
    return this.subscriptionsService.create(createSubscriptionDto, req.user);
  }

  @Get()
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  findAll(@Query() query: any, @Request() req) {
    return this.subscriptionsService.findAll(query, req.user);
  }

  @Get(':id')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  findOne(@Param('id') id: string, @Request() req) {
    return this.subscriptionsService.findOne(id, req.user);
  }

  @Patch(':id/terminate')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  terminate(@Param('id') id: string, @Request() req) {
    return this.subscriptionsService.terminate(id, req.user);
  }

  @Post(':id/renew')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  @HttpCode(HttpStatus.OK)
  renew(@Param('id') id: string, @Body() renewSubscriptionDto: RenewSubscriptionDto, @Request() req) {
    return this.subscriptionsService.renew(id, renewSubscriptionDto, req.user);
  }

  @Post(':id/upgrade')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  @HttpCode(HttpStatus.OK)
  upgrade(
    @Param('id') id: string,
    @Body() upgradeSubscriptionDto: UpgradeSubscriptionDto,
    @Request() req,
  ) {
    return this.subscriptionsService.upgrade(id, upgradeSubscriptionDto, req.user);
  }

  @Post(':id/usage-log')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  @HttpCode(HttpStatus.CREATED)
  createUsageLog(
    @Param('id') id: string,
    @Body() createUsageLogDto: CreateUsageLogDto,
    @Request() req,
  ) {
    return this.subscriptionsService.createUsageLog(id, createUsageLogDto, req.user);
  }

  @Get(':id/usage-log')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  getUsageLogs(@Param('id') id: string, @Request() req) {
    return this.subscriptionsService.getUsageLogs(id, req.user);
  }
}

