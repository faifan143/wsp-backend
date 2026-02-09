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
import { UserRole, AuditAction, EntityType, Capability } from '@prisma/client';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { PermissionsUtil } from '../common/utils/permissions.util';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditLogger: AuditLoggerService,
  ) {}

  async create(createUserDto: CreateUserDto, currentUser?: any) {
    // Check if current user can create this role
    if (currentUser?.role === 'SUB_ADMIN') {
      if (createUserDto.role === 'WSP_ADMIN' || createUserDto.role === 'SUB_ADMIN') {
        throw new ForbiddenException('SUB_ADMIN cannot create WSP_ADMIN or SUB_ADMIN users');
      }
    }

    // Validate SUB_ADMIN must have capabilities
    if (createUserDto.role === 'SUB_ADMIN') {
      if (!createUserDto.capabilities || createUserDto.capabilities.length === 0) {
        throw new BadRequestException('SUB_ADMIN must have at least one capability');
      }
    }

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
      passwordChangedAt: new Date(),
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
    } else if (createUserDto.role === UserRole.WSP_ADMIN || createUserDto.role === UserRole.SUB_ADMIN) {
      userData.posId = null;
      userData.clientId = null;
      // Set capabilities for SUB_ADMIN
      if (createUserDto.role === UserRole.SUB_ADMIN) {
        userData.capabilities = {
          set: createUserDto.capabilities || [],
        };
      }
    }

    const user = await this.prisma.user.create({
      data: userData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        capabilities: true,
        posId: true,
        clientId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
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
        entityType: EntityType.USER,
        entityId: user.id,
        oldValues: null,
        newValues: {
          username: user.username,
          email: user.email,
          role: user.role,
          capabilities: user.capabilities,
          posId: user.posId,
          clientId: user.clientId,
          isActive: user.isActive,
        },
      });
    }

    return user;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        capabilities: true,
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
        capabilities: true,
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

  async update(id: string, updateUserDto: UpdateUserDto, currentUser?: any) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check if current user can manage target user
    if (currentUser && !PermissionsUtil.canManageUser(currentUser, existingUser.role)) {
      throw new ForbiddenException('You cannot manage this user');
    }

    // Determine role for validation (use existing role if not being updated)
    const role = updateUserDto.role || existingUser.role;

    // Check if trying to promote to restricted role
    if (currentUser?.role === 'SUB_ADMIN') {
      if (role === 'WSP_ADMIN' || role === 'SUB_ADMIN') {
        throw new ForbiddenException('SUB_ADMIN cannot change user role to WSP_ADMIN or SUB_ADMIN');
      }
    }

    // Validate SUB_ADMIN must have capabilities if role is SUB_ADMIN
    if (role === 'SUB_ADMIN') {
      if (updateUserDto.capabilities && updateUserDto.capabilities.length === 0) {
        throw new BadRequestException('SUB_ADMIN must have at least one capability');
      }
      // If updating to SUB_ADMIN and no capabilities provided, use existing capabilities
      if (!updateUserDto.capabilities && existingUser.role !== 'SUB_ADMIN') {
        throw new BadRequestException('SUB_ADMIN must have at least one capability');
      }
    }

    const posId = updateUserDto.posId !== undefined ? updateUserDto.posId : existingUser.posId;
    const clientId = updateUserDto.clientId !== undefined ? updateUserDto.clientId : existingUser.clientId;

    // Validate email uniqueness if email is being updated
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

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
      updateData.passwordChangedAt = new Date();
    }

    if (updateUserDto.role) {
      updateData.role = updateUserDto.role;
    }

    // Handle capabilities for SUB_ADMIN
    if (role === UserRole.SUB_ADMIN && updateUserDto.capabilities !== undefined) {
      updateData.capabilities = {
        set: updateUserDto.capabilities,
      };
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
    } else if (role === UserRole.WSP_ADMIN || role === UserRole.SUB_ADMIN) {
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
        capabilities: true,
        posId: true,
        clientId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    if (currentUser) {
      const oldValues: any = {};
      const newValues: any = {};

      if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
        oldValues.email = existingUser.email;
        newValues.email = updateUserDto.email;
      }
      if (updateUserDto.role && updateUserDto.role !== existingUser.role) {
        oldValues.role = existingUser.role;
        newValues.role = updateUserDto.role;
      }
      if (updateUserDto.capabilities !== undefined) {
        oldValues.capabilities = existingUser.capabilities;
        newValues.capabilities = updateUserDto.capabilities;
      }
      if (updateUserDto.password) {
        newValues.passwordChanged = true;
      }
      if (updateData.posId !== undefined && updateData.posId !== existingUser.posId) {
        oldValues.posId = existingUser.posId;
        newValues.posId = updateData.posId;
      }
      if (updateData.clientId !== undefined && updateData.clientId !== existingUser.clientId) {
        oldValues.clientId = existingUser.clientId;
        newValues.clientId = updateData.clientId;
      }

      await this.auditLogger.log({
        context: {
          userId: currentUser.id,
          userRole: currentUser.role as UserRole,
          ipAddress: null,
          userAgent: null,
        },
        action: AuditAction.UPDATE,
        entityType: EntityType.USER,
        entityId: id,
        oldValues: Object.keys(oldValues).length > 0 ? oldValues : null,
        newValues: Object.keys(newValues).length > 0 ? newValues : null,
      });
    }

    return updatedUser;
  }

  async activate(id: string, currentUser?: any) {
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
        entityType: EntityType.USER,
        entityId: id,
        oldValues: { isActive: user.isActive },
        newValues: { isActive: true },
        description: 'Activate user',
      });
    }

    return activatedUser;
  }

  async deactivate(id: string, currentUser?: any) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Prevent self-deactivation
    if (currentUser && id === currentUser.id) {
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
        entityType: EntityType.USER,
        entityId: id,
        oldValues: { isActive: user.isActive },
        newValues: { isActive: false },
        description: 'Deactivate user',
      });
    }

    return deactivatedUser;
  }

  private validateRoleConstraints(role: UserRole, posId?: string | null, clientId?: string | null) {
    if (role === UserRole.WSP_ADMIN || role === UserRole.SUB_ADMIN) {
      if (posId || clientId) {
        throw new BadRequestException(`${role} cannot have posId or clientId`);
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

