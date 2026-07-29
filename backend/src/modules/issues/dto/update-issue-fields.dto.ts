import { IsOptional, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { IssueType } from '@prisma/client';

export class UpdateIssueFieldsDto {
  @IsEnum(IssueType)
  @IsOptional()
  type?: IssueType;

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsBoolean()
  @IsOptional()
  clearDeadline?: boolean;
}
