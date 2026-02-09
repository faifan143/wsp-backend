import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditAction, EntityType, UserRole } from '@prisma/client';
import { SettingsService } from '../settings/settings.service';

export interface AuditContext {
  userId: string | null; // null for system actions
  userRole: UserRole;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogParams {
  context: AuditContext;
  action: AuditAction;
  entityType: EntityType;
  entityId?: string | null;
  oldValues?: any | null;
  newValues?: any | null;
  description?: string | null;
}

@Injectable()
export class AuditLoggerService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => SettingsService))
    private readonly settingsService?: SettingsService,
  ) {}

  async log(params: AuditLogParams): Promise<void> {
    const {
      context,
      action,
      entityType,
      entityId,
      oldValues,
      newValues,
      description,
    } = params;
    const { userId, userRole, ipAddress, userAgent } = context;

    // Fail-safe: never throw from logger, so it doesn't break main flow
    // Skip logging if userId is null (system actions)
    if (!userId) {
      return;
    }

    // Check if audit logging is enabled
    try {
      if (this.settingsService) {
        const isEnabled = await this.settingsService.isAuditLoggingEnabled();
        if (!isEnabled) {
          return;
        }
      }
    } catch (err) {
      // If settings service is not available or error occurs, continue with logging
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          userRole,
          action,
          entityType,
          entityId: entityId ?? null,
          oldValues: oldValues ?? null,
          newValues: newValues ?? null,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          description: description ?? null,
        },
      });
    } catch (err) {
      // Optional: console.error, but don't rethrow
      // console.error('Failed to write audit log', err);
    }
  }
}

