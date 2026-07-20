import { IsString, IsOptional } from 'class-validator';

export class AssignIssueDto {
  @IsString()
  @IsOptional()
  targetUserId?: string;

  @IsString()
  @IsOptional()
  targetOrgId?: string;

  @IsString()
  @IsOptional()
  targetDepartmentId?: string;
}
