import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { IssueType, IssuePriority } from '@prisma/client';

export class CreateIssueDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(IssueType)
  @IsNotEmpty()
  type: IssueType;

  @IsEnum(IssuePriority)
  @IsNotEmpty()
  priority: IssuePriority;

  @IsDateString()
  @IsNotEmpty()
  deadline: string;

  @IsString()
  @IsOptional()
  module?: string;

  @IsString()
  @IsNotEmpty()
  projectId: string;
}
