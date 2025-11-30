import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  posId?: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

