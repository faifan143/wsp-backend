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

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private auditLogger: AuditLoggerService,
  ) {}

  private getManagerScope(currentUser: any): { posId?: string } | null {
    if (currentUser?.role === 'WSP_ADMIN') {
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
    const scope = this.getManagerScope(currentUser);
    if (scope && scope.posId !== clientPosId) {
      throw new ForbiddenException(
        `You can only ${operation} subscriptions for clients in your POS`,
      );
    }
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

    // Update subscription
    const renewedSubscription = await this.prisma.subscription.update({
      where: { id },
      data: {
        startDate: renewalStartDate,
        endDate: newEndDate,
        status: SubscriptionStatus.ACTIVE,
        isAutoRenewed: renewSubscriptionDto.isAutoRenewed ?? subscription.isAutoRenewed,
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

