import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Roles } from '../users/decorators/roles.decorator';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { Capabilities } from '../common/decorators/capabilities.decorator';
import { UserRole, Capability } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard, CapabilitiesGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.USERS_READ)
  @HttpCode(HttpStatus.CREATED)
  async sendNotification(@Body() dto: SendNotificationDto) {
    return this.notificationsService.sendNotification(dto);
  }

  @Post('payment-warning/:clientId')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async sendPaymentWarning(
    @Param('clientId') clientId: string,
    @Query('invoiceId') invoiceId: string,
    @Query('amount') amount: string,
    @Query('dueDate') dueDate: string,
  ) {
    return this.notificationsService.sendPaymentWarning(
      clientId,
      invoiceId,
      parseFloat(amount),
      new Date(dueDate),
    );
  }

  @Post('bandwidth-warning/:posId')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async sendBandwidthWarning(@Param('posId') posId: string, @Query('usagePercentage') usagePercentage?: string) {
    if (usagePercentage) {
      return this.notificationsService.sendBandwidthWarning(posId, parseFloat(usagePercentage));
    }
    const pos = await this.prisma.pOS.findUnique({
      where: { id: posId },
    });
    if (!pos) {
      throw new BadRequestException('POS not found');
    }
    const calculatedUsage =
      (pos.currentUsageMbps.toNumber() / pos.allocatedBandwidthMbps.toNumber()) * 100;
    return this.notificationsService.sendBandwidthWarning(posId, calculatedUsage);
  }

  @Post('alert')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async sendAlert(
    @Body() body: { title: string; message: string; recipientId?: string; metadata?: any },
  ) {
    return this.notificationsService.sendAlert(
      body.title,
      body.message,
      body.recipientId,
      body.metadata,
    );
  }

  @Get('me')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER, UserRole.CLIENT)
  async getMyNotifications(@Request() req, @Query('limit') limit?: string) {
    return this.notificationsService.getUserNotifications(
      req.user.id,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post('register-device')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER, UserRole.CLIENT)
  @HttpCode(HttpStatus.OK)
  async registerDevice(@Body() dto: { channel: string; token: string; telegramChatId?: string }, @Request() req) {
    const updateData: any = {};

    if (dto.channel === 'FIREBASE' && dto.token) {
      updateData.firebaseToken = dto.token;
    } else if (dto.channel === 'TELEGRAM' && (dto.token || dto.telegramChatId)) {
      updateData.telegramChatId = dto.telegramChatId || dto.token;
    } else {
      throw new BadRequestException('Invalid channel or token');
    }

    await this.prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
    });

    return { message: 'Device registered successfully' };
  }

  @Post('check-payment-warnings')
  @Roles(UserRole.WSP_ADMIN)
  @HttpCode(HttpStatus.OK)
  async checkPaymentWarnings(@Query('daysBeforeDue') daysBeforeDue?: string) {
    return this.notificationsService.checkAndSendPaymentWarnings(
      daysBeforeDue ? parseInt(daysBeforeDue, 10) : 7,
    );
  }

  @Post('check-bandwidth-warnings')
  @Roles(UserRole.WSP_ADMIN)
  @HttpCode(HttpStatus.OK)
  async checkBandwidthWarnings(@Query('threshold') threshold?: string) {
    return this.notificationsService.checkAndSendBandwidthWarnings(
      threshold ? parseFloat(threshold) : 80,
    );
  }
}
