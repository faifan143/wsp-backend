import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateServicePlanDto } from './dto/create-service-plan.dto';
import { UpdateServicePlanDto } from './dto/update-service-plan.dto';

@Injectable()
export class ServicePlansService {
  constructor(private prisma: PrismaService) {}

  async create(createServicePlanDto: CreateServicePlanDto) {
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

  async update(id: string, updateServicePlanDto: UpdateServicePlanDto) {
    const existingPlan = await this.prisma.servicePlan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      throw new NotFoundException(`Service plan with ID ${id} not found`);
    }

    // Validate planName uniqueness if name is being updated
    if (updateServicePlanDto.planName && updateServicePlanDto.planName !== existingPlan.planName) {
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

    return updatedPlan;
  }

  async activate(id: string) {
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

    return activatedPlan;
  }

  async deactivate(id: string) {
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

    return deactivatedPlan;
  }
}

