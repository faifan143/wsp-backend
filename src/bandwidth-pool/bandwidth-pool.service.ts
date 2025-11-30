import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UpdateBandwidthPoolDto } from './dto/update-bandwidth-pool.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditAction, EntityType, UserRole } from '@prisma/client';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';

@Injectable()
export class BandwidthPoolService {
  constructor(
    private prisma: PrismaService,
    private auditLogger: AuditLoggerService,
  ) {}

  private async getOrCreatePool() {
    let pool = await this.prisma.bandwidthPool.findFirst();

    if (!pool) {
      pool = await this.prisma.bandwidthPool.create({
        data: {
          totalWspBandwidthMbps: new Decimal(0),
          allocatedBandwidthMbps: new Decimal(0),
          availableBandwidthMbps: new Decimal(0),
          usagePercentage: new Decimal(0),
        },
      });
    }

    return pool;
  }

  async getSummary() {
    // Get or create the pool record
    const pool = await this.getOrCreatePool();

    // Compute total allocated bandwidth from all POSes
    const posAggregate = await this.prisma.pOS.aggregate({
      _sum: {
        allocatedBandwidthMbps: true,
      },
    });

    const totalAllocatedMbps = posAggregate._sum.allocatedBandwidthMbps || new Decimal(0);
    const totalBandwidthMbps = pool.totalWspBandwidthMbps;
    const allocatedMbps = totalAllocatedMbps;
    const remainingMbps = Decimal.max(
      totalBandwidthMbps.minus(allocatedMbps),
      new Decimal(0),
    );

    return {
      totalBandwidthMbps: totalBandwidthMbps.toNumber(),
      allocatedMbps: allocatedMbps.toNumber(),
      remainingMbps: remainingMbps.toNumber(),
      poolUpdatedAt: pool.lastUpdated,
    };
  }

  async update(dto: UpdateBandwidthPoolDto, currentUser?: any) {
    // Ensure pool exists and get it
    const pool = await this.getOrCreatePool();

    // Update total WSP bandwidth
    await this.prisma.bandwidthPool.update({
      where: { id: pool.id },
      data: {
        totalWspBandwidthMbps: new Decimal(dto.totalBandwidthMbps),
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
        entityType: EntityType.BANDWIDTH_POOL,
        entityId: pool.id,
        oldValues: { totalWspBandwidthMbps: pool.totalWspBandwidthMbps.toNumber() },
        newValues: { totalWspBandwidthMbps: dto.totalBandwidthMbps },
      });
    }

    // Return updated summary
    return this.getSummary();
  }
}

