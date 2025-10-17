import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectionType, ClientStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export interface CreateClientDto {
  posId: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  nationalId?: string;
  connectionType: ConnectionType;
}

export interface UpdateClientDto {
  fullName?: string;
  phone?: string;
  email?: string;
  address?: string;
  nationalId?: string;
  status?: ClientStatus;
  autoRenewEnabled?: boolean;
}

@Injectable()
export class ClientService {
  constructor(private prisma: PrismaService) {}

  async create(createClientDto: CreateClientDto) {
    // Check if email already exists
    const existingClient = await this.prisma.client.findUnique({
      where: { email: createClientDto.email }
    });

    if (existingClient) {
      throw new ConflictException('Email already exists');
    }

    // Handle different connection types
    if (createClientDto.connectionType === ConnectionType.STATIC) {
      return this.createStaticClient(createClientDto);
    } else if (createClientDto.connectionType === ConnectionType.PPPOE) {
      return this.createPppoeClient(createClientDto);
    } else {
      return this.createDynamicClient(createClientDto);
    }
  }

  private async createStaticClient(createClientDto: CreateClientDto) {
    // Find available static IP
    const availableIp = await this.prisma.staticIpPool.findFirst({
      where: {
        posId: createClientDto.posId,
        status: 'AVAILABLE'
      }
    });

    if (!availableIp) {
      throw new BadRequestException('No available static IPs for this POS');
    }

    // Use transaction for atomicity
    return await this.prisma.$transaction(async (tx) => {
      // Create client
      const client = await tx.client.create({
        data: {
          posId: createClientDto.posId,
          fullName: createClientDto.fullName,
          phone: createClientDto.phone,
          email: createClientDto.email,
          address: createClientDto.address,
          nationalId: createClientDto.nationalId,
          connectionType: createClientDto.connectionType,
        },
        include: {
          pos: true,
          staticIp: true
        }
      });

      // Assign static IP
      await tx.staticIpPool.update({
        where: { id: availableIp.id },
        data: {
          status: 'ASSIGNED',
          clientId: client.id,
          assignedAt: new Date()
        }
      });

      // Fetch client with updated IP info
      return await tx.client.findUnique({
        where: { id: client.id },
        include: {
          pos: true,
          staticIp: true
        }
      });
    });
  }

  private async createPppoeClient(createClientDto: CreateClientDto) {
    // Generate PPPoE credentials
    const pos = await this.prisma.pOS.findUnique({
      where: { id: createClientDto.posId }
    });

    if (!pos) {
      throw new NotFoundException('POS not found');
    }

    const username = this.generatePppoeUsername(createClientDto.fullName, pos.name);
    const password = this.generateSecurePassword();
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if username already exists
    const existingUsername = await this.prisma.client.findUnique({
      where: { pppoeUsername: username }
    });

    if (existingUsername) {
      throw new ConflictException('PPPoE username already exists');
    }

    const client = await this.prisma.client.create({
      data: {
        posId: createClientDto.posId,
        fullName: createClientDto.fullName,
        phone: createClientDto.phone,
        email: createClientDto.email,
        address: createClientDto.address,
        nationalId: createClientDto.nationalId,
        connectionType: createClientDto.connectionType,
        pppoeUsername: username,
        pppoePassword: hashedPassword,
      },
      include: {
        pos: true
      }
    });

    // Return client with plain password (only returned once)
    return {
      ...client,
      temporaryPassword: password
    };
  }

  private async createDynamicClient(createClientDto: CreateClientDto) {
    return this.prisma.client.create({
      data: {
        posId: createClientDto.posId,
        fullName: createClientDto.fullName,
        phone: createClientDto.phone,
        email: createClientDto.email,
        address: createClientDto.address,
        nationalId: createClientDto.nationalId,
        connectionType: createClientDto.connectionType,
      },
      include: {
        pos: true
      }
    });
  }

  async findAll(posId?: string) {
    return this.prisma.client.findMany({
      where: posId ? { posId } : {},
      include: {
        pos: true,
        staticIp: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: true }
        },
        _count: {
          select: {
            subscriptions: true,
            invoices: true,
            payments: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        pos: true,
        staticIp: true,
        subscriptions: {
          include: { plan: true }
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        suspensionHistory: {
          orderBy: { suspendedAt: 'desc' }
        }
      }
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async update(id: string, updateClientDto: UpdateClientDto) {
    const client = await this.findOne(id);

    // Check if new email conflicts with existing clients
    if (updateClientDto.email && updateClientDto.email !== client.email) {
      const existingClient = await this.prisma.client.findUnique({
        where: { email: updateClientDto.email }
      });

      if (existingClient) {
        throw new ConflictException('Email already exists');
      }
    }

    return this.prisma.client.update({
      where: { id },
      data: updateClientDto,
      include: {
        pos: true,
        staticIp: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: true }
        }
      }
    });
  }

  async remove(id: string) {
    const client = await this.findOne(id);

    // Check if client has active subscriptions
    const activeSubscriptions = await this.prisma.subscription.count({
      where: {
        clientId: id,
        status: 'ACTIVE'
      }
    });

    if (activeSubscriptions > 0) {
      throw new BadRequestException('Cannot delete client with active subscriptions');
    }

    // Release static IP if assigned
    if (client.connectionType === ConnectionType.STATIC && client.staticIp) {
      await this.prisma.staticIpPool.update({
        where: { id: client.staticIp.id },
        data: {
          status: 'AVAILABLE',
          clientId: null,
          assignedAt: null
        }
      });
    }

    return this.prisma.client.delete({
      where: { id }
    });
  }

  async suspend(id: string, reason: string, suspendedBy: string) {
    const client = await this.findOne(id);

    if (client.status === ClientStatus.SUSPENDED) {
      throw new BadRequestException('Client is already suspended');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Update client status
      const updatedClient = await tx.client.update({
        where: { id },
        data: { status: ClientStatus.SUSPENDED }
      });

      // Log suspension
      await tx.suspensionHistory.create({
        data: {
          clientId: id,
          suspensionReason: 'OTHER',
          reasonDetails: reason,
          suspendedAt: new Date(),
          suspendedBy: suspendedBy
        }
      });

      return updatedClient;
    });
  }

  async reactivate(id: string, reactivatedBy: string) {
    const client = await this.findOne(id);

    if (client.status !== ClientStatus.SUSPENDED) {
      throw new BadRequestException('Client is not suspended');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Update client status
      const updatedClient = await tx.client.update({
        where: { id },
        data: { status: ClientStatus.ACTIVE }
      });

      // Update suspension record
      const suspensionRecord = await tx.suspensionHistory.findFirst({
        where: {
          clientId: id,
          reactivatedAt: null
        },
        orderBy: { suspendedAt: 'desc' }
      });

      if (suspensionRecord) {
        await tx.suspensionHistory.update({
          where: { id: suspensionRecord.id },
          data: {
            reactivatedAt: new Date(),
            reactivatedBy: reactivatedBy
          }
        });
      }

      return updatedClient;
    });
  }

  private generatePppoeUsername(fullName: string, posName: string): string {
    const cleanName = fullName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPos = posName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    return `${cleanName}@${cleanPos}${randomSuffix}`;
  }

  private generateSecurePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
