import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class RegisterDeviceDto {
  @IsEnum(NotificationChannel)
  @IsNotEmpty()
  channel: NotificationChannel;

  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsOptional()
  telegramChatId?: string;
}
