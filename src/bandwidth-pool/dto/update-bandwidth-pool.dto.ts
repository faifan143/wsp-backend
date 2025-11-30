import { IsNumber, Min } from 'class-validator';

export class UpdateBandwidthPoolDto {
  @IsNumber()
  @Min(0)
  totalBandwidthMbps: number;
}

