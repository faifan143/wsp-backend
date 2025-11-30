import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    // Validate username uniqueness
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: createUserDto.username },
    });
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    // Validate email uniqueness
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    // Validate role constraints
    this.validateRoleConstraints(createUserDto.role, createUserDto.posId, createUserDto.clientId);

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(createUserDto.password, saltRounds);

    // Prepare user data
    const userData: any = {
      username: createUserDto.username,
      email: createUserDto.email,
      passwordHash,
      role: createUserDto.role,
      isActive: true,
    };

    // Set posId or clientId based on role
    if (createUserDto.role === UserRole.POS_MANAGER) {
      // Verify POS exists
      const pos = await this.prisma.pOS.findUnique({
        where: { id: createUserDto.posId },
      });
      if (!pos) {
        throw new NotFoundException('POS not found');
      }
      userData.posId = createUserDto.posId;
      userData.clientId = null;
    } else if (createUserDto.role === UserRole.CLIENT) {
      // Verify Client exists
      const client = await this.prisma.client.findUnique({
        where: { id: createUserDto.clientId },
      });
      if (!client) {
        throw new NotFoundException('Client not found');
      }
      // Check if client already has a user
      const existingClientUser = await this.prisma.user.findUnique({
        where: { clientId: createUserDto.clientId },
      });
      if (existingClientUser) {
        throw new ConflictException('Client already has a user account');
      }
      userData.clientId = createUserDto.clientId;
      userData.posId = null;
    } else if (createUserDto.role === UserRole.WSP_ADMIN) {
      userData.posId = null;
      userData.clientId = null;
    }

    const user = await this.prisma.user.create({
      data: userData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        posId: true,
        clientId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        posId: true,
        clientId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        posId: true,
        clientId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, requesterId?: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Validate email uniqueness if email is being updated
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    // Determine role for validation (use existing role if not being updated)
    const role = updateUserDto.role || existingUser.role;
    const posId = updateUserDto.posId !== undefined ? updateUserDto.posId : existingUser.posId;
    const clientId = updateUserDto.clientId !== undefined ? updateUserDto.clientId : existingUser.clientId;

    // Validate role constraints
    this.validateRoleConstraints(role, posId, clientId);

    // Prepare update data
    const updateData: any = {};

    if (updateUserDto.email) {
      updateData.email = updateUserDto.email;
    }

    if (updateUserDto.password) {
      const saltRounds = 10;
      updateData.passwordHash = await bcrypt.hash(updateUserDto.password, saltRounds);
    }

    if (updateUserDto.role) {
      updateData.role = updateUserDto.role;
    }

    // Handle posId and clientId based on role
    if (role === UserRole.POS_MANAGER) {
      if (!posId) {
        throw new BadRequestException('POS_MANAGER must have a posId');
      }
      // Verify POS exists
      const pos = await this.prisma.pOS.findUnique({
        where: { id: posId },
      });
      if (!pos) {
        throw new NotFoundException('POS not found');
      }
      updateData.posId = posId;
      updateData.clientId = null;
    } else if (role === UserRole.CLIENT) {
      if (!clientId) {
        throw new BadRequestException('CLIENT must have a clientId');
      }
      // Verify Client exists
      const client = await this.prisma.client.findUnique({
        where: { id: clientId },
      });
      if (!client) {
        throw new NotFoundException('Client not found');
      }
      // Check if another user already has this clientId
      if (clientId !== existingUser.clientId) {
        const existingClientUser = await this.prisma.user.findUnique({
          where: { clientId },
        });
        if (existingClientUser) {
          throw new ConflictException('Client already has a user account');
        }
      }
      updateData.clientId = clientId;
      updateData.posId = null;
    } else if (role === UserRole.WSP_ADMIN) {
      updateData.posId = null;
      updateData.clientId = null;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        posId: true,
        clientId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  async activate(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const activatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        posId: true,
        clientId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return activatedUser;
  }

  async deactivate(id: string, requesterId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Prevent self-deactivation
    if (requesterId && id === requesterId) {
      throw new ForbiddenException('Cannot deactivate your own account');
    }

    const deactivatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        posId: true,
        clientId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return deactivatedUser;
  }

  private validateRoleConstraints(role: UserRole, posId?: string | null, clientId?: string | null) {
    if (role === UserRole.WSP_ADMIN) {
      if (posId || clientId) {
        throw new BadRequestException('WSP_ADMIN cannot have posId or clientId');
      }
    } else if (role === UserRole.POS_MANAGER) {
      if (!posId) {
        throw new BadRequestException('POS_MANAGER must have a posId');
      }
      if (clientId) {
        throw new BadRequestException('POS_MANAGER cannot have a clientId');
      }
    } else if (role === UserRole.CLIENT) {
      if (!clientId) {
        throw new BadRequestException('CLIENT must have a clientId');
      }
      if (posId) {
        throw new BadRequestException('CLIENT cannot have a posId');
      }
    }
  }
}

