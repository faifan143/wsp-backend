import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ConnectionType } from '@prisma/client';

export class UpdateConnectionTypeDto {
  @IsEnum(ConnectionType)
  connectionType: ConnectionType;

  // Required when connectionType = 'STATIC'
  @IsOptional()
  @IsUUID()
  staticIpId?: string;

  // Required when connectionType = 'PPPOE'
  @IsOptional()
  @IsString()
  pppoeUsername?: string;

  @IsOptional()
  @IsString()
  pppoePassword?: string;
}

