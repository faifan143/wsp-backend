import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
import { UserRole, Capability } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @IsArray()
  @IsEnum(Capability, { each: true })
  @ArrayMinSize(1, { message: 'SUB_ADMIN must have at least one capability' })
  @ValidateIf((o) => o.role === 'SUB_ADMIN')
  @IsOptional()
  capabilities?: Capability[];

  @IsString()
  @IsOptional()
  posId?: string;

  @IsString()
  @IsOptional()
  clientId?: string;
}
