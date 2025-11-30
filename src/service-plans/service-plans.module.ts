import { Module } from '@nestjs/common';
import { ServicePlansService } from './service-plans.service';
import { ServicePlansController } from './service-plans.controller';
import { PrismaService } from '../common/prisma.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [ServicePlansController],
  providers: [ServicePlansService, PrismaService],
  exports: [ServicePlansService],
})
export class ServicePlansModule {}

