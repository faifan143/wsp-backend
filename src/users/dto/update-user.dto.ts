import { IsString, IsEmail, IsOptional, IsEnum, IsArray, ArrayMinSize, ValidateIf } from 'class-validator';
import { UserRole, Capability } from '@prisma/client';

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

  @IsArray()
  @IsEnum(Capability, { each: true })
  @ArrayMinSize(1, { message: 'SUB_ADMIN must have at least one capability' })
  @ValidateIf((o) => o.role === 'SUB_ADMIN' || o.role === undefined)
  @IsOptional()
  capabilities?: Capability[];
}

