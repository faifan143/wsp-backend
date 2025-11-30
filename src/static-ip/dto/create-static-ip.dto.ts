import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateStaticIpDto {
  @IsUUID()
  posId: string;

  @IsString()
  ipAddress: string;

  @IsString()
  subnetMask: string;

  @IsString()
  gateway: string;

  @IsOptional()
  @IsString()
  dnsPrimary?: string;

  @IsOptional()
  @IsString()
  dnsSecondary?: string;
}

