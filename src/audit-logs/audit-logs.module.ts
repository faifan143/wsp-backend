import { Module, forwardRef } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLoggerService } from './audit-logger.service';
import { PrismaService } from '../common/prisma.service';
import { RolesGuard } from '../users/guards/roles.guard';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [forwardRef(() => SettingsModule)],
  controllers: [AuditLogsController],
  providers: [AuditLogsService, AuditLoggerService, PrismaService, RolesGuard],
  exports: [AuditLoggerService],
})
export class AuditLogsModule {}

