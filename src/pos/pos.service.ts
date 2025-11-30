import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePosDto } from './dto/create-pos.dto';
import { UpdatePosDto } from './dto/update-pos.dto';
import { UpdatePosBandwidthDto } from './dto/update-pos-bandwidth.dto';
import { UserRole, AuditAction, EntityType } from '@prisma/client';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';

@Injectable()
export class PosService {
  constructor(
    private prisma: PrismaService,
    private auditLogger: AuditLoggerService,
  ) {}

  async create(createPosDto: CreatePosDto, currentUser?: any) {
    // Check for name uniqueness (optional but good practice)
    const existingPos = await this.prisma.pOS.findFirst({
      where: { name: createPosDto.name },
    });

    if (existingPos) {
      throw new ConflictException(`POS with name "${createPosDto.name}" already exists`);
    }

    const pos = await this.prisma.pOS.create({
      data: {
        name: createPosDto.name,
        location: createPosDto.location,
        contactPhone: createPosDto.contactPhone,
        allocatedBandwidthMbps: createPosDto.allocatedBandwidthMbps,
        currentUsageMbps: 0,
        isActive: true,
      },
    });

    // Audit log
    if (currentUser) {
      await this.auditLogger.log({
        context: {
          userId: currentUser.id,
          userRole: currentUser.role as UserRole,
          ipAddress: null,
          userAgent: null,
        },
        action: AuditAction.CREATE,
        entityType: EntityType.POS,
        entityId: pos.id,
        oldValues: null,
        newValues: {
          name: pos.name,
          location: pos.location,
          allocatedBandwidthMbps: pos.allocatedBandwidthMbps,
        },
      });
    }

    return pos;
  }

  async findAll() {
    const posList = await this.prisma.pOS.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return posList;
  }

  async findOne(id: string) {
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    return pos;
  }

  async update(id: string, updatePosDto: UpdatePosDto, currentUser?: any) {
    const existingPos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!existingPos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    // Check name uniqueness if name is being updated
    if (updatePosDto.name && updatePosDto.name !== existingPos.name) {
      const existingName = await this.prisma.pOS.findFirst({
        where: {
          name: updatePosDto.name,
          NOT: { id },
        },
      });

      if (existingName) {
        throw new ConflictException(`POS with name "${updatePosDto.name}" already exists`);
      }
    }

    const updatedPos = await this.prisma.pOS.update({
      where: { id },
      data: updatePosDto,
    });

    // Audit log
    if (currentUser) {
      const oldValues: any = {};
      const newValues: any = {};

      if (updatePosDto.name && updatePosDto.name !== existingPos.name) {
        oldValues.name = existingPos.name;
        newValues.name = updatePosDto.name;
      }
      if (updatePosDto.location && updatePosDto.location !== existingPos.location) {
        oldValues.location = existingPos.location;
        newValues.location = updatePosDto.location;
      }
      if (updatePosDto.contactPhone !== undefined) {
        oldValues.contactPhone = existingPos.contactPhone;
        newValues.contactPhone = updatePosDto.contactPhone;
      }

      await this.auditLogger.log({
        context: {
          userId: currentUser.id,
          userRole: currentUser.role as UserRole,
          ipAddress: null,
          userAgent: null,
        },
        action: AuditAction.UPDATE,
        entityType: EntityType.POS,
        entityId: id,
        oldValues: Object.keys(oldValues).length > 0 ? oldValues : null,
        newValues: Object.keys(newValues).length > 0 ? newValues : null,
      });
    }

    return updatedPos;
  }

  async activate(id: string, currentUser?: any) {
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    const activatedPos = await this.prisma.pOS.update({
      where: { id },
      data: { isActive: true },
    });

    // Audit log
    if (currentUser) {
      await this.auditLogger.log({
        context: {
          userId: currentUser.id,
          userRole: currentUser.role as UserRole,
          ipAddress: null,
          userAgent: null,
        },
        action: AuditAction.UPDATE,
        entityType: EntityType.POS,
        entityId: id,
        oldValues: { isActive: pos.isActive },
        newValues: { isActive: true },
        description: 'Activate POS',
      });
    }

    return activatedPos;
  }

  async deactivate(id: string, currentUser?: any) {
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    const deactivatedPos = await this.prisma.pOS.update({
      where: { id },
      data: { isActive: false },
    });

    // Audit log
    if (currentUser) {
      await this.auditLogger.log({
        context: {
          userId: currentUser.id,
          userRole: currentUser.role as UserRole,
          ipAddress: null,
          userAgent: null,
        },
        action: AuditAction.UPDATE,
        entityType: EntityType.POS,
        entityId: id,
        oldValues: { isActive: pos.isActive },
        newValues: { isActive: false },
        description: 'Deactivate POS',
      });
    }

    return deactivatedPos;
  }

  async updateBandwidth(id: string, updateBandwidthDto: UpdatePosBandwidthDto, currentUser?: any) {
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    if (updateBandwidthDto.allocatedBandwidthMbps < 0) {
      throw new BadRequestException('Allocated bandwidth cannot be negative');
    }

    // TODO: Later we will validate against BandwidthPool global capacity
    // For now, just update the bandwidth

    const updatedPos = await this.prisma.pOS.update({
      where: { id },
      data: {
        allocatedBandwidthMbps: updateBandwidthDto.allocatedBandwidthMbps,
      },
    });

    // Audit log
    if (currentUser) {
      await this.auditLogger.log({
        context: {
          userId: currentUser.id,
          userRole: currentUser.role as UserRole,
          ipAddress: null,
          userAgent: null,
        },
        action: AuditAction.UPDATE,
        entityType: EntityType.POS,
        entityId: id,
        oldValues: { allocatedBandwidthMbps: pos.allocatedBandwidthMbps },
        newValues: { allocatedBandwidthMbps: updateBandwidthDto.allocatedBandwidthMbps },
        description: 'Update POS bandwidth',
      });
    }

    return updatedPos;
  }

  async getClients(id: string) {
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    const clients = await this.prisma.client.findMany({
      where: { posId: id },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return clients;
  }

  async getManagers(id: string) {
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    const managers = await this.prisma.user.findMany({
      where: {
        posId: id,
        role: UserRole.POS_MANAGER,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return managers;
  }

  async assignManager(id: string, userId: string) {
    // Validate POS exists
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Validate user role is POS_MANAGER
    if (user.role !== UserRole.POS_MANAGER) {
      throw new BadRequestException('User must have POS_MANAGER role to be assigned to a POS');
    }

    // Check if user is already assigned to another POS
    if (user.posId && user.posId !== id) {
      throw new BadRequestException(
        `User is already assigned to another POS (ID: ${user.posId})`,
      );
    }

    // If already assigned to this POS, return success
    if (user.posId === id) {
      return { message: 'Manager is already assigned to this POS', user };
    }

    // Assign manager to POS
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { posId: id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        posId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  async removeManager(id: string, userId: string) {
    // Validate POS exists
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    // Validate user exists and is assigned to this POS
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.posId !== id) {
      throw new BadRequestException(
        `User is not assigned to this POS. Current POS ID: ${user.posId || 'none'}`,
      );
    }

    // Remove manager from POS
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { posId: null },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        posId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }
}

