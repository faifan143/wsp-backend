import { Controller, Get, Param, UseGuards, Request, Query } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Roles } from '../users/decorators/roles.decorator';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { Capabilities } from '../common/decorators/capabilities.decorator';
import { UserRole, Capability } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard, CapabilitiesGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER, UserRole.CLIENT)
  @Capabilities(Capability.AUDIT_LOGS_READ)
  findAll(@Query() query: QueryAuditDto, @Request() req) {
    return this.auditLogsService.findAll(query, req.user);
  }

  @Get(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER, UserRole.CLIENT)
  @Capabilities(Capability.AUDIT_LOGS_READ)
  findOne(@Param('id') id: string, @Request() req) {
    return this.auditLogsService.findOne(id, req.user);
  }
}

