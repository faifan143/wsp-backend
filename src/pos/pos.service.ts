import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreatePosDto {
  name: string;
  location: string;
  contactPhone?: string;
  allocatedBandwidthMbps: number;
}

export interface UpdatePosDto {
  name?: string;
  location?: string;
  contactPhone?: string;
  allocatedBandwidthMbps?: number;
  isActive?: boolean;
}

@Injectable()
export class PosService {
  constructor(private prisma: PrismaService) {}

  async create(createPosDto: CreatePosDto) {
    // Validate bandwidth allocation
    await this.validateBandwidthAllocation(createPosDto.allocatedBandwidthMbps);

    return this.prisma.pOS.create({
      data: {
        name: createPosDto.name,
        location: createPosDto.location,
        contactPhone: createPosDto.contactPhone,
        allocatedBandwidthMbps: new Decimal(createPosDto.allocatedBandwidthMbps),
        currentUsageMbps: new Decimal(0),
      },
      include: {
        clients: {
          include: {
            subscriptions: {
              where: { status: 'ACTIVE' },
              include: { plan: true }
            }
          }
        },
        managers: true,
        _count: {
          select: {
            clients: true,
            managers: true
          }
        }
      }
    });
  }

  async findAll() {
    return this.prisma.pOS.findMany({
      include: {
        clients: {
          include: {
            subscriptions: {
              where: { status: 'ACTIVE' },
              include: { plan: true }
            }
          }
        },
        managers: true,
        _count: {
          select: {
            clients: true,
            managers: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async findOne(id: string) {
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
      include: {
        clients: {
          include: {
            subscriptions: {
              where: { status: 'ACTIVE' },
              include: { plan: true }
            }
          }
        },
        managers: true,
        ipPool: {
          where: { status: 'ASSIGNED' },
          include: { client: true }
        },
        _count: {
          select: {
            clients: true,
            managers: true,
            ipPool: true
          }
        }
      }
    });

    if (!pos) {
      throw new NotFoundException('POS not found');
    }

    return pos;
  }

  async update(id: string, updatePosDto: UpdatePosDto) {
    const pos = await this.findOne(id);

    // Validate bandwidth allocation if being updated
    if (updatePosDto.allocatedBandwidthMbps) {
      await this.validateBandwidthAllocation(updatePosDto.allocatedBandwidthMbps, id);
    }

    const updateData: any = { ...updatePosDto };
    if (updatePosDto.allocatedBandwidthMbps) {
      updateData.allocatedBandwidthMbps = new Decimal(updatePosDto.allocatedBandwidthMbps);
    }

    return this.prisma.pOS.update({
      where: { id },
      data: updateData,
      include: {
        clients: {
          include: {
            subscriptions: {
              where: { status: 'ACTIVE' },
              include: { plan: true }
            }
          }
        },
        managers: true,
        _count: {
          select: {
            clients: true,
            managers: true
          }
        }
      }
    });
  }

  async remove(id: string) {
    const pos = await this.findOne(id);

    // Check if POS has active clients
    const activeClients = await this.prisma.client.count({
      where: {
        posId: id,
        status: 'ACTIVE'
      }
    });

    if (activeClients > 0) {
      throw new BadRequestException('Cannot delete POS with active clients');
    }

    return this.prisma.pOS.delete({
      where: { id }
    });
  }

  async getStatistics(id: string) {
    const pos = await this.findOne(id);

    // Calculate current bandwidth usage
    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        client: {
          posId: id
        }
      },
      include: { plan: true }
    });

    const currentUsage = activeSubscriptions.reduce((total, sub) => {
      return total + Number(sub.bandwidthAllocatedMbps);
    }, 0);

    // Update current usage
    await this.prisma.pOS.update({
      where: { id },
      data: { currentUsageMbps: new Decimal(currentUsage) }
    });

    return {
      ...pos,
      currentUsageMbps: currentUsage,
      availableBandwidthMbps: Number(pos.allocatedBandwidthMbps) - currentUsage,
      usagePercentage: (currentUsage / Number(pos.allocatedBandwidthMbps)) * 100,
      activeClients: activeSubscriptions.length,
      totalRevenue: await this.calculateTotalRevenue(id)
    };
  }

  private async validateBandwidthAllocation(newBandwidth: number, excludePosId?: string) {
    // Get total WSP bandwidth
    const bandwidthPool = await this.prisma.bandwidthPool.findFirst();
    if (!bandwidthPool) {
      throw new BadRequestException('Bandwidth pool not configured');
    }

    // Get current total allocation
    const currentAllocation = await this.prisma.pOS.aggregate({
      _sum: {
        allocatedBandwidthMbps: true
      },
      where: excludePosId ? { id: { not: excludePosId } } : {}
    });

    const currentTotal = currentAllocation._sum.allocatedBandwidthMbps || 0;
    const newTotal = Number(currentTotal) + newBandwidth;

    if (newTotal > Number(bandwidthPool.totalWspBandwidthMbps)) {
      throw new BadRequestException(
        `Insufficient bandwidth. Available: ${Number(bandwidthPool.totalWspBandwidthMbps) - Number(currentTotal)} Mbps, Requested: ${newBandwidth} Mbps`
      );
    }
  }

  private async calculateTotalRevenue(posId: string) {
    const payments = await this.prisma.payment.aggregate({
      _sum: {
        amountPaid: true
      },
      where: {
        client: {
          posId: posId
        }
      }
    });

    return payments._sum.amountPaid || 0;
  }
}
