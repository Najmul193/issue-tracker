import { IsString, IsNotEmpty } from 'class-validator';

export class AddOrgDto {
  @IsString()
  @IsNotEmpty()
  organizationId: string;
}
