import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AuditAction, EntityType, UserRole } from '@prisma/client';
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

    // Validate amounts
    if (createPaymentDto.amountPaid < 0) {
      throw new BadRequestException('amountPaid must be greater than or equal to 0');
    }

    const extraAmount = createPaymentDto.extraAmount ?? 0;
    if (extraAmount < 0) {
      throw new BadRequestException('extraAmount must be greater than or equal to 0');
    }

    // Compute total paid before this payment
    const totalPaidBefore = invoice.payments.reduce((sum, payment) => {
      return sum + Number(payment.amountPaid) + Number(payment.extraAmount);
    }, 0);

    // Compute incoming payment total
    const incomingPaid = createPaymentDto.amountPaid + extraAmount;

    // Create payment
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: createPaymentDto.invoiceId,
        amountPaid: createPaymentDto.amountPaid,
        extraAmount: extraAmount,
        paymentMethod: createPaymentDto.paymentMethod,
        paymentReference: createPaymentDto.paymentReference,
        notes: createPaymentDto.notes,
        receivedBy: currentUser.id,
      },
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
        extraAmount: payment.extraAmount,
        paymentMethod: payment.paymentMethod,
        paymentReference: payment.paymentReference,
      },
      description: `Payment received for invoice ${invoice.invoiceNumber}`,
    });

    return payment;
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

