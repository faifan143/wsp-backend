import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AuditAction, EntityType, UserRole, SubscriptionStatus } from '@prisma/client';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private auditLogger: AuditLoggerService,
  ) {}

  private async enforcePosScope(invoiceClientPosId: string, currentUser: any, operation: string) {
    // WSP_ADMIN and SUB_ADMIN have full access (checked by capabilities)
    if (currentUser?.role === 'WSP_ADMIN' || currentUser?.role === 'SUB_ADMIN') {
      return; // No restriction
    }

    if (currentUser?.role === 'POS_MANAGER' && currentUser?.posId !== invoiceClientPosId) {
      throw new ForbiddenException(
        `You can only ${operation} payments for invoices of clients in your POS`,
      );
    }

    if (currentUser?.role === 'CLIENT') {
      throw new ForbiddenException('CLIENT role cannot create or manage payments');
    }
  }

  async create(createPaymentDto: CreatePaymentDto, currentUser: any) {
    // Fetch invoice with client
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: createPaymentDto.invoiceId },
      include: {
        client: {
          include: {
            pos: true,
          },
        },
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${createPaymentDto.invoiceId} not found`);
    }

    // Enforce RBAC
    await this.enforcePosScope(invoice.client.posId, currentUser, 'create');

    // Enforce single payment per invoice - check if invoice already has a payment
    if (invoice.payments && invoice.payments.length > 0) {
      throw new BadRequestException(
        'Invoice already has a payment. Only one payment per invoice is allowed.',
      );
    }

    // Validate amounts
    if (createPaymentDto.amountPaid < 0) {
      throw new BadRequestException('amountPaid must be greater than or equal to 0');
    }

    // Remove extraAmount support - only exact payment allowed
    if (createPaymentDto.extraAmount && createPaymentDto.extraAmount !== 0) {
      throw new BadRequestException(
        'extraAmount is not allowed. Payment must match invoice amount exactly.',
      );
    }

    // Validate payment amount matches invoice amount exactly
    const invoiceAmount = Number(invoice.amount);
    const paymentAmount = createPaymentDto.amountPaid;

    if (paymentAmount !== invoiceAmount) {
      throw new BadRequestException(
        `Payment amount (${paymentAmount}) must exactly match invoice amount (${invoiceAmount})`,
      );
    }

    // Create payment and activate subscription if linked
    const payment = await this.prisma.$transaction(async (tx) => {
      // Create payment
      const newPayment = await tx.payment.create({
        data: {
          invoiceId: createPaymentDto.invoiceId,
          amountPaid: createPaymentDto.amountPaid,
          extraAmount: 0, // No extra amount allowed
          paymentMethod: createPaymentDto.paymentMethod,
          paymentReference: createPaymentDto.paymentReference,
          notes: createPaymentDto.notes,
          receivedBy: currentUser.id,
        },
      });

      // If invoice is linked to a subscription, activate it
      if (invoice.subscriptionId) {
        const subscription = await tx.subscription.findUnique({
          where: { id: invoice.subscriptionId },
        });

        if (subscription && subscription.status !== SubscriptionStatus.ACTIVE) {
          // Activate subscription after payment
          await tx.subscription.update({
            where: { id: invoice.subscriptionId },
            data: { status: SubscriptionStatus.ACTIVE },
          });
        }
      }

      return newPayment;
    });

    // Fetch payment with relations for response
    const paymentWithRelations = await this.prisma.payment.findUnique({
      where: { id: payment.id },
      include: {
        invoice: {
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
            subscription: true,
          },
        },
        receivedByUser: {
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
      action: AuditAction.PAYMENT,
      entityType: EntityType.PAYMENT,
      entityId: payment.id,
      oldValues: null,
      newValues: {
        invoiceId: payment.invoiceId,
        amountPaid: payment.amountPaid,
        paymentMethod: paymentWithRelations?.paymentMethod || createPaymentDto.paymentMethod,
        paymentReference: paymentWithRelations?.paymentReference || createPaymentDto.paymentReference,
      },
      description: `Payment received for invoice ${invoice.invoiceNumber}. Subscription activated.`,
    });

    return paymentWithRelations;
  }

  async findAll(query: any, currentUser: any) {
    const whereClause: any = {};

    // Apply filters
    if (query.invoiceId) {
      whereClause.invoiceId = query.invoiceId;
    }

    if (query.paymentMethod) {
      whereClause.paymentMethod = query.paymentMethod;
    }

    // POS_MANAGER scope - filter by client POS
    if (currentUser?.role === 'POS_MANAGER' && currentUser?.posId) {
      whereClause.invoice = {
        client: {
          posId: currentUser.posId,
        },
      };
    } else if (query.clientId) {
      // WSP_ADMIN and SUB_ADMIN can filter by client
      whereClause.invoice = {
        clientId: query.clientId,
      };
    } else if (query.posId) {
      // WSP_ADMIN and SUB_ADMIN can filter by POS
      whereClause.invoice = {
        client: {
          posId: query.posId,
        },
      };
    }

    const payments = await this.prisma.payment.findMany({
      where: whereClause,
      include: {
        invoice: {
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
          },
        },
        receivedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return payments;
  }

  async findOne(id: string, currentUser: any) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: {
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
          },
        },
        receivedByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    // Enforce RBAC
    await this.enforcePosScope(payment.invoice.client.posId, currentUser, 'view');

    return payment;
  }
}

