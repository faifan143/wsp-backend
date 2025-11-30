import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateServicePlanDto } from './dto/create-service-plan.dto';
import { UpdateServicePlanDto } from './dto/update-service-plan.dto';
import { AuditAction, EntityType, UserRole } from '@prisma/client';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';

@Injectable()
export class ServicePlansService {
  constructor(
    private prisma: PrismaService,
    private auditLogger: AuditLoggerService,
  ) {}

  async create(createServicePlanDto: CreateServicePlanDto, currentUser?: any) {
    // Validate planName uniqueness
    const existingPlan = await this.prisma.servicePlan.findFirst({
      where: { planName: createServicePlanDto.planName },
    });

    if (existingPlan) {
      throw new ConflictException(
        `Service plan with name "${createServicePlanDto.planName}" already exists`,
      );
    }

    const servicePlan = await this.prisma.servicePlan.create({
      data: {
        planName: createServicePlanDto.planName,
        description: createServicePlanDto.description,
        serviceType: createServicePlanDto.serviceType,
        durationType: createServicePlanDto.durationType,
        durationDays: createServicePlanDto.durationDays,
        cost: createServicePlanDto.cost,
        downloadSpeedMbps: createServicePlanDto.downloadSpeedMbps,
        uploadSpeedMbps: createServicePlanDto.uploadSpeedMbps,
        dataCapacityGb: createServicePlanDto.dataCapacityGb,
        isActive: true,
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
        action: AuditAction.CREATE,
        entityType: EntityType.SERVICE_PLAN,
        entityId: servicePlan.id,
        oldValues: null,
        newValues: {
          planName: servicePlan.planName,
          serviceType: servicePlan.serviceType,
          cost: servicePlan.cost,
        },
      });
    }

    return servicePlan;
  }

  async findAll(isActive?: boolean, serviceType?: string) {
    const whereClause: any = {};

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    if (serviceType) {
      whereClause.serviceType = serviceType;
    }

    const servicePlans = await this.prisma.servicePlan.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return servicePlans;
  }

  async findOne(id: string) {
    const servicePlan = await this.prisma.servicePlan.findUnique({
      where: { id },
    });

    if (!servicePlan) {
      throw new NotFoundException(`Service plan with ID ${id} not found`);
    }

    return servicePlan;
  }

  async update(
    id: string,
    updateServicePlanDto: UpdateServicePlanDto,
    currentUser?: any,
  ) {
    const existingPlan = await this.prisma.servicePlan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      throw new NotFoundException(`Service plan with ID ${id} not found`);
    }

    // Validate planName uniqueness if name is being updated
    if (
      updateServicePlanDto.planName &&
      updateServicePlanDto.planName !== existingPlan.planName
    ) {
      const existingName = await this.prisma.servicePlan.findFirst({
        where: {
          planName: updateServicePlanDto.planName,
          NOT: { id },
        },
      });

      if (existingName) {
        throw new ConflictException(
          `Service plan with name "${updateServicePlanDto.planName}" already exists`,
        );
      }
    }

    const updatedPlan = await this.prisma.servicePlan.update({
      where: { id },
      data: updateServicePlanDto,
    });

    // Audit log
    if (currentUser) {
      const oldValues: any = {};
      const newValues: any = {};

      if (
        updateServicePlanDto.planName &&
        updateServicePlanDto.planName !== existingPlan.planName
      ) {
        oldValues.planName = existingPlan.planName;
        newValues.planName = updateServicePlanDto.planName;
      }
      if (
        updateServicePlanDto.cost !== undefined &&
        existingPlan.cost.toNumber() !== updateServicePlanDto.cost
      ) {
        oldValues.cost = existingPlan.cost;
        newValues.cost = updateServicePlanDto.cost;
      }

      if (updateServicePlanDto.downloadSpeedMbps !== undefined) {
        oldValues.downloadSpeedMbps = existingPlan.downloadSpeedMbps;
        newValues.downloadSpeedMbps = updateServicePlanDto.downloadSpeedMbps;
      }

      await this.auditLogger.log({
        context: {
          userId: currentUser.id,
          userRole: currentUser.role as UserRole,
          ipAddress: null,
          userAgent: null,
        },
        action: AuditAction.UPDATE,
        entityType: EntityType.SERVICE_PLAN,
        entityId: id,
        oldValues: Object.keys(oldValues).length > 0 ? oldValues : null,
        newValues: Object.keys(newValues).length > 0 ? newValues : null,
      });
    }

    return updatedPlan;
  }

  async activate(id: string, currentUser?: any) {
    const servicePlan = await this.prisma.servicePlan.findUnique({
      where: { id },
    });

    if (!servicePlan) {
      throw new NotFoundException(`Service plan with ID ${id} not found`);
    }

    if (servicePlan.isActive) {
      return servicePlan;
    }

    const activatedPlan = await this.prisma.servicePlan.update({
      where: { id },
      data: { isActive: true },
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
        entityType: EntityType.SERVICE_PLAN,
        entityId: id,
        oldValues: { isActive: servicePlan.isActive },
        newValues: { isActive: true },
        description: 'Activate service plan',
      });
    }

    return activatedPlan;
  }

  async deactivate(id: string, currentUser?: any) {
    const servicePlan = await this.prisma.servicePlan.findUnique({
      where: { id },
    });

    if (!servicePlan) {
      throw new NotFoundException(`Service plan with ID ${id} not found`);
    }

    if (!servicePlan.isActive) {
      return servicePlan;
    }

    const deactivatedPlan = await this.prisma.servicePlan.update({
      where: { id },
      data: { isActive: false },
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
        entityType: EntityType.SERVICE_PLAN,
        entityId: id,
        oldValues: { isActive: servicePlan.isActive },
        newValues: { isActive: false },
        description: 'Deactivate service plan',
      });
    }

    return deactivatedPlan;
  }
}
