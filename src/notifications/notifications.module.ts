import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { TelegramService } from './telegram.service';
import { FirebaseService } from './firebase.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [ConfigModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, TelegramService, FirebaseService, PrismaService],
  exports: [NotificationsService, TelegramService, FirebaseService],
})
export class NotificationsModule {}
