import { IsUUID, IsOptional, IsString } from 'class-validator';

export class CreatePppoeRequestDto {
  @IsUUID()
  clientId: string;

  @IsOptional()
  @IsString()
  newUsername?: string;

  @IsOptional()
  @IsString()
  newPassword?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

