import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { CreateUsageLogDto } from './dto/create-usage-log.dto';
import { SubscriptionStatus, ClientStatus, AuditAction, EntityType, UserRole, ConnectionType, ServiceType } from '@prisma/client';
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
   * Validate client connection type requirements
   */
  private async validateConnectionTypeRequirements(client: any) {
    if (client.connectionType === ConnectionType.STATIC) {
      // STATIC clients must have a static IP assigned
      const clientWithStaticIp = await this.prisma.client.findUnique({
        where: { id: client.id },
        include: { staticIp: true },
      });

      if (!clientWithStaticIp?.staticIp) {
        throw new BadRequestException(
          'STATIC connection type requires a static IP to be assigned to the client',
        );
      }
    } else if (client.connectionType === ConnectionType.PPPOE) {
      // PPPOE clients must have credentials
      if (!client.pppoeUsername || !client.pppoePassword) {
        throw new BadRequestException(
          'PPPOE connection type requires PPPoE username and password to be set',
        );
      }
    }
    // DYNAMIC clients have no special requirements
  }

  /**
   * Generate unique invoice number
   */
  private generateInvoiceNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `INV-${timestamp}-${random}`;
  }

  /**
   * Build invoice notes with connection type and subscription details
   */
  private buildInvoiceNotes(
    connectionType: ConnectionType,
    planName: string,
    startDate: Date,
    endDate: Date,
    client: any,
  ): string {
    const connectionDetails: string[] = [];
    
    if (connectionType === ConnectionType.STATIC && client.staticIp) {
      connectionDetails.push(`Static IP: ${client.staticIp.ipAddress}`);
    } else if (connectionType === ConnectionType.PPPOE && client.pppoeUsername) {
      connectionDetails.push(`PPPoE Username: ${client.pppoeUsername}`);
    }

    const notes = [
      `Connection Type: ${connectionType}`,
      `Plan: ${planName}`,
      `Subscription Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    ];

    if (connectionDetails.length > 0) {
      notes.push(`Connection Details: ${connectionDetails.join(', ')}`);
    }

    return notes.join('\n');
  }

  /**
   * Auto-generate invoice for subscription
   * This is called internally as part of subscription creation/renewal/upgrade
   */
  private async autoGenerateInvoice(
    subscriptionId: string,
    clientId: string,
    planCost: Decimal,
    startDate: Date,
    endDate: Date,
    connectionType: ConnectionType,
    planName: string,
    client: any,
    currentUser: any,
    tx?: any, // Transaction client (optional, uses this.prisma if not provided)
  ) {
    const prismaClient = tx || this.prisma;

    // Generate unique invoice number
    let invoiceNumber: string;
    let attempts = 0;
    do {
      invoiceNumber = this.generateInvoiceNumber();
      const existing = await prismaClient.invoice.findUnique({
        where: { invoiceNumber },
      });
      if (!existing) break;
      attempts++;
      if (attempts > 10) {
        throw new ConflictException('Failed to generate unique invoice number');
      }
    } while (true);

    // Calculate dates
    const issueDate = startDate;
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30); // 30 days payment terms

    // Build invoice notes
    const notes = this.buildInvoiceNotes(
      connectionType,
      planName,
      startDate,
      endDate,
      client,
    );

    // Create invoice
    const invoice = await prismaClient.invoice.create({
      data: {
        clientId,
        subscriptionId,
        invoiceNumber,
        amount: planCost,
        issueDate,
        dueDate,
        notes,
      },
    });

    // Audit log for invoice creation (only if not in transaction, or do it after transaction)
    // Note: Audit logs should be outside transaction to avoid rollback
    if (!tx) {
      await this.auditLogger.log({
        context: {
          userId: currentUser.id,
          userRole: currentUser.role as UserRole,
          ipAddress: null,
          userAgent: null,
        },
        action: AuditAction.CREATE,
        entityType: EntityType.INVOICE,
        entityId: invoice.id,
        oldValues: null,
        newValues: {
          invoiceNumber: invoice.invoiceNumber,
          clientId: invoice.clientId,
          subscriptionId: invoice.subscriptionId,
          amount: invoice.amount,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
        },
        description: `Auto-generated invoice for subscription ${subscriptionId}`,
      });
    }

    return invoice;
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
    // Fetch client with POS and static IP
    const client = await this.prisma.client.findUnique({
      where: { id: createSubscriptionDto.clientId },
      include: {
        pos: true,
        staticIp: true,
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

    // Validate connection type requirements
    await this.validateConnectionTypeRequirements(client);

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

    // Enforce PREPAID service type (all subscriptions must be PREPAID)
    if (servicePlan.serviceType !== ServiceType.PREPAID) {
      throw new BadRequestException(
        'Only PREPAID service plans are allowed. Payment is required upfront before service activation.',
      );
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

    // Use transaction to ensure atomicity: if invoice creation fails, subscription is rolled back
    let invoiceId: string | null = null;
    const subscription = await this.prisma.$transaction(async (tx) => {
      // Create subscription
      // Note: Status is ACTIVE but service is payment-gated (checked in usage logs)
      const newSubscription = await tx.subscription.create({
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
      });

      // Auto-generate invoice (if this fails, entire transaction rolls back)
      const invoice = await this.autoGenerateInvoice(
        newSubscription.id,
        client.id,
        servicePlan.cost,
        startDate,
        endDate,
        client.connectionType,
        servicePlan.planName,
        client,
        currentUser,
        tx, // Pass transaction client
      );
      invoiceId = invoice.id;

      // Return subscription with relations
      return tx.subscription.findUnique({
        where: { id: newSubscription.id },
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
              staticIp: true,
            },
          },
          plan: true,
          invoices: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1, // Get the latest invoice
          },
        },
      });
    });

    // Audit log for invoice (after transaction completes)
    if (invoiceId && subscription) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (invoice) {
        await this.auditLogger.log({
          context: {
            userId: currentUser.id,
            userRole: currentUser.role as UserRole,
            ipAddress: null,
            userAgent: null,
          },
          action: AuditAction.CREATE,
          entityType: EntityType.INVOICE,
          entityId: invoice.id,
          oldValues: null,
          newValues: {
            invoiceNumber: invoice.invoiceNumber,
            clientId: invoice.clientId,
            subscriptionId: invoice.subscriptionId,
            amount: invoice.amount,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
          },
          description: `Auto-generated invoice for subscription ${subscription.id}`,
        });
      }
    }

    // Audit log
    if (subscription) {
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
    }

    if (!subscription) {
      throw new BadRequestException('Failed to create subscription');
    }

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
        client: {
          include: {
            staticIp: true,
          },
        },
        plan: true,
        invoices: {
          include: {
            payments: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1, // Get latest invoice
        },
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

    // Check if current invoice is paid before allowing renewal (auto-renewal payment check)
    if (subscription.invoices && subscription.invoices.length > 0) {
      const latestInvoice = subscription.invoices[0];
      const totalPaid = latestInvoice.payments.reduce((sum, payment) => {
        return sum + Number(payment.amountPaid);
      }, 0);

      if (totalPaid < Number(latestInvoice.amount)) {
        throw new BadRequestException(
          `Cannot renew subscription. Current invoice (${latestInvoice.invoiceNumber}) is unpaid. Please pay the invoice first before renewing.`,
        );
      }
    }

    // Validate connection type requirements
    await this.validateConnectionTypeRequirements(subscription.client);

    // Enforce PREPAID service type
    if (subscription.plan.serviceType !== ServiceType.PREPAID) {
      throw new BadRequestException(
        'Only PREPAID service plans are allowed. Payment is required upfront before service activation.',
      );
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

    // Use transaction to ensure atomicity
    let invoiceId: string | null = null;
    const renewedSubscription = await this.prisma.$transaction(async (tx) => {
      // Update subscription - reset bandwidth on renewal (new period starts)
      const updatedSubscription = await tx.subscription.update({
        where: { id },
        data: {
          startDate: renewalStartDate,
          endDate: newEndDate,
          status: SubscriptionStatus.ACTIVE,
          isAutoRenewed: renewSubscriptionDto.isAutoRenewed ?? subscription.isAutoRenewed,
          bandwidthAllocatedMbps: subscription.plan.downloadSpeedMbps, // Restore to plan's original speed
          originalBandwidthMbps: subscription.plan.downloadSpeedMbps, // Reset original bandwidth for new period
        },
      });

      // Auto-generate invoice for renewal
      const invoice = await this.autoGenerateInvoice(
        updatedSubscription.id,
        subscription.clientId,
        subscription.plan.cost,
        renewalStartDate,
        newEndDate,
        subscription.client.connectionType,
        subscription.plan.planName,
        subscription.client,
        currentUser,
        tx, // Pass transaction client
      );
      invoiceId = invoice.id;

      // Return subscription with relations
      return tx.subscription.findUnique({
        where: { id: updatedSubscription.id },
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
              staticIp: true,
            },
          },
          plan: true,
          invoices: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1, // Get the latest invoice
          },
        },
      });
    });

    // Audit log for invoice (after transaction completes)
    if (invoiceId && renewedSubscription) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (invoice) {
        await this.auditLogger.log({
          context: {
            userId: currentUser.id,
            userRole: currentUser.role as UserRole,
            ipAddress: null,
            userAgent: null,
          },
          action: AuditAction.CREATE,
          entityType: EntityType.INVOICE,
          entityId: invoice.id,
          oldValues: null,
          newValues: {
            invoiceNumber: invoice.invoiceNumber,
            clientId: invoice.clientId,
            subscriptionId: invoice.subscriptionId,
            amount: invoice.amount,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
          },
          description: `Auto-generated invoice for subscription renewal ${renewedSubscription.id}`,
        });
      }
    }

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
        client: {
          include: {
            staticIp: true,
          },
        },
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

    // Validate connection type requirements
    await this.validateConnectionTypeRequirements(oldSubscription.client);

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

    // Enforce PREPAID service type
    if (newPlan.serviceType !== ServiceType.PREPAID) {
      throw new BadRequestException(
        'Only PREPAID service plans are allowed. Payment is required upfront before service activation.',
      );
    }

    // Check if upgrading to same plan
    if (oldSubscription.planId === upgradeSubscriptionDto.newPlanId) {
      throw new BadRequestException('Subscription is already using this plan');
    }

    // Prevent upgrade before subscription ends
    const now = new Date();
    if (oldSubscription.endDate > now) {
      throw new BadRequestException(
        `Cannot upgrade subscription before it ends. Current subscription ends on ${oldSubscription.endDate.toISOString().split('T')[0]}. Please wait until the subscription period ends.`,
      );
    }

    // Determine effective date (must be after current end date)
    const effectiveDate = upgradeSubscriptionDto.effectiveDate
      ? new Date(upgradeSubscriptionDto.effectiveDate)
      : new Date(oldSubscription.endDate);

    // Ensure effective date is not before current end date
    if (effectiveDate < oldSubscription.endDate) {
      throw new BadRequestException(
        `Upgrade effective date cannot be before current subscription end date (${oldSubscription.endDate.toISOString().split('T')[0]})`,
      );
    }

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

    // Use transaction to ensure atomicity
    let invoiceId: string | null = null;
    const newSubscription = await this.prisma.$transaction(async (tx) => {
      // Terminate old subscription
      await tx.subscription.update({
        where: { id },
        data: { status: SubscriptionStatus.TERMINATED },
      });

      // Create new subscription
      const createdSubscription = await tx.subscription.create({
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
      });

      // Link old subscription to new one
      await tx.subscription.update({
        where: { id },
        data: { upgradedToSubscriptionId: createdSubscription.id },
      });

      // Auto-generate invoice for upgrade
      const invoice = await this.autoGenerateInvoice(
        createdSubscription.id,
        oldSubscription.clientId,
        newPlan.cost,
        effectiveDate,
        newEndDate,
        oldSubscription.client.connectionType,
        newPlan.planName,
        oldSubscription.client,
        currentUser,
        tx, // Pass transaction client
      );
      invoiceId = invoice.id;

      // Return subscription with relations
      return tx.subscription.findUnique({
        where: { id: createdSubscription.id },
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
              staticIp: true,
            },
          },
          plan: true,
          invoices: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1, // Get the latest invoice
          },
        },
      });
    });

    // Audit log for invoice (after transaction completes)
    if (invoiceId && newSubscription) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (invoice) {
        await this.auditLogger.log({
          context: {
            userId: currentUser.id,
            userRole: currentUser.role as UserRole,
            ipAddress: null,
            userAgent: null,
          },
          action: AuditAction.CREATE,
          entityType: EntityType.INVOICE,
          entityId: invoice.id,
          oldValues: null,
          newValues: {
            invoiceNumber: invoice.invoiceNumber,
            clientId: invoice.clientId,
            subscriptionId: invoice.subscriptionId,
            amount: invoice.amount,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
          },
          description: `Auto-generated invoice for subscription upgrade ${newSubscription.id}`,
        });
      }
    }

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
      entityId: newSubscription?.id || id,
      oldValues: {
        subscriptionId: id,
        planId: oldSubscription.planId,
        planName: oldSubscription.plan.planName,
      },
      newValues: {
        subscriptionId: newSubscription?.id || '',
        planId: newPlan.id,
        planName: newPlan.planName,
      },
      description: `Upgrade subscription from plan ${oldSubscription.plan.planName} to ${newPlan.planName}`,
    });

    if (!newSubscription) {
      throw new BadRequestException('Failed to upgrade subscription');
    }

    return newSubscription;
  }

  /**
   * Check if subscription invoice is paid (payment-gated service)
   */
  private async isSubscriptionInvoicePaid(subscriptionId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        invoices: {
          include: {
            payments: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1, // Get the latest invoice
        },
      },
    });

    if (!subscription || !subscription.invoices || subscription.invoices.length === 0) {
      return false; // No invoice means not paid
    }

    const latestInvoice = subscription.invoices[0];
    const totalPaid = latestInvoice.payments.reduce((sum, payment) => {
      return sum + Number(payment.amountPaid);
    }, 0);

    return totalPaid >= Number(latestInvoice.amount);
  }

  /**
   * Check and mark expired subscriptions
   * This should be called manually or via scheduled job
   */
  async checkAndMarkExpiredSubscriptions() {
    const now = new Date();
    const expiredSubscriptions = await this.prisma.subscription.findMany({
      where: {
        endDate: { lt: now },
        status: SubscriptionStatus.ACTIVE,
      },
      include: {
        client: true,
        invoices: {
          include: {
            payments: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    const results: Array<{
      subscriptionId: string;
      clientId: string;
      action: string;
      message: string;
    }> = [];

    for (const subscription of expiredSubscriptions) {
      // Check if invoice is unpaid
      const isPaid = subscription.invoices && subscription.invoices.length > 0
        ? subscription.invoices[0].payments.reduce((sum, p) => sum + Number(p.amountPaid), 0) >= Number(subscription.invoices[0].amount)
        : false;

      // Mark as EXPIRED
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.EXPIRED },
      });

      // Suspend client service if subscription expired with unpaid invoice
      if (!isPaid && subscription.client.status === ClientStatus.ACTIVE) {
        // Note: Client suspension should be handled separately via clients service
        // This is just for tracking
        results.push({
          subscriptionId: subscription.id,
          clientId: subscription.clientId,
          action: 'EXPIRED_UNPAID',
          message: 'Subscription expired with unpaid invoice. Client service should be suspended.',
        });
      } else {
        results.push({
          subscriptionId: subscription.id,
          clientId: subscription.clientId,
          action: 'EXPIRED',
          message: 'Subscription expired. Ready for renewal.',
        });
      }
    }

    return results;
  }

  async createUsageLog(subscriptionId: string, createUsageLogDto: CreateUsageLogDto, currentUser: any) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        client: true,
        invoices: {
          include: {
            payments: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
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

    // Ensure subscription is not expired
    if (subscription.status === SubscriptionStatus.EXPIRED) {
      throw new BadRequestException('Cannot log usage for an expired subscription. Please renew the subscription.');
    }

    // Check if client is suspended (logical solution for scenario 5.3)
    if (subscription.client.status === ClientStatus.SUSPENDED) {
      throw new BadRequestException(
        'Cannot log usage for a suspended client. Service is disconnected. Please reactivate the client first.',
      );
    }

    // Payment-gated service: Check if invoice is paid
    const isPaid = await this.isSubscriptionInvoicePaid(subscriptionId);
    if (!isPaid) {
      throw new BadRequestException(
        'Service is not active. Payment is required before service can be used. Please pay the invoice first.',
      );
    }

    // Validate subscription period
    const logDate = new Date(createUsageLogDto.logDate);
    if (logDate < subscription.startDate || logDate > subscription.endDate) {
      throw new BadRequestException(
        'Usage log date is outside the subscription period. Please check subscription dates.',
      );
    }

    // Validate log date is not in the future
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

