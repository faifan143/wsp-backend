import { IsString, IsOptional } from 'class-validator';

export class UpdatePosDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;
}

