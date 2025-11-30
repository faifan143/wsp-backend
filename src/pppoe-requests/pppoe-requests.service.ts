import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePppoeRequestDto } from './dto/create-pppoe-request.dto';
import { ApprovePppoeRequestDto } from './dto/approve-pppoe-request.dto';
import { RejectPppoeRequestDto } from './dto/reject-pppoe-request.dto';
import { CompletePppoeRequestDto } from './dto/complete-pppoe-request.dto';
import { RequestStatus, AuditAction, EntityType, UserRole } from '@prisma/client';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PppoeRequestsService {
  constructor(
    private prisma: PrismaService,
    private auditLogger: AuditLoggerService,
  ) {}

  async create(createPppoeRequestDto: CreatePppoeRequestDto, currentUser: any) {
    // Fetch client with POS
    const client = await this.prisma.client.findUnique({
      where: { id: createPppoeRequestDto.clientId },
      include: {
        pos: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${createPppoeRequestDto.clientId} not found`);
    }

    // RBAC enforcement
    if (currentUser.role === 'CLIENT') {
      if (currentUser.clientId !== createPppoeRequestDto.clientId) {
        throw new ForbiddenException('You can only create PPPoE requests for your own account');
      }
    } else if (currentUser.role === 'POS_MANAGER') {
      if (client.posId !== currentUser.posId) {
        throw new ForbiddenException('You can only create PPPoE requests for clients in your POS');
      }
    }

    // Validate at least one change is provided
    if (!createPppoeRequestDto.newUsername && !createPppoeRequestDto.newPassword) {
      throw new BadRequestException(
        'At least one of newUsername or newPassword must be provided',
      );
    }

    // Get current username from client (required field in schema)
    const currentUsername = client.pppoeUsername || '';

    // Validate new username uniqueness if provided and different
    if (
      createPppoeRequestDto.newUsername &&
      createPppoeRequestDto.newUsername !== currentUsername
    ) {
      const existingClient = await this.prisma.client.findUnique({
        where: { pppoeUsername: createPppoeRequestDto.newUsername },
      });

      if (existingClient && existingClient.id !== createPppoeRequestDto.clientId) {
        throw new BadRequestException('PPPoE username already exists');
      }
    }

    // Create PPPoE change request
    // Note: Schema requires currentUsername, newUsername, newPassword (all strings)
    // If newUsername not provided, use currentUsername; if newPassword not provided, use empty string
    const pppoeRequest = await this.prisma.pppoeChangeRequest.create({
      data: {
        clientId: createPppoeRequestDto.clientId,
        currentUsername: currentUsername,
        newUsername: createPppoeRequestDto.newUsername || currentUsername,
        newPassword: createPppoeRequestDto.newPassword || '',
        status: RequestStatus.PENDING,
        reason: createPppoeRequestDto.reason,
        requestedBy: currentUser.id,
        requestedAt: new Date(),
      },
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
        requestedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogger.log({
      context: {
        userId: currentUser.id,
        userRole: currentUser.role as UserRole,
        ipAddress: null,
        userAgent: null,
      },
      action: AuditAction.CREATE,
      entityType: EntityType.PPPOE_CHANGE_REQUEST,
      entityId: pppoeRequest.id,
      oldValues: null,
      newValues: {
        clientId: pppoeRequest.clientId,
        currentUsername: pppoeRequest.currentUsername,
        status: pppoeRequest.status,
      },
    });

    return pppoeRequest;
  }

  async findAll(query: any, currentUser: any) {
    const whereClause: any = {};

    // Apply filters
    if (query.clientId) {
      whereClause.clientId = query.clientId;
    }

    if (query.status) {
      whereClause.status = query.status;
    }

    // RBAC filtering
    if (currentUser.role === 'CLIENT') {
      // CLIENT can only see their own requests
      whereClause.clientId = currentUser.clientId;
    } else if (currentUser.role === 'POS_MANAGER' && currentUser.posId) {
      // POS_MANAGER can only see requests for their POS clients
      whereClause.client = {
        posId: currentUser.posId,
      };
    } else if (query.posId) {
      // WSP_ADMIN can filter by POS
      whereClause.client = {
        posId: query.posId,
      };
    }

    const pppoeRequests = await this.prisma.pppoeChangeRequest.findMany({
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
        requestedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
        approvedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        requestedAt: 'desc',
      },
    });

    return pppoeRequests;
  }

  async findOne(id: string, currentUser: any) {
    const pppoeRequest = await this.prisma.pppoeChangeRequest.findUnique({
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
        requestedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
        approvedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!pppoeRequest) {
      throw new NotFoundException(`PPPoE request with ID ${id} not found`);
    }

    // RBAC enforcement
    if (currentUser.role === 'CLIENT') {
      if (pppoeRequest.clientId !== currentUser.clientId) {
        throw new ForbiddenException('You can only view your own PPPoE requests');
      }
    } else if (currentUser.role === 'POS_MANAGER') {
      if (pppoeRequest.client.posId !== currentUser.posId) {
        throw new ForbiddenException(
          'You can only view PPPoE requests for clients in your POS',
        );
      }
    }

    return pppoeRequest;
  }

  async approve(id: string, approvePppoeRequestDto: ApprovePppoeRequestDto, currentUser: any) {
    const pppoeRequest = await this.prisma.pppoeChangeRequest.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!pppoeRequest) {
      throw new NotFoundException(`PPPoE request with ID ${id} not found`);
    }

    // RBAC enforcement
    if (currentUser.role === 'CLIENT') {
      throw new ForbiddenException('CLIENT role cannot approve requests');
    }

    if (currentUser.role === 'POS_MANAGER' && pppoeRequest.client.posId !== currentUser.posId) {
      throw new ForbiddenException(
        'You can only approve PPPoE requests for clients in your POS',
      );
    }

    // Validate status
    if (pppoeRequest.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot approve request with status ${pppoeRequest.status}. Only PENDING requests can be approved.`,
      );
    }

    // Update request
    const approvedRequest = await this.prisma.pppoeChangeRequest.update({
      where: { id },
      data: {
        status: RequestStatus.APPROVED,
        approvedBy: currentUser.id,
        processedAt: new Date(),
        reason: approvePppoeRequestDto.note
          ? `${pppoeRequest.reason || ''} [Approval: ${approvePppoeRequestDto.note}]`.trim()
          : pppoeRequest.reason,
      },
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
        requestedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
        approvedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogger.log({
      context: {
        userId: currentUser.id,
        userRole: currentUser.role as UserRole,
        ipAddress: null,
        userAgent: null,
      },
      action: AuditAction.UPDATE,
      entityType: EntityType.PPPOE_CHANGE_REQUEST,
      entityId: id,
      oldValues: { status: pppoeRequest.status },
      newValues: { status: RequestStatus.APPROVED },
      description: 'Approve PPPoE change',
    });

    return approvedRequest;
  }

  async reject(id: string, rejectPppoeRequestDto: RejectPppoeRequestDto, currentUser: any) {
    const pppoeRequest = await this.prisma.pppoeChangeRequest.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!pppoeRequest) {
      throw new NotFoundException(`PPPoE request with ID ${id} not found`);
    }

    // RBAC enforcement
    if (currentUser.role === 'CLIENT') {
      throw new ForbiddenException('CLIENT role cannot reject requests');
    }

    if (currentUser.role === 'POS_MANAGER' && pppoeRequest.client.posId !== currentUser.posId) {
      throw new ForbiddenException(
        'You can only reject PPPoE requests for clients in your POS',
      );
    }

    // Validate status
    if (pppoeRequest.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject request with status ${pppoeRequest.status}. Only PENDING requests can be rejected.`,
      );
    }

    // Update request
    // Note: Schema uses approvedBy for both approval and rejection (based on status)
    const rejectedRequest = await this.prisma.pppoeChangeRequest.update({
      where: { id },
      data: {
        status: RequestStatus.REJECTED,
        approvedBy: currentUser.id,
        processedAt: new Date(),
        reason: rejectPppoeRequestDto.note
          ? `[REJECTED: ${rejectPppoeRequestDto.rejectionReason}] ${rejectPppoeRequestDto.note}`
          : `[REJECTED: ${rejectPppoeRequestDto.rejectionReason}]`,
      },
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
        requestedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
        approvedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogger.log({
      context: {
        userId: currentUser.id,
        userRole: currentUser.role as UserRole,
        ipAddress: null,
        userAgent: null,
      },
      action: AuditAction.UPDATE,
      entityType: EntityType.PPPOE_CHANGE_REQUEST,
      entityId: id,
      oldValues: { status: pppoeRequest.status },
      newValues: { status: RequestStatus.REJECTED },
      description: `Reject PPPoE change. Reason: ${rejectPppoeRequestDto.rejectionReason}`,
    });

    return rejectedRequest;
  }

  async complete(id: string, completePppoeRequestDto: CompletePppoeRequestDto, currentUser: any) {
    // Only WSP_ADMIN can complete
    if (currentUser.role !== 'WSP_ADMIN') {
      throw new ForbiddenException('Only WSP_ADMIN can complete PPPoE requests');
    }

    const pppoeRequest = await this.prisma.pppoeChangeRequest.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!pppoeRequest) {
      throw new NotFoundException(`PPPoE request with ID ${id} not found`);
    }

    // Validate status
    if (pppoeRequest.status !== RequestStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot complete request with status ${pppoeRequest.status}. Only APPROVED requests can be completed.`,
      );
    }

    // Apply changes to Client
    const updateData: any = {};

    // Only update if newUsername is different from current
    if (pppoeRequest.newUsername && pppoeRequest.newUsername !== pppoeRequest.currentUsername) {
      // Validate new username uniqueness
      const existingClient = await this.prisma.client.findUnique({
        where: { pppoeUsername: pppoeRequest.newUsername },
      });

      if (existingClient && existingClient.id !== pppoeRequest.clientId) {
        throw new BadRequestException('PPPoE username already exists');
      }

      updateData.pppoeUsername = pppoeRequest.newUsername;
    }

    // Only update password if newPassword is provided and not empty
    if (pppoeRequest.newPassword && pppoeRequest.newPassword.trim() !== '') {
      // Hash password before storing
      const saltRounds = 10;
      updateData.pppoePassword = await bcrypt.hash(pppoeRequest.newPassword, saltRounds);
    }

    // Update client if there are changes
    if (Object.keys(updateData).length > 0) {
      await this.prisma.client.update({
        where: { id: pppoeRequest.clientId },
        data: updateData,
      });
    }

    // Update request status to COMPLETED
    const completedRequest = await this.prisma.pppoeChangeRequest.update({
      where: { id },
      data: {
        status: RequestStatus.COMPLETED,
        processedAt: new Date(),
        reason: completePppoeRequestDto.technicianNote
          ? `${pppoeRequest.reason || ''} [Completed: ${completePppoeRequestDto.technicianNote}]`.trim()
          : pppoeRequest.reason,
      },
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
        requestedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
        approvedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogger.log({
      context: {
        userId: currentUser.id,
        userRole: currentUser.role as UserRole,
        ipAddress: null,
        userAgent: null,
      },
      action: AuditAction.UPDATE,
      entityType: EntityType.PPPOE_CHANGE_REQUEST,
      entityId: id,
      oldValues: { status: pppoeRequest.status },
      newValues: { status: RequestStatus.COMPLETED },
      description: `Complete PPPoE change (applied credentials)${completePppoeRequestDto.technicianNote ? ` - ${completePppoeRequestDto.technicianNote}` : ''}`,
    });

    return completedRequest;
  }
}

