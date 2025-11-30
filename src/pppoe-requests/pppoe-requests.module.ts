import { Module } from '@nestjs/common';
import { PppoeRequestsService } from './pppoe-requests.service';
import { PppoeRequestsController } from './pppoe-requests.controller';
import { PrismaService } from '../common/prisma.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [PppoeRequestsController],
  providers: [PppoeRequestsService, PrismaService],
  exports: [PppoeRequestsService],
})
export class PppoeRequestsModule {}

