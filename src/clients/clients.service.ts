import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateConnectionTypeDto } from './dto/update-connection-type.dto';
import { SuspendClientDto } from './dto/suspend-client.dto';
import { ConnectionType, ClientStatus, IpStatus, AuditAction, EntityType, UserRole } from '@prisma/client';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private auditLogger: AuditLoggerService,
  ) {}

  async create(createClientDto: CreateClientDto, currentUser: any) {
    // Validate POS exists
    const pos = await this.prisma.pOS.findUnique({
      where: { id: createClientDto.posId },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${createClientDto.posId} not found`);
    }

    // Check POS_MANAGER authorization
    if (currentUser.role === 'POS_MANAGER' && currentUser.posId !== createClientDto.posId) {
      throw new ForbiddenException('You can only create clients for your own POS');
    }

    // Validate email uniqueness
    const existingEmail = await this.prisma.client.findUnique({
      where: { email: createClientDto.email },
    });

    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    // Handle connection type validation
    if (createClientDto.connectionType === ConnectionType.STATIC) {
      if (!createClientDto.staticIpId) {
        throw new BadRequestException('staticIpId is required for STATIC connection type');
      }

      const staticIp = await this.prisma.staticIpPool.findUnique({
        where: { id: createClientDto.staticIpId },
      });

      if (!staticIp) {
        throw new NotFoundException(`Static IP with ID ${createClientDto.staticIpId} not found`);
      }

      if (staticIp.posId !== createClientDto.posId) {
        throw new BadRequestException('Static IP must belong to the same POS as the client');
      }

      if (staticIp.status !== IpStatus.AVAILABLE) {
        throw new BadRequestException('Static IP is not available');
      }
    } else if (createClientDto.connectionType === ConnectionType.PPPOE) {
      if (!createClientDto.pppoeUsername || !createClientDto.pppoePassword) {
        throw new BadRequestException('pppoeUsername and pppoePassword are required for PPPOE connection type');
      }

      const existingPppoeUsername = await this.prisma.client.findUnique({
        where: { pppoeUsername: createClientDto.pppoeUsername },
      });

      if (existingPppoeUsername) {
        throw new ConflictException('PPPoE username already exists');
      }
    }

    // Create client
    const clientData: any = {
      posId: createClientDto.posId,
      fullName: createClientDto.fullName,
      phone: createClientDto.phone,
      email: createClientDto.email,
      address: createClientDto.address,
      nationalId: createClientDto.nationalId,
      connectionType: createClientDto.connectionType,
      status: ClientStatus.ACTIVE,
      accountBalance: 0,
      autoRenewEnabled: true,
    };

    if (createClientDto.connectionType === ConnectionType.PPPOE) {
      clientData.pppoeUsername = createClientDto.pppoeUsername;
      clientData.pppoePassword = createClientDto.pppoePassword;
    }

    const client = await this.prisma.client.create({
      data: clientData,
    });

    // If STATIC, assign the static IP
    if (createClientDto.connectionType === ConnectionType.STATIC && createClientDto.staticIpId) {
      await this.prisma.staticIpPool.update({
        where: { id: createClientDto.staticIpId },
        data: {
          clientId: client.id,
          status: IpStatus.ASSIGNED,
          assignedAt: new Date(),
        },
      });
    }

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
        entityType: EntityType.CLIENT,
        entityId: client.id,
        oldValues: null,
        newValues: {
          fullName: client.fullName,
          email: client.email,
          connectionType: client.connectionType,
          posId: client.posId,
        },
      });
    }

    return client;
  }

  async findAll(currentUser?: any) {
    let whereClause: any = {};

    // POS_MANAGER can only see clients from their POS
    if (currentUser?.role === 'POS_MANAGER' && currentUser?.posId) {
      whereClause.posId = currentUser.posId;
    }

    const clients = await this.prisma.client.findMany({
      where: whereClause,
      include: {
        pos: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        staticIp: {
          select: {
            id: true,
            ipAddress: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return clients;
  }

  async findOne(id: string, currentUser?: any) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        pos: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        staticIp: {
          select: {
            id: true,
            ipAddress: true,
            subnetMask: true,
            gateway: true,
            dnsPrimary: true,
            dnsSecondary: true,
            status: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    // POS_MANAGER can only access clients from their POS
    if (currentUser?.role === 'POS_MANAGER' && currentUser?.posId !== client.posId) {
      throw new ForbiddenException('You can only access clients from your own POS');
    }

    return client;
  }

  async update(id: string, updateClientDto: UpdateClientDto, currentUser?: any) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    // POS_MANAGER can only update clients from their POS
    if (currentUser?.role === 'POS_MANAGER' && currentUser?.posId !== client.posId) {
      throw new ForbiddenException('You can only update clients from your own POS');
    }

    // Validate email uniqueness if email is being updated
    if (updateClientDto.email && updateClientDto.email !== client.email) {
      const existingEmail = await this.prisma.client.findUnique({
        where: { email: updateClientDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    const updatedClient = await this.prisma.client.update({
      where: { id },
      data: updateClientDto,
    });

    // Audit log
    if (currentUser) {
      const oldValues: any = {};
      const newValues: any = {};

      if (updateClientDto.fullName && updateClientDto.fullName !== client.fullName) {
        oldValues.fullName = client.fullName;
        newValues.fullName = updateClientDto.fullName;
      }
      if (updateClientDto.email && updateClientDto.email !== client.email) {
        oldValues.email = client.email;
        newValues.email = updateClientDto.email;
      }
      if (updateClientDto.phone && updateClientDto.phone !== client.phone) {
        oldValues.phone = client.phone;
        newValues.phone = updateClientDto.phone;
      }
      if (updateClientDto.autoRenewEnabled !== undefined) {
        oldValues.autoRenewEnabled = client.autoRenewEnabled;
        newValues.autoRenewEnabled = updateClientDto.autoRenewEnabled;
      }

      await this.auditLogger.log({
        context: {
          userId: currentUser.id,
          userRole: currentUser.role as UserRole,
          ipAddress: null,
          userAgent: null,
        },
        action: AuditAction.UPDATE,
        entityType: EntityType.CLIENT,
        entityId: id,
        oldValues: Object.keys(oldValues).length > 0 ? oldValues : null,
        newValues: Object.keys(newValues).length > 0 ? newValues : null,
      });
    }

    return updatedClient;
  }

  async activate(id: string, currentUser: any) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    // POS_MANAGER can only activate clients from their POS
    if (currentUser.role === 'POS_MANAGER' && currentUser.posId !== client.posId) {
      throw new ForbiddenException('You can only activate clients from your own POS');
    }

    if (client.status === ClientStatus.TERMINATED) {
      throw new BadRequestException('Cannot activate a terminated client');
    }

    if (client.status === ClientStatus.ACTIVE) {
      return client;
    }

    // Update client status
    await this.prisma.client.update({
      where: { id },
      data: { status: ClientStatus.ACTIVE },
    });

    // Create suspension history record for reactivation
    await this.prisma.suspensionHistory.create({
      data: {
        clientId: id,
        suspensionReason: 'OTHER',
        reasonDetails: 'Manual reactivation',
        suspendedAt: new Date(),
        reactivatedAt: new Date(),
        reactivatedBy: currentUser.id,
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
      action: AuditAction.REACTIVATE,
      entityType: EntityType.CLIENT,
      entityId: id,
      oldValues: { status: client.status },
      newValues: { status: ClientStatus.ACTIVE },
      description: 'Client reactivated',
    });

    return this.findOne(id, currentUser);
  }

  async suspend(id: string, suspendClientDto: SuspendClientDto, currentUser: any) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    // POS_MANAGER can only suspend clients from their POS
    if (currentUser.role === 'POS_MANAGER' && currentUser.posId !== client.posId) {
      throw new ForbiddenException('You can only suspend clients from your own POS');
    }

    if (client.status === ClientStatus.TERMINATED) {
      throw new BadRequestException('Cannot suspend a terminated client');
    }

    if (client.status === ClientStatus.SUSPENDED) {
      return client;
    }

    // Update client status
    await this.prisma.client.update({
      where: { id },
      data: { status: ClientStatus.SUSPENDED },
    });

    // Create suspension history record
    await this.prisma.suspensionHistory.create({
      data: {
        clientId: id,
        suspensionReason: suspendClientDto.reason,
        reasonDetails: suspendClientDto.reasonDetails,
        suspendedAt: new Date(),
        suspendedBy: currentUser.id,
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
      action: AuditAction.SUSPEND,
      entityType: EntityType.CLIENT,
      entityId: id,
      oldValues: { status: client.status },
      newValues: { status: ClientStatus.SUSPENDED },
      description: `Client suspended. Reason: ${suspendClientDto.reason}${suspendClientDto.reasonDetails ? ` - ${suspendClientDto.reasonDetails}` : ''}`,
    });

    return this.findOne(id, currentUser);
  }

  async terminate(id: string, currentUser: any) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        staticIp: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    // POS_MANAGER can only terminate clients from their POS
    if (currentUser.role === 'POS_MANAGER' && currentUser.posId !== client.posId) {
      throw new ForbiddenException('You can only terminate clients from your own POS');
    }

    if (client.status === ClientStatus.TERMINATED) {
      return client;
    }

    // Release static IP if assigned
    if (client.staticIp) {
      await this.prisma.staticIpPool.update({
        where: { id: client.staticIp.id },
        data: {
          clientId: null,
          status: IpStatus.AVAILABLE,
          assignedAt: null,
        },
      });
    }

    // Update client status
    await this.prisma.client.update({
      where: { id },
      data: { status: ClientStatus.TERMINATED },
    });

    // Create suspension history record for termination
    await this.prisma.suspensionHistory.create({
      data: {
        clientId: id,
        suspensionReason: 'OTHER',
        reasonDetails: 'Client terminated',
        suspendedAt: new Date(),
        suspendedBy: currentUser.id,
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
      entityType: EntityType.CLIENT,
      entityId: id,
      oldValues: { status: client.status },
      newValues: { status: ClientStatus.TERMINATED },
      description: 'Terminate client',
    });

    return this.findOne(id, currentUser);
  }

  async updateConnectionType(id: string, updateConnectionTypeDto: UpdateConnectionTypeDto, currentUser?: any) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        staticIp: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    // POS_MANAGER can only update clients from their POS
    if (currentUser?.role === 'POS_MANAGER' && currentUser?.posId !== client.posId) {
      throw new ForbiddenException('You can only update clients from your own POS');
    }

    const updateData: any = {
      connectionType: updateConnectionTypeDto.connectionType,
    };

    switch (updateConnectionTypeDto.connectionType) {
      case ConnectionType.STATIC:
        if (!updateConnectionTypeDto.staticIpId) {
          throw new BadRequestException('staticIpId is required for STATIC connection type');
        }

        const staticIp = await this.prisma.staticIpPool.findUnique({
          where: { id: updateConnectionTypeDto.staticIpId },
        });

        if (!staticIp) {
          throw new NotFoundException(`Static IP with ID ${updateConnectionTypeDto.staticIpId} not found`);
        }

        if (staticIp.posId !== client.posId) {
          throw new BadRequestException('Static IP must belong to the same POS as the client');
        }

        if (staticIp.status !== IpStatus.AVAILABLE && staticIp.clientId !== client.id) {
          throw new BadRequestException('Static IP is not available');
        }

        // Release old static IP if different
        if (client.staticIp && client.staticIp.id !== updateConnectionTypeDto.staticIpId) {
          await this.prisma.staticIpPool.update({
            where: { id: client.staticIp.id },
            data: {
              clientId: null,
              status: IpStatus.AVAILABLE,
              assignedAt: null,
            },
          });
        }

        // Assign new static IP
        await this.prisma.staticIpPool.update({
          where: { id: updateConnectionTypeDto.staticIpId },
          data: {
            clientId: client.id,
            status: IpStatus.ASSIGNED,
            assignedAt: new Date(),
          },
        });

        updateData.pppoeUsername = null;
        updateData.pppoePassword = null;
        break;

      case ConnectionType.PPPOE:
        if (!updateConnectionTypeDto.pppoeUsername || !updateConnectionTypeDto.pppoePassword) {
          throw new BadRequestException('pppoeUsername and pppoePassword are required for PPPOE connection type');
        }

        // Check pppoeUsername uniqueness (unless it's the same client)
        const existingPppoe = await this.prisma.client.findUnique({
          where: { pppoeUsername: updateConnectionTypeDto.pppoeUsername },
        });

        if (existingPppoe && existingPppoe.id !== client.id) {
          throw new ConflictException('PPPoE username already exists');
        }

        // Release static IP if assigned
        if (client.staticIp) {
          await this.prisma.staticIpPool.update({
            where: { id: client.staticIp.id },
            data: {
              clientId: null,
              status: IpStatus.AVAILABLE,
              assignedAt: null,
            },
          });
        }

        updateData.pppoeUsername = updateConnectionTypeDto.pppoeUsername;
        updateData.pppoePassword = updateConnectionTypeDto.pppoePassword;
        break;

      case ConnectionType.DYNAMIC:
        // Release static IP if assigned
        if (client.staticIp) {
          await this.prisma.staticIpPool.update({
            where: { id: client.staticIp.id },
            data: {
              clientId: null,
              status: IpStatus.AVAILABLE,
              assignedAt: null,
            },
          });
        }

        updateData.pppoeUsername = null;
        updateData.pppoePassword = null;
        break;
    }

    const updatedClient = await this.prisma.client.update({
      where: { id },
      data: updateData,
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
        entityType: EntityType.CLIENT,
        entityId: id,
        oldValues: { connectionType: client.connectionType },
        newValues: { connectionType: updateConnectionTypeDto.connectionType },
        description: 'Change connection type',
      });
    }

    return this.findOne(id, currentUser);
  }

  async assignStaticIp(clientId: string, staticIpId: string, currentUser?: any) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        staticIp: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    // POS_MANAGER can only manage clients from their POS
    if (currentUser?.role === 'POS_MANAGER' && currentUser?.posId !== client.posId) {
      throw new ForbiddenException('You can only manage clients from your own POS');
    }

    if (client.connectionType !== ConnectionType.STATIC) {
      throw new BadRequestException('Client connection type must be STATIC to assign a static IP');
    }

    const staticIp = await this.prisma.staticIpPool.findUnique({
      where: { id: staticIpId },
    });

    if (!staticIp) {
      throw new NotFoundException(`Static IP with ID ${staticIpId} not found`);
    }

    if (staticIp.posId !== client.posId) {
      throw new BadRequestException('Static IP must belong to the same POS as the client');
    }

    if (staticIp.status !== IpStatus.AVAILABLE && staticIp.clientId !== clientId) {
      throw new BadRequestException('Static IP is not available');
    }

    // Release previous static IP if different
    if (client.staticIp && client.staticIp.id !== staticIpId) {
      await this.prisma.staticIpPool.update({
        where: { id: client.staticIp.id },
        data: {
          clientId: null,
          status: IpStatus.AVAILABLE,
          assignedAt: null,
        },
      });
    }

    // Assign new static IP
    await this.prisma.staticIpPool.update({
      where: { id: staticIpId },
      data: {
        clientId: clientId,
        status: IpStatus.ASSIGNED,
        assignedAt: new Date(),
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
        entityId: staticIpId,
        oldValues: { clientId: staticIp.clientId, status: staticIp.status },
        newValues: { clientId: clientId, status: IpStatus.ASSIGNED },
        description: `Assign static IP to client ${clientId}`,
      });
    }

    return this.findOne(clientId, currentUser);
  }

  async releaseStaticIp(clientId: string, currentUser?: any) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        staticIp: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    // POS_MANAGER can only manage clients from their POS
    if (currentUser?.role === 'POS_MANAGER' && currentUser?.posId !== client.posId) {
      throw new ForbiddenException('You can only manage clients from your own POS');
    }

    if (!client.staticIp) {
      // No-op: client doesn't have a static IP assigned
      return this.findOne(clientId, currentUser);
    }

    const staticIpId = client.staticIp.id;

    // Release static IP
    await this.prisma.staticIpPool.update({
      where: { id: staticIpId },
      data: {
        clientId: null,
        status: IpStatus.AVAILABLE,
        assignedAt: null,
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
        entityId: staticIpId,
        oldValues: { clientId: clientId, status: client.staticIp.status },
        newValues: { clientId: null, status: IpStatus.AVAILABLE },
        description: `Release static IP from client ${clientId}`,
      });
    }

    return this.findOne(clientId, currentUser);
  }
}

