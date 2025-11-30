import { IsOptional, IsString, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { UserRole, EntityType, AuditAction } from '@prisma/client';

export class QueryAuditDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsString()
  posId?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;
}

