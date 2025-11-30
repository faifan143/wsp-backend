import { IsOptional, IsString } from 'class-validator';

export class CompletePppoeRequestDto {
  @IsOptional()
  @IsString()
  technicianNote?: string;
}

