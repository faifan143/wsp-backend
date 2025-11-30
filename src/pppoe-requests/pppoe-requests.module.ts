import { Module } from '@nestjs/common';
import { PppoeRequestsService } from './pppoe-requests.service';
import { PppoeRequestsController } from './pppoe-requests.controller';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [PppoeRequestsController],
  providers: [PppoeRequestsService, PrismaService],
  exports: [PppoeRequestsService],
})
export class PppoeRequestsModule {}

