import { IsString, IsNotEmpty } from 'class-validator';

export class AddManagerDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
