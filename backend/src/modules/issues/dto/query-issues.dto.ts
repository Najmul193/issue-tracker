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

  /**
   * 'deadline' sorts the soonest deadline first (undated last); anything else, including
   * absent, sorts newest first. Deliberately a permissive string rather than @IsIn so a
   * stale bookmark or hand-edited URL degrades to the default instead of 400-ing the
   * whole list — the same treatment `concernFilter` gets.
   */
  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  projectIds?: string;
}
