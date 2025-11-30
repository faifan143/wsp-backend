import { Module } from '@nestjs/common';
import { ServicePlansService } from './service-plans.service';
import { ServicePlansController } from './service-plans.controller';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [ServicePlansController],
  providers: [ServicePlansService, PrismaService],
  exports: [ServicePlansService],
})
export class ServicePlansModule {}

