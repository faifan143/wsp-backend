import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  role: UserRole;
  pos_id?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { pos: true }
    });

    if (user && await bcrypt.compare(password, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      pos_id: user.posId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        pos: user.pos,
      },
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    role: UserRole;
    posId?: string;
    clientId?: string;
  }) {
    const hashedPassword = await this.hashPassword(userData.password);

    return this.prisma.user.create({
      data: {
        username: userData.username,
        email: userData.email,
        passwordHash: hashedPassword,
        role: userData.role,
        posId: userData.posId,
        clientId: userData.clientId,
      },
      include: { pos: true }
    });
  }
}
