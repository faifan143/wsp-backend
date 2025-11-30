import { Module } from '@nestjs/common';
import { PosService } from './pos.service';
import { PosController } from './pos.controller';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [PosController],
  providers: [PosService, PrismaService],
  exports: [PosService],
})
export class PosModule {}

