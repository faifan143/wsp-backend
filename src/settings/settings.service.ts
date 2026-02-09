import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { AuditAction, EntityType, UserRole } from '@prisma/client';

@Injectable()
export class SettingsService {
  private readonly SETTING_KEYS = {
    AUDIT_LOGGING_ENABLED: 'audit_logging_enabled',
    PASSWORD_EXPIRY_DAYS: 'password_expiry_days',
  };

  constructor(
    private prisma: PrismaService,
    private auditLogger: AuditLoggerService,
  ) {}

  private async getOrCreateSetting(key: string, defaultValue: string): Promise<string> {
    let setting = await this.prisma.settings.findUnique({
      where: { key },
    });

    if (!setting) {
      setting = await this.prisma.settings.create({
        data: {
          key,
          value: defaultValue,
        },
      });
    }

    return setting.value;
  }

  async getSettings() {
    const auditLoggingEnabled = await this.getOrCreateSetting(
      this.SETTING_KEYS.AUDIT_LOGGING_ENABLED,
      'true',
    );
    const passwordExpiryDays = await this.getOrCreateSetting(
      this.SETTING_KEYS.PASSWORD_EXPIRY_DAYS,
      '0',
    );

    return {
      auditLoggingEnabled: auditLoggingEnabled === 'true',
      passwordExpiryDays: parseInt(passwordExpiryDays, 10),
    };
  }

  async updateSettings(updateSettingsDto: UpdateSettingsDto, currentUser: any) {
    const updates: Array<Promise<any>> = [];

    if (updateSettingsDto.auditLoggingEnabled !== undefined) {
      updates.push(
        this.updateSetting(
          this.SETTING_KEYS.AUDIT_LOGGING_ENABLED,
          updateSettingsDto.auditLoggingEnabled.toString(),
          currentUser,
        ),
      );
    }

    if (updateSettingsDto.passwordExpiryDays !== undefined) {
      if (updateSettingsDto.passwordExpiryDays < 0) {
        throw new BadRequestException('Password expiry days must be 0 or greater');
      }
      updates.push(
        this.updateSetting(
          this.SETTING_KEYS.PASSWORD_EXPIRY_DAYS,
          updateSettingsDto.passwordExpiryDays.toString(),
          currentUser,
        ),
      );
    }

    await Promise.all(updates);

    return this.getSettings();
  }

  private async updateSetting(key: string, value: string, currentUser: any) {
    const existing = await this.prisma.settings.findUnique({
      where: { key },
    });

    const oldValue = existing?.value || null;

    if (existing) {
      await this.prisma.settings.update({
        where: { key },
        data: {
          value,
          updatedBy: currentUser.id,
        },
      });
    } else {
      await this.prisma.settings.create({
        data: {
          key,
          value,
          updatedBy: currentUser.id,
        },
      });
    }

    await this.auditLogger.log({
      context: {
        userId: currentUser.id,
        userRole: currentUser.role as UserRole,
        ipAddress: null,
        userAgent: null,
      },
      action: AuditAction.UPDATE,
      entityType: EntityType.AUDIT_LOG,
      entityId: null,
      oldValues: { [key]: oldValue },
      newValues: { [key]: value },
      description: `Update setting: ${key}`,
    });
  }

  async isAuditLoggingEnabled(): Promise<boolean> {
    const value = await this.getOrCreateSetting(
      this.SETTING_KEYS.AUDIT_LOGGING_ENABLED,
      'true',
    );
    return value === 'true';
  }

  async getPasswordExpiryDays(): Promise<number> {
    const value = await this.getOrCreateSetting(
      this.SETTING_KEYS.PASSWORD_EXPIRY_DAYS,
      '0',
    );
    return parseInt(value, 10);
  }
}
