import { Module } from '@nestjs/common';
import { BandwidthPoolService } from './bandwidth-pool.service';
import { BandwidthPoolController } from './bandwidth-pool.controller';
import { PrismaService } from '../common/prisma.service';
import { RolesGuard } from '../users/guards/roles.guard';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [BandwidthPoolController],
  providers: [BandwidthPoolService, PrismaService, RolesGuard],
  exports: [BandwidthPoolService],
})
export class BandwidthPoolModule {}

