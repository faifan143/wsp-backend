import { IsUUID, IsNotEmpty } from 'class-validator';

export class AssignStaticIpDto {
  @IsUUID()
  @IsNotEmpty()
  staticIpId: string;
}

