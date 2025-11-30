import { Module } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';
import { PrismaService } from '../common/prisma.service';
import { RolesGuard } from '../users/guards/roles.guard';

@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService, PrismaService, RolesGuard],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}

