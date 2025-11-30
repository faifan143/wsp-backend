import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateStaticIpDto } from './dto/create-static-ip.dto';
import { UpdateStaticIpDto } from './dto/update-static-ip.dto';
import { IpStatus, AuditAction, EntityType, UserRole } from '@prisma/client';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';

@Injectable()
export class StaticIpService {
  constructor(
    private prisma: PrismaService,
    private auditLogger: AuditLoggerService,
  ) {}

  async create(createStaticIpDto: CreateStaticIpDto, currentUser?: any) {
    // Validate POS exists
    const pos = await this.prisma.pOS.findUnique({
      where: { id: createStaticIpDto.posId },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${createStaticIpDto.posId} not found`);
    }

    // Validate IP address uniqueness
    const existingIp = await this.prisma.staticIpPool.findUnique({
      where: { ipAddress: createStaticIpDto.ipAddress },
    });

    if (existingIp) {
      throw new ConflictException(`IP address ${createStaticIpDto.ipAddress} already exists`);
    }

    // Create static IP entry
    const staticIp = await this.prisma.staticIpPool.create({
      data: {
        posId: createStaticIpDto.posId,
        ipAddress: createStaticIpDto.ipAddress,
        subnetMask: createStaticIpDto.subnetMask,
        gateway: createStaticIpDto.gateway,
        dnsPrimary: createStaticIpDto.dnsPrimary,
        dnsSecondary: createStaticIpDto.dnsSecondary,
        status: IpStatus.AVAILABLE,
        clientId: null,
        assignedAt: null,
      },
      include: {
        pos: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        client: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
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
        entityType: EntityType.STATIC_IP_POOL,
        entityId: staticIp.id,
        oldValues: null,
        newValues: {
          ipAddress: staticIp.ipAddress,
          posId: staticIp.posId,
          status: staticIp.status,
        },
      });
    }

    return staticIp;
  }

  async findAll(posFilter?: string, statusFilter?: IpStatus, currentUser?: any) {
    let whereClause: any = {};

    // POS_MANAGER can only see IPs from their POS
    if (currentUser?.role === 'POS_MANAGER' && currentUser?.posId) {
      whereClause.posId = currentUser.posId;
    } else if (posFilter) {
      whereClause.posId = posFilter;
    }

    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    const staticIps = await this.prisma.staticIpPool.findMany({
      where: whereClause,
      include: {
        pos: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        client: {
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return staticIps;
  }

  async findOne(id: string, currentUser?: any) {
    const staticIp = await this.prisma.staticIpPool.findUnique({
      where: { id },
      include: {
        pos: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        client: {
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!staticIp) {
      throw new NotFoundException(`Static IP with ID ${id} not found`);
    }

    // POS_MANAGER may only view if IP belongs to their POS
    if (currentUser?.role === 'POS_MANAGER' && currentUser?.posId !== staticIp.posId) {
      throw new ForbiddenException('You can only view static IPs from your own POS');
    }

    return staticIp;
  }

  async update(id: string, updateStaticIpDto: UpdateStaticIpDto, currentUser?: any) {
    const staticIp = await this.prisma.staticIpPool.findUnique({
      where: { id },
    });

    if (!staticIp) {
      throw new NotFoundException(`Static IP with ID ${id} not found`);
    }

    const updatedStaticIp = await this.prisma.staticIpPool.update({
      where: { id },
      data: updateStaticIpDto,
      include: {
        pos: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        client: {
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
          },
        },
      },
    });

    // Audit log
    if (currentUser) {
      const oldValues: any = {};
      const newValues: any = {};

      if (updateStaticIpDto.subnetMask && updateStaticIpDto.subnetMask !== staticIp.subnetMask) {
        oldValues.subnetMask = staticIp.subnetMask;
        newValues.subnetMask = updateStaticIpDto.subnetMask;
      }
      if (updateStaticIpDto.gateway && updateStaticIpDto.gateway !== staticIp.gateway) {
        oldValues.gateway = staticIp.gateway;
        newValues.gateway = updateStaticIpDto.gateway;
      }
      if (updateStaticIpDto.dnsPrimary !== undefined) {
        oldValues.dnsPrimary = staticIp.dnsPrimary;
        newValues.dnsPrimary = updateStaticIpDto.dnsPrimary;
      }
      if (updateStaticIpDto.dnsSecondary !== undefined) {
        oldValues.dnsSecondary = staticIp.dnsSecondary;
        newValues.dnsSecondary = updateStaticIpDto.dnsSecondary;
      }

      await this.auditLogger.log({
        context: {
          userId: currentUser.id,
          userRole: currentUser.role as UserRole,
          ipAddress: null,
          userAgent: null,
        },
        action: AuditAction.UPDATE,
        entityType: EntityType.STATIC_IP_POOL,
        entityId: id,
        oldValues: Object.keys(oldValues).length > 0 ? oldValues : null,
        newValues: Object.keys(newValues).length > 0 ? newValues : null,
      });
    }

    return updatedStaticIp;
  }

  async release(id: string, currentUser?: any) {
    const staticIp = await this.prisma.staticIpPool.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!staticIp) {
      throw new NotFoundException(`Static IP with ID ${id} not found`);
    }

    // If already AVAILABLE, return
    if (staticIp.status === IpStatus.AVAILABLE && !staticIp.clientId) {
      return staticIp;
    }

    // If assigned to a client, we need to handle the client relationship
    // Note: In Prisma schema, Client doesn't have a direct staticIpId field,
    // the relationship is through StaticIpPool.clientId
    // So we just need to clear the StaticIpPool.clientId

    // Update StaticIpPool to release
    const releasedStaticIp = await this.prisma.staticIpPool.update({
      where: { id },
      data: {
        clientId: null,
        status: IpStatus.AVAILABLE,
        assignedAt: null,
      },
      include: {
        pos: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        client: {
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
          },
        },
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
        entityType: EntityType.STATIC_IP_POOL,
        entityId: id,
        oldValues: { clientId: staticIp.clientId, status: staticIp.status },
        newValues: { clientId: null, status: IpStatus.AVAILABLE },
        description: 'Release static IP',
      });
    }

    return releasedStaticIp;
  }
}

