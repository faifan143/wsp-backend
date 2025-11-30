import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePosDto } from './dto/create-pos.dto';
import { UpdatePosDto } from './dto/update-pos.dto';
import { UpdatePosBandwidthDto } from './dto/update-pos-bandwidth.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class PosService {
  constructor(private prisma: PrismaService) {}

  async create(createPosDto: CreatePosDto) {
    // Check for name uniqueness (optional but good practice)
    const existingPos = await this.prisma.pOS.findFirst({
      where: { name: createPosDto.name },
    });

    if (existingPos) {
      throw new ConflictException(`POS with name "${createPosDto.name}" already exists`);
    }

    const pos = await this.prisma.pOS.create({
      data: {
        name: createPosDto.name,
        location: createPosDto.location,
        contactPhone: createPosDto.contactPhone,
        allocatedBandwidthMbps: createPosDto.allocatedBandwidthMbps,
        currentUsageMbps: 0,
        isActive: true,
      },
    });

    return pos;
  }

  async findAll() {
    const posList = await this.prisma.pOS.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return posList;
  }

  async findOne(id: string) {
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    return pos;
  }

  async update(id: string, updatePosDto: UpdatePosDto) {
    const existingPos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!existingPos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    // Check name uniqueness if name is being updated
    if (updatePosDto.name && updatePosDto.name !== existingPos.name) {
      const existingName = await this.prisma.pOS.findFirst({
        where: {
          name: updatePosDto.name,
          NOT: { id },
        },
      });

      if (existingName) {
        throw new ConflictException(`POS with name "${updatePosDto.name}" already exists`);
      }
    }

    const updatedPos = await this.prisma.pOS.update({
      where: { id },
      data: updatePosDto,
    });

    return updatedPos;
  }

  async activate(id: string) {
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    const activatedPos = await this.prisma.pOS.update({
      where: { id },
      data: { isActive: true },
    });

    return activatedPos;
  }

  async deactivate(id: string) {
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    const deactivatedPos = await this.prisma.pOS.update({
      where: { id },
      data: { isActive: false },
    });

    return deactivatedPos;
  }

  async updateBandwidth(id: string, updateBandwidthDto: UpdatePosBandwidthDto) {
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    if (updateBandwidthDto.allocatedBandwidthMbps < 0) {
      throw new BadRequestException('Allocated bandwidth cannot be negative');
    }

    // TODO: Later we will validate against BandwidthPool global capacity
    // For now, just update the bandwidth

    const updatedPos = await this.prisma.pOS.update({
      where: { id },
      data: {
        allocatedBandwidthMbps: updateBandwidthDto.allocatedBandwidthMbps,
      },
    });

    return updatedPos;
  }

  async getClients(id: string) {
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    const clients = await this.prisma.client.findMany({
      where: { posId: id },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return clients;
  }

  async getManagers(id: string) {
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    const managers = await this.prisma.user.findMany({
      where: {
        posId: id,
        role: UserRole.POS_MANAGER,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return managers;
  }

  async assignManager(id: string, userId: string) {
    // Validate POS exists
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Validate user role is POS_MANAGER
    if (user.role !== UserRole.POS_MANAGER) {
      throw new BadRequestException('User must have POS_MANAGER role to be assigned to a POS');
    }

    // Check if user is already assigned to another POS
    if (user.posId && user.posId !== id) {
      throw new BadRequestException(
        `User is already assigned to another POS (ID: ${user.posId})`,
      );
    }

    // If already assigned to this POS, return success
    if (user.posId === id) {
      return { message: 'Manager is already assigned to this POS', user };
    }

    // Assign manager to POS
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { posId: id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        posId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  async removeManager(id: string, userId: string) {
    // Validate POS exists
    const pos = await this.prisma.pOS.findUnique({
      where: { id },
    });

    if (!pos) {
      throw new NotFoundException(`POS with ID ${id} not found`);
    }

    // Validate user exists and is assigned to this POS
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.posId !== id) {
      throw new BadRequestException(
        `User is not assigned to this POS. Current POS ID: ${user.posId || 'none'}`,
      );
    }

    // Remove manager from POS
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { posId: null },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        posId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }
}

