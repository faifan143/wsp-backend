import { IsOptional, IsString } from 'class-validator';

export class ApprovePppoeRequestDto {
  @IsOptional()
  @IsString()
  note?: string;
}

