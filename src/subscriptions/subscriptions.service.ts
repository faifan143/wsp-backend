import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { CreateUsageLogDto } from './dto/create-usage-log.dto';
import { SubscriptionStatus, ClientStatus, AuditAction, EntityType, UserRole } from '@prisma/client';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private auditLogger: AuditLoggerService,
  ) {}

  private getManagerScope(currentUser: any): { posId?: string } | null {
    // WSP_ADMIN and SUB_ADMIN have full access (no POS restriction)
    if (currentUser?.role === 'WSP_ADMIN' || currentUser?.role === 'SUB_ADMIN') {
      return null; // No restriction
    }
    if (currentUser?.role === 'POS_MANAGER' && currentUser?.posId) {
      return { posId: currentUser.posId };
    }
    return null;
  }

  private async enforcePosScope(
    clientPosId: string,
    currentUser: any,
    operation: string,
  ) {
    // WSP_ADMIN and SUB_ADMIN have full access (checked by capabilities)
    if (currentUser?.role === 'WSP_ADMIN' || currentUser?.role === 'SUB_ADMIN') {
      return; // No restriction
    }
    const scope = this.getManagerScope(currentUser);
    if (scope && scope.posId !== clientPosId) {
      throw new ForbiddenException(
        `You can only ${operation} subscriptions for clients in your POS`,
      );
    }
  }

  /**
   * Calculate total data usage (in GB) for the current subscription period
   */
  private async calculateCurrentPeriodUsage(subscriptionId: string): Promise<number> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: {
        startDate: true,
        endDate: true,
      },
    });

    if (!subscription) {
      return 0;
    }

    // Aggregate usage logs for the current period
    const usageLogs = await this.prisma.usageLog.findMany({
      where: {
        subscriptionId,
        logDate: {
          gte: subscription.startDate,
          lte: subscription.endDate,
        },
      },
      select: {
        downloadMb: true,
        uploadMb: true,
      },
    });

    // Sum all usage logs for the current period
    const totalUsageMb = usageLogs.reduce((sum, log) => {
      return sum + log.downloadMb.toNumber() + log.uploadMb.toNumber();
    }, 0);

    // Convert MB to GB (1 GB = 1024 MB)
    return totalUsageMb / 1024;
  }

  /**
   * Check if subscription has exceeded data capacity and apply throttling if needed
   */
  private async checkAndApplyThrottling(subscriptionId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
      },
    });

    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      return false;
    }

    // Only apply throttling if plan has a data capacity limit
    if (!subscription.plan.dataCapacityGb) {
      return false;
    }

    // Calculate current period usage
    const totalUsageGb = await this.calculateCurrentPeriodUsage(subscriptionId);
    const capacityLimitGb = subscription.plan.dataCapacityGb;

    // Check if capacity is exceeded
    if (totalUsageGb <= capacityLimitGb) {
      return false;
    }

    // Determine original bandwidth
    // If originalBandwidthMbps is set, use it; otherwise use current bandwidth as original
    const originalBandwidth = subscription.originalBandwidthMbps || subscription.bandwidthAllocatedMbps;
    const originalBandwidthNum = originalBandwidth.toNumber();
    const currentBandwidthNum = subscription.bandwidthAllocatedMbps.toNumber();

    // Check if already throttled (current bandwidth is less than original)
    if (currentBandwidthNum < originalBandwidthNum) {
      return false; // Already throttled, no action needed
    }

    // Calculate throttled speed (25% of original)
    const throttledSpeed = new Decimal(originalBandwidthNum * 0.25);

    // Apply throttling - store original bandwidth if not already stored
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        bandwidthAllocatedMbps: throttledSpeed,
        originalBandwidthMbps: subscription.originalBandwidthMbps || subscription.bandwidthAllocatedMbps,
      },
    });

    // Audit log
    await this.auditLogger.log({
      context: {
        userId: null, // System action
        userRole: UserRole.WSP_ADMIN, // System role
        ipAddress: null,
        userAgent: null,
      },
      action: AuditAction.UPDATE,
      entityType: EntityType.SUBSCRIPTION,
      entityId: subscriptionId,
      oldValues: {
        bandwidthAllocatedMbps: originalBandwidth.toNumber(),
      },
      newValues: {
        bandwidthAllocatedMbps: throttledSpeed.toNumber(),
      },
      description: `Bandwidth throttled to 25% due to data capacity exceeded (${totalUsageGb.toFixed(2)} GB / ${capacityLimitGb} GB)`,
    });

    return true;
  }

  /**
   * Restore bandwidth to original value
   */
  private async restoreBandwidth(subscriptionId: string, reason: string, currentUser?: any): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || !subscription.originalBandwidthMbps) {
      return false; // No original bandwidth stored, nothing to restore
    }

    // Check if already at original bandwidth
    if (subscription.bandwidthAllocatedMbps.toNumber() >= subscription.originalBandwidthMbps.toNumber()) {
      return false; // Already restored
    }

    const originalBandwidth = subscription.originalBandwidthMbps;

    // Restore bandwidth and clear original (since it's restored)
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        bandwidthAllocatedMbps: originalBandwidth,
        originalBandwidthMbps: null, // Clear original since bandwidth is restored
      },
    });

    // Audit log
    await this.auditLogger.log({
      context: {
        userId: currentUser?.id || undefined,
        userRole: (currentUser?.role as UserRole) || UserRole.WSP_ADMIN,
        ipAddress: null,
        userAgent: null,
      },
      action: AuditAction.UPDATE,
      entityType: EntityType.SUBSCRIPTION,
      entityId: subscriptionId,
      oldValues: {
        bandwidthAllocatedMbps: subscription.bandwidthAllocatedMbps.toNumber(),
      },
      newValues: {
        bandwidthAllocatedMbps: originalBandwidth.toNumber(),
      },
      description: `Bandwidth restored to original. Reason: ${reason}`,
    });

    return true;
  }

  async create(createSubscriptionDto: CreateSubscriptionDto, currentUser: any) {
    // Fetch client with POS
    const client = await this.prisma.client.findUnique({
      where: { id: createSubscriptionDto.clientId },
      include: {
        pos: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${createSubscriptionDto.clientId} not found`);
    }

    // Enforce RBAC
    await this.enforcePosScope(client.posId, currentUser, 'create');

    // Ensure client is not terminated
    if (client.status === ClientStatus.TERMINATED) {
      throw new BadRequestException('Cannot create subscription for a terminated client');
    }

    // Fetch service plan
    const servicePlan = await this.prisma.servicePlan.findUnique({
      where: { id: createSubscriptionDto.planId },
    });

    if (!servicePlan) {
      throw new NotFoundException(`Service plan with ID ${createSubscriptionDto.planId} not found`);
    }

    if (!servicePlan.isActive) {
      throw new BadRequestException('Service plan is not active');
    }

    // Check for existing active subscription
    const existingActiveSubscription = await this.prisma.subscription.findFirst({
      where: {
        clientId: createSubscriptionDto.clientId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (existingActiveSubscription) {
      throw new BadRequestException('Client already has an active subscription');
    }

    // Determine start date
    const startDate = createSubscriptionDto.startDate
      ? new Date(createSubscriptionDto.startDate)
      : new Date();

    // Calculate end date
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + servicePlan.durationDays);

    // Create subscription
    const subscription = await this.prisma.subscription.create({
      data: {
        clientId: createSubscriptionDto.clientId,
        planId: createSubscriptionDto.planId,
        startDate,
        endDate,
        status: SubscriptionStatus.ACTIVE,
        bandwidthAllocatedMbps: servicePlan.downloadSpeedMbps,
        originalBandwidthMbps: servicePlan.downloadSpeedMbps, // Store original bandwidth
        isAutoRenewed: createSubscriptionDto.isAutoRenewed ?? false,
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
        plan: true,
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
      entityType: EntityType.SUBSCRIPTION,
      entityId: subscription.id,
      oldValues: null,
      newValues: {
        clientId: subscription.clientId,
        planId: subscription.planId,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
      },
    });

    return subscription;
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

    // POS_MANAGER scope
    const scope = this.getManagerScope(currentUser);
    if (scope) {
      // Filter by clients in the manager's POS
      whereClause.client = {
        posId: scope.posId,
      };
    } else if (query.posId) {
      // WSP_ADMIN can filter by POS
      whereClause.client = {
        posId: query.posId,
      };
    }

    const subscriptions = await this.prisma.subscription.findMany({
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
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return subscriptions;
  }

  async findOne(id: string, currentUser: any) {
    const subscription = await this.prisma.subscription.findUnique({
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
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    // Enforce RBAC
    await this.enforcePosScope(subscription.client.posId, currentUser, 'view');

    return subscription;
  }

  async terminate(id: string, currentUser: any) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    // Enforce RBAC
    await this.enforcePosScope(subscription.client.posId, currentUser, 'terminate');

    if (subscription.status === SubscriptionStatus.TERMINATED) {
      return subscription;
    }

    const terminatedSubscription = await this.prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.TERMINATED },
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
        plan: true,
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
      entityType: EntityType.SUBSCRIPTION,
      entityId: id,
      oldValues: { status: subscription.status },
      newValues: { status: SubscriptionStatus.TERMINATED },
      description: 'Terminate subscription',
    });

    return terminatedSubscription;
  }

  async renew(id: string, renewSubscriptionDto: RenewSubscriptionDto, currentUser: any) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        client: true,
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    // Enforce RBAC
    await this.enforcePosScope(subscription.client.posId, currentUser, 'renew');

    // Ensure client is not terminated
    if (subscription.client.status === ClientStatus.TERMINATED) {
      throw new BadRequestException('Cannot renew subscription for a terminated client');
    }

    // Ensure subscription is not terminated
    if (subscription.status === SubscriptionStatus.TERMINATED) {
      throw new BadRequestException('Cannot renew a terminated subscription');
    }

    // Determine renewal start date
    const renewalStartDate = renewSubscriptionDto.renewalDate
      ? new Date(renewSubscriptionDto.renewalDate)
      : new Date(subscription.endDate);

    // Calculate new end date
    const newEndDate = new Date(renewalStartDate);
    newEndDate.setDate(newEndDate.getDate() + subscription.plan.durationDays);

    // Check for other active subscriptions (should not exist, but double-check)
    const otherActiveSubscription = await this.prisma.subscription.findFirst({
      where: {
        clientId: subscription.clientId,
        status: SubscriptionStatus.ACTIVE,
        NOT: { id },
      },
    });

    if (otherActiveSubscription) {
      throw new BadRequestException('Client already has another active subscription');
    }

    // Update subscription - reset bandwidth on renewal (new period starts)
    // This restores bandwidth if it was throttled and resets the original bandwidth
    const renewedSubscription = await this.prisma.subscription.update({
      where: { id },
      data: {
        startDate: renewalStartDate,
        endDate: newEndDate,
        status: SubscriptionStatus.ACTIVE,
        isAutoRenewed: renewSubscriptionDto.isAutoRenewed ?? subscription.isAutoRenewed,
        bandwidthAllocatedMbps: subscription.plan.downloadSpeedMbps, // Restore to plan's original speed
        originalBandwidthMbps: subscription.plan.downloadSpeedMbps, // Reset original bandwidth for new period
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
        plan: true,
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
      entityType: EntityType.SUBSCRIPTION,
      entityId: id,
      oldValues: {
        startDate: subscription.startDate,
        endDate: subscription.endDate,
      },
      newValues: {
        startDate: renewalStartDate,
        endDate: newEndDate,
      },
      description: 'Renew subscription',
    });

    return renewedSubscription;
  }

  async upgrade(id: string, upgradeSubscriptionDto: UpgradeSubscriptionDto, currentUser: any) {
    const oldSubscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        client: true,
        plan: true,
      },
    });

    if (!oldSubscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    // Enforce RBAC
    await this.enforcePosScope(oldSubscription.client.posId, currentUser, 'upgrade');

    // Ensure subscription is not terminated
    if (oldSubscription.status === SubscriptionStatus.TERMINATED) {
      throw new BadRequestException('Cannot upgrade a terminated subscription');
    }

    // Fetch new plan
    const newPlan = await this.prisma.servicePlan.findUnique({
      where: { id: upgradeSubscriptionDto.newPlanId },
    });

    if (!newPlan) {
      throw new NotFoundException(`Service plan with ID ${upgradeSubscriptionDto.newPlanId} not found`);
    }

    if (!newPlan.isActive) {
      throw new BadRequestException('New service plan is not active');
    }

    // Check if upgrading to same plan
    if (oldSubscription.planId === upgradeSubscriptionDto.newPlanId) {
      throw new BadRequestException('Subscription is already using this plan');
    }

    // Determine effective date
    const effectiveDate = upgradeSubscriptionDto.effectiveDate
      ? new Date(upgradeSubscriptionDto.effectiveDate)
      : new Date();

    // Check for other active subscriptions
    const otherActiveSubscription = await this.prisma.subscription.findFirst({
      where: {
        clientId: oldSubscription.clientId,
        status: SubscriptionStatus.ACTIVE,
        NOT: { id },
      },
    });

    if (otherActiveSubscription) {
      throw new BadRequestException('Client already has another active subscription');
    }

    // Calculate new end date
    const newEndDate = new Date(effectiveDate);
    newEndDate.setDate(newEndDate.getDate() + newPlan.durationDays);

    // Terminate old subscription
    await this.prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.TERMINATED },
    });

    // Create new subscription
    const newSubscription = await this.prisma.subscription.create({
      data: {
        clientId: oldSubscription.clientId,
        planId: newPlan.id,
        startDate: effectiveDate,
        endDate: newEndDate,
        status: SubscriptionStatus.ACTIVE,
        bandwidthAllocatedMbps: newPlan.downloadSpeedMbps,
        originalBandwidthMbps: newPlan.downloadSpeedMbps, // Store original bandwidth for new plan
        isAutoRenewed: false,
        upgradedToSubscriptionId: null,
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
        plan: true,
      },
    });

    // Link old subscription to new one
    await this.prisma.subscription.update({
      where: { id },
      data: { upgradedToSubscriptionId: newSubscription.id },
    });

    // Audit log
    await this.auditLogger.log({
      context: {
        userId: currentUser.id,
        userRole: currentUser.role as UserRole,
        ipAddress: null,
        userAgent: null,
      },
      action: AuditAction.UPGRADE,
      entityType: EntityType.SUBSCRIPTION,
      entityId: newSubscription.id,
      oldValues: {
        subscriptionId: id,
        planId: oldSubscription.planId,
        planName: oldSubscription.plan.planName,
      },
      newValues: {
        subscriptionId: newSubscription.id,
        planId: newPlan.id,
        planName: newPlan.planName,
      },
      description: `Upgrade subscription from plan ${oldSubscription.plan.planName} to ${newPlan.planName}`,
    });

    return newSubscription;
  }

  async createUsageLog(subscriptionId: string, createUsageLogDto: CreateUsageLogDto, currentUser: any) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        client: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${subscriptionId} not found`);
    }

    // Enforce RBAC
    await this.enforcePosScope(subscription.client.posId, currentUser, 'log usage for');

    // Ensure subscription is not terminated
    if (subscription.status === SubscriptionStatus.TERMINATED) {
      throw new BadRequestException('Cannot log usage for a terminated subscription');
    }

    // Validate log date is not in the future
    const logDate = new Date(createUsageLogDto.logDate);
    const now = new Date();
    if (logDate > now) {
      throw new BadRequestException('Log date cannot be in the future');
    }

    // Create usage log
    const usageLog = await this.prisma.usageLog.create({
      data: {
        subscriptionId,
        downloadMb: createUsageLogDto.downloadMb,
        uploadMb: createUsageLogDto.uploadMb,
        logDate,
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
      entityType: EntityType.USAGE_LOG,
      entityId: usageLog.id,
      oldValues: null,
      newValues: {
        subscriptionId,
        downloadMb: usageLog.downloadMb,
        uploadMb: usageLog.uploadMb,
        logDate: usageLog.logDate,
      },
    });

    // Check and apply throttling if data capacity exceeded
    await this.checkAndApplyThrottling(subscriptionId);

    return usageLog;
  }

  async getUsageLogs(subscriptionId: string, currentUser: any) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        client: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${subscriptionId} not found`);
    }

    // Enforce RBAC
    await this.enforcePosScope(subscription.client.posId, currentUser, 'view usage logs for');

    const usageLogs = await this.prisma.usageLog.findMany({
      where: { subscriptionId },
      orderBy: { logDate: 'asc' },
    });

    return usageLogs;
  }
}

