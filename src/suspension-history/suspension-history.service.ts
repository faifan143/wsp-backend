import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class SuspensionHistoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any, currentUser: any) {
    const whereClause: any = {};

    // Apply clientId filter
    if (query.clientId) {
      whereClause.clientId = query.clientId;
    }

    // Apply reason filter
    if (query.reason) {
      whereClause.suspensionReason = query.reason;
    }

    // Apply date filters (using suspendedAt)
    if (query.fromDate || query.toDate) {
      whereClause.suspendedAt = {};
      if (query.fromDate) {
        whereClause.suspendedAt.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        whereClause.suspendedAt.lte = new Date(query.toDate);
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

    // RBAC / POS scope enforcement
    if (currentUser.role === UserRole.POS_MANAGER) {
      // POS_MANAGER: only see records for clients in their POS
      // Ignore any posId in query (do not allow override)
      whereClause.client = {
        posId: currentUser.posId,
      };
    } else if (currentUser.role === UserRole.CLIENT) {
      // CLIENT: only see their own history
      whereClause.clientId = currentUser.clientId;
    } else if (currentUser.role === UserRole.WSP_ADMIN) {
      // WSP_ADMIN: can see all, but can optionally filter by POS
      if (query.posId) {
        whereClause.client = {
          posId: query.posId,
        };
      }
    }

    const records = await this.prisma.suspensionHistory.findMany({
      where: whereClause,
      include: {
        client: {
          include: {
            pos: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
        suspendedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        reactivatedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: { suspendedAt: 'desc' },
    });

    return records;
  }

  async findOne(id: string, currentUser: any) {
    const record = await this.prisma.suspensionHistory.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            pos: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
        suspendedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        reactivatedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Suspension history record with ID ${id} not found`);
    }

    // RBAC enforcement
    if (currentUser.role === UserRole.POS_MANAGER) {
      // POS_MANAGER: allowed only if record.client.posId === currentUser.posId
      if (record.client.posId !== currentUser.posId) {
        throw new ForbiddenException(
          'You can only view suspension history for clients in your assigned POS',
        );
      }
    } else if (currentUser.role === UserRole.CLIENT) {
      // CLIENT: allowed only if record.clientId === currentUser.clientId
      if (record.clientId !== currentUser.clientId) {
        throw new ForbiddenException('You can only view your own suspension history');
      }
    }
    // WSP_ADMIN: allowed (no additional check needed)

    return record;
  }
}

