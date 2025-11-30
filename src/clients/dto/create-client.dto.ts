import { IsString, IsOptional, IsEmail, IsEnum, IsUUID } from 'class-validator';
import { ConnectionType } from '@prisma/client';

export class CreateClientDto {
  @IsString()
  fullName: string;

  @IsString()
  phone: string;

  @IsEmail()
  email: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsUUID()
  posId: string;

  @IsEnum(ConnectionType)
  connectionType: ConnectionType;

  // For STATIC
  @IsOptional()
  @IsUUID()
  staticIpId?: string;

  // For PPPOE
  @IsOptional()
  @IsString()
  pppoeUsername?: string;

  @IsOptional()
  @IsString()
  pppoePassword?: string;
}

