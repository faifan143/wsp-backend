import { Module } from '@nestjs/common';
import { StaticIpService } from './static-ip.service';
import { StaticIpController } from './static-ip.controller';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [StaticIpController],
  providers: [StaticIpService, PrismaService],
  exports: [StaticIpService],
})
export class StaticIpModule {}

