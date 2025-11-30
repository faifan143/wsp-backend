import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { UserRole, EntityType } from '@prisma/client';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryAuditDto, currentUser: any) {
    const whereClause: any = {};

    // Parse basic filters
    if (query.userId) {
      whereClause.userId = query.userId;
    }

    if (query.role) {
      whereClause.userRole = query.role;
    }

    if (query.entityType) {
      whereClause.entityType = query.entityType;
    }

    if (query.entityId) {
      whereClause.entityId = query.entityId;
    }

    if (query.action) {
      whereClause.action = query.action;
    }

    if (query.ipAddress) {
      whereClause.ipAddress = query.ipAddress;
    }

    // Date filters
    if (query.fromDate || query.toDate) {
      whereClause.createdAt = {};
      if (query.fromDate) {
        whereClause.createdAt.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        whereClause.createdAt.lte = new Date(query.toDate);
      }
    }

    // Validate date range
    if (query.fromDate && query.toDate) {
      const fromDate = new Date(query.fromDate);
      const toDate = new Date(query.toDate);
      if (fromDate > toDate) {
        throw new BadRequestException('fromDate cannot be after toDate');
      }
    }

    // RBAC filtering
    if (currentUser.role === UserRole.WSP_ADMIN) {
      // WSP_ADMIN: can filter by anything, including posId
      if (query.posId) {
        // Get all client IDs for this POS
        const clientsInPos = await this.prisma.client.findMany({
          where: { posId: query.posId },
          select: { id: true },
        });
        const clientIds = clientsInPos.map((c) => c.id);

        // Restrict logs to:
        // - logs where user.posId = posId
        // OR
        // - logs where entityType = CLIENT and entityId belongs to a client with that posId
        // Prisma will combine this OR with existing filters using AND
        whereClause.OR = [
          { user: { posId: query.posId } },
          {
            AND: [
              { entityType: EntityType.CLIENT },
              { entityId: { in: clientIds } },
            ],
          },
        ];
      }
    } else if (currentUser.role === UserRole.POS_MANAGER) {
      // POS_MANAGER: only logs related to their POS clients + their POS actions
      // Ignore posId from query
      const clientsInPos = await this.prisma.client.findMany({
        where: { posId: currentUser.posId },
        select: { id: true },
      });
      const clientIds = clientsInPos.map((c) => c.id);

      // Prisma will combine this OR with existing filters using AND
      whereClause.OR = [
        { user: { posId: currentUser.posId } },
        {
          AND: [
            { entityType: EntityType.CLIENT },
            { entityId: { in: clientIds } },
          ],
        },
      ];
    } else if (currentUser.role === UserRole.CLIENT) {
      // CLIENT: only logs where userId = currentUser.id OR entityId = currentUser.clientId
      // Prisma will combine this OR with existing filters using AND
      whereClause.OR = [
        { userId: currentUser.id },
        {
          AND: [
            { entityType: EntityType.CLIENT },
            { entityId: currentUser.clientId },
          ],
        },
      ];
    }

    const limit = query.limit ?? 100;

    const logs = await this.prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            posId: true,
            clientId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs;
  }

  async findOne(id: string, currentUser: any) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            posId: true,
            clientId: true,
          },
        },
      },
    });

    if (!log) {
      throw new NotFoundException(`Audit log with ID ${id} not found`);
    }

    // RBAC enforcement
    if (currentUser.role === UserRole.WSP_ADMIN) {
      // WSP_ADMIN: allowed
      return log;
    } else if (currentUser.role === UserRole.POS_MANAGER) {
      // POS_MANAGER: check if log.user.posId === manager.posId
      // OR (log.entityType === CLIENT and entityId → client.posId === manager.posId)
      if (log.user.posId === currentUser.posId) {
        return log;
      }

      if (log.entityType === EntityType.CLIENT && log.entityId) {
        const client = await this.prisma.client.findUnique({
          where: { id: log.entityId },
          select: { posId: true },
        });

        if (client && client.posId === currentUser.posId) {
          return log;
        }
      }

      throw new ForbiddenException(
        'You can only view audit logs related to your assigned POS',
      );
    } else if (currentUser.role === UserRole.CLIENT) {
      // CLIENT: log.userId === currentUser.id OR log.entityId === currentUser.clientId
      if (log.userId === currentUser.id) {
        return log;
      }

      if (log.entityType === EntityType.CLIENT && log.entityId === currentUser.clientId) {
        return log;
      }

      throw new ForbiddenException('You can only view your own audit logs');
    }

    throw new ForbiddenException('You do not have permission to view this audit log');
  }
}

