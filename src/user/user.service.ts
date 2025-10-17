import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  posId?: string;
  clientId?: string;
}

export interface UpdateUserDto {
  username?: string;
  email?: string;
  password?: string;
  isActive?: boolean;
  posId?: string;
  clientId?: string;
}

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    // Check if username or email already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: createUserDto.username },
          { email: createUserDto.email }
        ]
      }
    });

    if (existingUser) {
      throw new ConflictException('Username or email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    return this.prisma.user.create({
      data: {
        username: createUserDto.username,
        email: createUserDto.email,
        passwordHash: hashedPassword,
        role: createUserDto.role,
        posId: createUserDto.posId,
        clientId: createUserDto.clientId,
      },
      include: {
        pos: true,
        client: true
      }
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      include: {
        pos: true,
        client: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        pos: true,
        client: true
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        pos: true,
        client: true
      }
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);

    // Check if new username or email conflicts with existing users
    if (updateUserDto.username || updateUserDto.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                updateUserDto.username ? { username: updateUserDto.username } : {},
                updateUserDto.email ? { email: updateUserDto.email } : {}
              ]
            }
          ]
        }
      });

      if (existingUser) {
        throw new ConflictException('Username or email already exists');
      }
    }

    const updateData: any = { ...updateUserDto };
    
    // Hash password if provided
    if (updateUserDto.password) {
      updateData.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
      delete updateData.password;
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        pos: true,
        client: true
      }
    });
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    
    return this.prisma.user.delete({
      where: { id }
    });
  }

  async updateLastLogin(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { lastLogin: new Date() }
    });
  }

  async findByRole(role: UserRole) {
    return this.prisma.user.findMany({
      where: { role },
      include: {
        pos: true,
        client: true
      }
    });
  }

  async findByPos(posId: string) {
    return this.prisma.user.findMany({
      where: { posId },
      include: {
        pos: true,
        client: true
      }
    });
  }
}
