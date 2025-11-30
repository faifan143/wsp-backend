import { IsNumber, Min } from 'class-validator';

export class UpdatePosBandwidthDto {
  @IsNumber()
  @Min(0)
  allocatedBandwidthMbps: number;
}

