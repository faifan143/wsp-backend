import { Controller, Get, Param, UseGuards, Request, Query } from '@nestjs/common';
import { SuspensionHistoryService } from './suspension-history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Roles } from '../users/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suspension-history')
export class SuspensionHistoryController {
  constructor(private readonly suspensionHistoryService: SuspensionHistoryService) {}

  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER, UserRole.CLIENT)
  findAll(@Query() query: any, @Request() req) {
    return this.suspensionHistoryService.findAll(query, req.user);
  }

  @Get(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER, UserRole.CLIENT)
  findOne(@Param('id') id: string, @Request() req) {
    return this.suspensionHistoryService.findOne(id, req.user);
  }
}

