import { IsString, IsOptional } from 'class-validator';

export class UpdateStaticIpDto {
  @IsOptional()
  @IsString()
  subnetMask?: string;

  @IsOptional()
  @IsString()
  gateway?: string;

  @IsOptional()
  @IsString()
  dnsPrimary?: string;

  @IsOptional()
  @IsString()
  dnsSecondary?: string;
}

