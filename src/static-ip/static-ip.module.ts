import { Module } from '@nestjs/common';
import { StaticIpService } from './static-ip.service';
import { StaticIpController } from './static-ip.controller';
import { PrismaService } from '../common/prisma.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [StaticIpController],
  providers: [StaticIpService, PrismaService],
  exports: [StaticIpService],
})
export class StaticIpModule {}

