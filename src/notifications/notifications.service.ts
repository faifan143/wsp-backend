import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TelegramService } from './telegram.service';
import { FirebaseService } from './firebase.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import {
  NotificationType,
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
    private firebaseService: FirebaseService,
  ) {}

  async sendNotification(dto: SendNotificationDto) {
    const channel = dto.channel || NotificationChannel.BOTH;
    let telegramSuccess = false;
    let firebaseSuccess = false;

    if (channel === NotificationChannel.TELEGRAM || channel === NotificationChannel.BOTH) {
      if (!dto.telegramChatId) {
        throw new BadRequestException('telegramChatId is required for Telegram notifications');
      }
      telegramSuccess = await this.telegramService.sendNotification(
        dto.telegramChatId,
        dto.title,
        dto.message,
      );
    }

    if (channel === NotificationChannel.FIREBASE || channel === NotificationChannel.BOTH) {
      if (!dto.firebaseToken) {
        throw new BadRequestException('firebaseToken is required for Firebase notifications');
      }
      firebaseSuccess = await this.firebaseService.sendNotification(
        dto.firebaseToken,
        dto.title,
        dto.message,
        dto.metadata,
      );
    }

    const status =
      (telegramSuccess || firebaseSuccess) && channel === NotificationChannel.BOTH
        ? telegramSuccess && firebaseSuccess
          ? NotificationStatus.SENT
          : NotificationStatus.SENT
        : telegramSuccess || firebaseSuccess
          ? NotificationStatus.SENT
          : NotificationStatus.FAILED;

    const notification = await this.prisma.notification.create({
      data: {
        type: dto.type,
        channel,
        title: dto.title,
        message: dto.message,
        status,
        recipientId: dto.recipientId || null,
        telegramChatId: dto.telegramChatId || null,
        firebaseToken: dto.firebaseToken || null,
        metadata: dto.metadata || null,
        sentAt: status === NotificationStatus.SENT ? new Date() : null,
        errorMessage:
          status === NotificationStatus.FAILED
            ? 'Failed to send notification'
            : null,
      },
    });

    return notification;
  }

  async sendPaymentWarning(clientId: string, invoiceId: string, amount: number, dueDate: Date) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        user: {
          select: {
            id: true,
            telegramChatId: true,
            firebaseToken: true,
          },
        },
      },
    });

    if (!client) {
      throw new BadRequestException('Client not found');
    }

    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
    );

    const title = 'Payment Warning';
    const message = `Invoice payment due in ${daysUntilDue} days. Amount: ${amount.toFixed(2)}. Due date: ${dueDate.toLocaleDateString()}`;

    const user = client.user;
    if (!user) {
      this.logger.warn(`Client ${clientId} has no associated user account`);
      return null;
    }

    const notification = await this.sendNotification({
      type: NotificationType.PAYMENT_WARNING,
      title,
      message,
      recipientId: user.id,
      telegramChatId: user.telegramChatId || undefined,
      firebaseToken: user.firebaseToken || undefined,
      metadata: {
        clientId,
        invoiceId,
        amount,
        dueDate: dueDate.toISOString(),
        daysUntilDue,
      },
    });

    return notification;
  }

  async sendBandwidthWarning(posId: string, usagePercentage: number) {
    const pos = await this.prisma.pOS.findUnique({
      where: { id: posId },
      include: {
        managers: {
          select: {
            id: true,
            isActive: true,
            telegramChatId: true,
            firebaseToken: true,
          },
        },
      },
    });

    if (!pos) {
      throw new BadRequestException('POS not found');
    }

    const title = 'Bandwidth Warning';
    const message = `POS "${pos.name}" bandwidth usage is at ${usagePercentage.toFixed(2)}%`;

    const notifications: any[] = [];

    for (const manager of pos.managers) {
      if (!manager.isActive) continue;

      const notification = await this.sendNotification({
        type: NotificationType.BANDWIDTH_WARNING,
        title,
        message,
        recipientId: manager.id,
        telegramChatId: manager.telegramChatId || undefined,
        firebaseToken: manager.firebaseToken || undefined,
        metadata: {
          posId,
          posName: pos.name,
          usagePercentage,
          allocatedBandwidth: pos.allocatedBandwidthMbps.toString(),
          currentUsage: pos.currentUsageMbps.toString(),
        },
      });
      notifications.push(notification);
    }

    return notifications;
  }

  async sendAlert(title: string, message: string, recipientId?: string, metadata?: any) {
    return this.sendNotification({
      type: NotificationType.ALERT,
      title,
      message,
      recipientId,
      metadata,
    });
  }

  async getUserNotifications(userId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async checkAndSendPaymentWarnings(daysBeforeDue = 7) {
    const now = new Date();
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + daysBeforeDue);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        dueDate: {
          gte: now,
          lte: warningDate,
        },
      },
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                telegramChatId: true,
                firebaseToken: true,
              },
            },
          },
        },
        payments: true,
      },
    });

    const notifications: any[] = [];

    for (const invoice of invoices) {
      const totalPaid = invoice.payments.reduce((sum: number, payment: any) => {
        return sum + Number(payment.amountPaid) + Number(payment.extraAmount);
      }, 0);

      const invoiceAmount = Number(invoice.amount);

      if (totalPaid < invoiceAmount) {
        try {
          const notification = await this.sendPaymentWarning(
            invoice.clientId,
            invoice.id,
            invoiceAmount,
            invoice.dueDate,
          );
          if (notification) {
            notifications.push(notification);
          }
        } catch (error) {
          this.logger.error(`Failed to send payment warning for invoice ${invoice.id}: ${error.message}`);
        }
      }
    }

    return notifications;
  }

  async checkAndSendBandwidthWarnings(thresholdPercentage = 80) {
    const posList = await this.prisma.pOS.findMany({
      where: { isActive: true },
      include: {
        managers: {
          select: {
            id: true,
            isActive: true,
            telegramChatId: true,
            firebaseToken: true,
          },
        },
      },
    });

    const notifications: any[] = [];

    for (const pos of posList) {
      const usagePercentage =
        (pos.currentUsageMbps.toNumber() / pos.allocatedBandwidthMbps.toNumber()) * 100;

      if (usagePercentage >= thresholdPercentage) {
        try {
          const posNotifications = await this.sendBandwidthWarning(pos.id, usagePercentage);
          notifications.push(...posNotifications);
        } catch (error) {
          this.logger.error(`Failed to send bandwidth warning for POS ${pos.id}: ${error.message}`);
        }
      }
    }

    return notifications;
  }
}
