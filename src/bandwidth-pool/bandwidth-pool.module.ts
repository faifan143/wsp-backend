import { Module } from '@nestjs/common';
import { BandwidthPoolService } from './bandwidth-pool.service';
import { BandwidthPoolController } from './bandwidth-pool.controller';
import { PrismaService } from '../common/prisma.service';
import { RolesGuard } from '../users/guards/roles.guard';

@Module({
  controllers: [BandwidthPoolController],
  providers: [BandwidthPoolService, PrismaService, RolesGuard],
  exports: [BandwidthPoolService],
})
export class BandwidthPoolModule {}

