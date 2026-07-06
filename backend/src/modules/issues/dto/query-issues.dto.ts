import { IsOptional, IsEnum, IsString, IsBooleanString, IsNumberString } from 'class-validator';
import { IssueStatus, IssuePriority, IssueType } from '@prisma/client';

export class QueryIssuesDto {
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  assignedOrg?: string;

  @IsOptional()
  @IsBooleanString()
  overdue?: string;

  @IsOptional()
  @IsBooleanString()
  concern?: string;

  @IsOptional()
  @IsString()
  concernFilter?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
