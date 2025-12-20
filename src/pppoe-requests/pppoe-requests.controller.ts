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
import { PppoeRequestsService } from './pppoe-requests.service';
import { CreatePppoeRequestDto } from './dto/create-pppoe-request.dto';
import { ApprovePppoeRequestDto } from './dto/approve-pppoe-request.dto';
import { RejectPppoeRequestDto } from './dto/reject-pppoe-request.dto';
import { CompletePppoeRequestDto } from './dto/complete-pppoe-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Roles } from '../users/decorators/roles.decorator';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { Capabilities } from '../common/decorators/capabilities.decorator';
import { RequestStatus, Capability, UserRole } from '@prisma/client';

@Controller('pppoe-requests')
@UseGuards(JwtAuthGuard, RolesGuard, CapabilitiesGuard)
export class PppoeRequestsController {
  constructor(private readonly pppoeRequestsService: PppoeRequestsService) {}

  @Post()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER, UserRole.CLIENT)
  @Capabilities(Capability.PPPOE_REQUESTS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPppoeRequestDto: CreatePppoeRequestDto, @Request() req) {
    return this.pppoeRequestsService.create(createPppoeRequestDto, req.user);
  }

  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER, UserRole.CLIENT)
  @Capabilities(Capability.PPPOE_REQUESTS_READ)
  findAll(@Query() query: any, @Request() req) {
    return this.pppoeRequestsService.findAll(query, req.user);
  }

  @Get(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER, UserRole.CLIENT)
  @Capabilities(Capability.PPPOE_REQUESTS_READ)
  findOne(@Param('id') id: string, @Request() req) {
    return this.pppoeRequestsService.findOne(id, req.user);
  }

  @Patch(':id/approve')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.PPPOE_REQUESTS_APPROVE)
  approve(
    @Param('id') id: string,
    @Body() approvePppoeRequestDto: ApprovePppoeRequestDto,
    @Request() req,
  ) {
    return this.pppoeRequestsService.approve(id, approvePppoeRequestDto, req.user);
  }

  @Patch(':id/reject')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.PPPOE_REQUESTS_REJECT)
  reject(
    @Param('id') id: string,
    @Body() rejectPppoeRequestDto: RejectPppoeRequestDto,
    @Request() req,
  ) {
    return this.pppoeRequestsService.reject(id, rejectPppoeRequestDto, req.user);
  }

  @Patch(':id/complete')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.PPPOE_REQUESTS_APPROVE)
  complete(
    @Param('id') id: string,
    @Body() completePppoeRequestDto: CompletePppoeRequestDto,
    @Request() req,
  ) {
    return this.pppoeRequestsService.complete(id, completePppoeRequestDto, req.user);
  }
}

