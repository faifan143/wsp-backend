import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditAction, EntityType, UserRole } from '@prisma/client';

export interface AuditContext {
  userId: string;
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
  constructor(private readonly prisma: PrismaService) {}

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

