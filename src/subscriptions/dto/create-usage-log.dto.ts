import { IsNumber, Min, IsDateString } from 'class-validator';

export class CreateUsageLogDto {
  @IsNumber()
  @Min(0)
  downloadMb: number;

  @IsNumber()
  @Min(0)
  uploadMb: number;

  @IsDateString()
  logDate: string;
}

