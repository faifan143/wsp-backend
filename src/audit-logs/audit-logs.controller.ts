import { Controller, Get, Param, UseGuards, Request, Query } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Roles } from '../users/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER, UserRole.CLIENT)
  findAll(@Query() query: QueryAuditDto, @Request() req) {
    return this.auditLogsService.findAll(query, req.user);
  }

  @Get(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER, UserRole.CLIENT)
  findOne(@Param('id') id: string, @Request() req) {
    return this.auditLogsService.findOne(id, req.user);
  }
}

