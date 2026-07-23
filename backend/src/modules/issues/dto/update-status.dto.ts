import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { IssueStatus } from '@prisma/client';

// RESOLVED is a virtual status — it is accepted by the API but the service
// auto-routes it to IN_QA / PENDING_CLIENT_APPROVAL / SI_REVIEW based on context.
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

  /**
   * Only relevant when status = 'RESOLVED' and the assigned org is SI (internal flow).
   * If true  -> transitions to IN_QA.
   * If false -> transitions to PENDING_CLIENT_APPROVAL.
   * Ignored for OEM flow (always routes to SI_REVIEW).
   */
  @IsBoolean()
  @IsOptional()
  requiresQA?: boolean;
}
