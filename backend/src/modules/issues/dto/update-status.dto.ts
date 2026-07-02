import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { IssueStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(IssueStatus)
  @IsNotEmpty()
  status: IssueStatus;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  resolutionNote?: string;
}
