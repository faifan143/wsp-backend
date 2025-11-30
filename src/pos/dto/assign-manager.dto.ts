import { IsString, IsNotEmpty } from 'class-validator';

export class AssignManagerDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

