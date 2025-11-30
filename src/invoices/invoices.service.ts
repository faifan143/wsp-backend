import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { AuditAction, EntityType, UserRole } from '@prisma/client';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';

type InvoiceStatus = 'PAID' | 'UNPAID' | 'OVERDUE';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private auditLogger: AuditLoggerService,
  ) {}

  private calculateInvoiceStatus(invoice: any): InvoiceStatus {
    const totalPaid = invoice.payments.reduce((sum: number, payment: any) => {
      return sum + Number(payment.amountPaid) + Number(payment.extraAmount);
    }, 0);

    const invoiceAmount = Number(invoice.amount);

    if (totalPaid >= invoiceAmount) {
      return 'PAID';
    }

    const now = new Date();
    const dueDate = new Date(invoice.dueDate);

    if (dueDate < now && totalPaid < invoiceAmount) {
      return 'OVERDUE';
    }

    return 'UNPAID';
  }

  private generateInvoiceNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `INV-${timestamp}-${random}`;
  }

  private async enforcePosScope(clientPosId: string, currentUser: any, operation: string) {
    if (currentUser?.role === 'POS_MANAGER' && currentUser?.posId !== clientPosId) {
      throw new ForbiddenException(
        `You can only ${operation} invoices for clients in your POS`,
      );
    }
  }

  async create(createInvoiceDto: CreateInvoiceDto, currentUser: any) {
    // Validate client exists
    const client = await this.prisma.client.findUnique({
      where: { id: createInvoiceDto.clientId },
      include: {
        pos: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${createInvoiceDto.clientId} not found`);
    }

    // Enforce RBAC - only WSP_ADMIN can create
    if (currentUser.role !== 'WSP_ADMIN') {
      throw new ForbiddenException('Only WSP_ADMIN can create invoices');
    }

    // Validate subscription if provided
    if (createInvoiceDto.subscriptionId) {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: createInvoiceDto.subscriptionId },
      });

      if (!subscription) {
        throw new NotFoundException(
          `Subscription with ID ${createInvoiceDto.subscriptionId} not found`,
        );
      }

      if (subscription.clientId !== createInvoiceDto.clientId) {
        throw new BadRequestException(
          'Subscription does not belong to the specified client',
        );
      }
    }

    // Validate dates
    const issueDate = new Date(createInvoiceDto.issueDate);
    const dueDate = new Date(createInvoiceDto.dueDate);

    if (issueDate > dueDate) {
      throw new BadRequestException('Issue date must be before or equal to due date');
    }

    // Generate unique invoice number
    let invoiceNumber: string;
    let attempts = 0;
    do {
      invoiceNumber = this.generateInvoiceNumber();
      const existing = await this.prisma.invoice.findUnique({
        where: { invoiceNumber },
      });
      if (!existing) break;
      attempts++;
      if (attempts > 10) {
        throw new ConflictException('Failed to generate unique invoice number');
      }
    } while (true);

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        clientId: createInvoiceDto.clientId,
        subscriptionId: createInvoiceDto.subscriptionId,
        invoiceNumber,
        amount: createInvoiceDto.amount,
        issueDate,
        dueDate,
        notes: createInvoiceDto.notes,
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
        subscription: true,
        payments: true,
      },
    });

    // Calculate and attach status
    const status = this.calculateInvoiceStatus(invoice);

    // Audit log
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
    });

    return { ...invoice, status };
  }

  async findAll(query: any, currentUser: any) {
    const whereClause: any = {};

    // Apply filters
    if (query.clientId) {
      whereClause.clientId = query.clientId;
    }

    if (query.subscriptionId) {
      whereClause.subscriptionId = query.subscriptionId;
    }

    // POS_MANAGER scope
    if (currentUser?.role === 'POS_MANAGER' && currentUser?.posId) {
      whereClause.client = {
        posId: currentUser.posId,
      };
    } else if (query.posId) {
      // WSP_ADMIN can filter by POS
      whereClause.client = {
        posId: query.posId,
      };
    }

    // Fetch invoices
    const invoices = await this.prisma.invoice.findMany({
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
        subscription: true,
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate status for each invoice and filter by status if requested
    let result = invoices.map((invoice) => {
      const status = this.calculateInvoiceStatus(invoice);
      return { ...invoice, status };
    });

    // Filter by status if requested
    if (query.status) {
      result = result.filter((invoice) => invoice.status === query.status);
    }

    return result;
  }

  async findOne(id: string, currentUser: any) {
    const invoice = await this.prisma.invoice.findUnique({
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
        subscription: true,
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    // Enforce RBAC
    await this.enforcePosScope(invoice.client.posId, currentUser, 'view');

    // Calculate and attach status
    const status = this.calculateInvoiceStatus(invoice);
    return { ...invoice, status };
  }

  async cancel(id: string, currentUser: any) {
    // Only WSP_ADMIN can cancel
    if (currentUser.role !== 'WSP_ADMIN') {
      throw new ForbiddenException('Only WSP_ADMIN can cancel invoices');
    }

    const invoice = await this.prisma.invoice.findUnique({
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
        subscription: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    // Update notes to mark as cancelled
    const cancelledNotes = invoice.notes
      ? `[CANCELLED] ${invoice.notes}`
      : '[CANCELLED]';

    const cancelledInvoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        notes: cancelledNotes,
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
        subscription: true,
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    // Calculate and attach status
    const status = this.calculateInvoiceStatus(cancelledInvoice);

    // Audit log
    await this.auditLogger.log({
      context: {
        userId: currentUser.id,
        userRole: currentUser.role as UserRole,
        ipAddress: null,
        userAgent: null,
      },
      action: AuditAction.UPDATE,
      entityType: EntityType.INVOICE,
      entityId: id,
      oldValues: { notes: invoice.notes },
      newValues: { notes: cancelledNotes },
      description: 'Cancel invoice',
    });

    return { ...cancelledInvoice, status };
  }
}

