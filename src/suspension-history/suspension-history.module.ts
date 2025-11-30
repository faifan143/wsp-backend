import { Module } from '@nestjs/common';
import { SuspensionHistoryService } from './suspension-history.service';
import { SuspensionHistoryController } from './suspension-history.controller';
import { PrismaService } from '../common/prisma.service';
import { RolesGuard } from '../users/guards/roles.guard';

@Module({
  controllers: [SuspensionHistoryController],
  providers: [SuspensionHistoryService, PrismaService, RolesGuard],
  exports: [SuspensionHistoryService],
})
export class SuspensionHistoryModule {}

