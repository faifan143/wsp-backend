import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  auditLoggingEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  passwordExpiryDays?: number;
}
