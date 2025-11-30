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
import { RequestStatus } from '@prisma/client';

@Controller('pppoe-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PppoeRequestsController {
  constructor(private readonly pppoeRequestsService: PppoeRequestsService) {}

  @Post()
  @Roles('WSP_ADMIN', 'POS_MANAGER', 'CLIENT')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPppoeRequestDto: CreatePppoeRequestDto, @Request() req) {
    return this.pppoeRequestsService.create(createPppoeRequestDto, req.user);
  }

  @Get()
  @Roles('WSP_ADMIN', 'POS_MANAGER', 'CLIENT')
  findAll(@Query() query: any, @Request() req) {
    return this.pppoeRequestsService.findAll(query, req.user);
  }

  @Get(':id')
  @Roles('WSP_ADMIN', 'POS_MANAGER', 'CLIENT')
  findOne(@Param('id') id: string, @Request() req) {
    return this.pppoeRequestsService.findOne(id, req.user);
  }

  @Patch(':id/approve')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  approve(
    @Param('id') id: string,
    @Body() approvePppoeRequestDto: ApprovePppoeRequestDto,
    @Request() req,
  ) {
    return this.pppoeRequestsService.approve(id, approvePppoeRequestDto, req.user);
  }

  @Patch(':id/reject')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  reject(
    @Param('id') id: string,
    @Body() rejectPppoeRequestDto: RejectPppoeRequestDto,
    @Request() req,
  ) {
    return this.pppoeRequestsService.reject(id, rejectPppoeRequestDto, req.user);
  }

  @Patch(':id/complete')
  @Roles('WSP_ADMIN')
  complete(
    @Param('id') id: string,
    @Body() completePppoeRequestDto: CompletePppoeRequestDto,
    @Request() req,
  ) {
    return this.pppoeRequestsService.complete(id, completePppoeRequestDto, req.user);
  }
}

