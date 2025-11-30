import { IsUUID, IsOptional, IsDateString, IsNumber, Min, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @IsUUID()
  clientId: string;

  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0)
  amount: number;

  @IsDateString()
  issueDate: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

