import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { IssueStatus } from '@prisma/client';

// RESOLVED is a virtual status — it is accepted by the API but the service
// auto-routes it to SI_REVIEW before persisting.
type AcceptedStatus = IssueStatus | 'RESOLVED';

export class UpdateStatusDto {
  @IsString()
  @IsNotEmpty()
  status: AcceptedStatus;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  resolutionNote?: string;
}
