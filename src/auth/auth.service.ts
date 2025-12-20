import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { AuditAction, EntityType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditLogger: AuditLoggerService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        role: true,
        capabilities: true,
        isActive: true,
        posId: true,
        clientId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    if (!user.role) {
      throw new BadRequestException('User role is missing');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login timestamp (use updateMany to avoid error if user doesn't exist)
    await this.prisma.user.updateMany({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Return user without password hash
    const { passwordHash, ...result } = user;
    return result;
  }

  async login(user: any, ipAddress?: string, userAgent?: string) {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      capabilities: user.capabilities || [],
      posId: user.posId,
      clientId: user.clientId,
    };

    const accessToken = this.jwtService.sign(payload);

    // Audit log
    await this.auditLogger.log({
      context: {
        userId: user.id,
        userRole: user.role as UserRole,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
      action: AuditAction.LOGIN,
      entityType: EntityType.USER,
      entityId: user.id,
    });

    return {
      access_token: accessToken,
    };
  }

  async logout(userId?: string, ipAddress?: string, userAgent?: string) {
    // Audit log
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });

      if (user) {
        await this.auditLogger.log({
          context: {
            userId: user.id,
            userRole: user.role as UserRole,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          },
          action: AuditAction.LOGOUT,
          entityType: EntityType.USER,
          entityId: user.id,
        });
      }
    }

    return {
      message: 'Logout successful',
    };
  }

  async refresh() {
    // Placeholder for refresh token implementation
    return {
      message: 'Refresh token endpoint - to be implemented',
    };
  }
}

