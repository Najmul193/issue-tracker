import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, ArrayMinSize, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(3)
  @ValidateNested({ each: true })
  @Type(() => String)
  organizationIds: string[];
}
