import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './decorators/current-user.decorator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { ProjectsService } from '../projects/projects.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly projectsService: ProjectsService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'INACTIVE') {
      throw new UnauthorizedException('Account has been deactivated');
    }

    const payload: JwtPayload = {
      userId: user.id,
      role: user.role,
      organizationId: user.organizationId,
      organizationType: user.organization.type,
    };

    const accessToken = this.jwtService.sign(payload);
    return { accessToken, payload };
  }

  canAssign(
    actor: JwtPayload,
    targetUserId: string | null,
    targetOrgId: string | null,
    targetUserOrgId?: string,
    targetUserRole?: string,
    isCurrentAssignee?: boolean,
    currentAssignedOrgId?: string | null,
    raisedByOrgId?: string | null,
    targetUserOrgType?: string,
    targetOrgType?: string,
  ): void {
    // SUPER_ADMIN cannot assign issues
    if (actor.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('SUPER_ADMIN cannot assign issues');
    }

    // No one can assign to a SUPER_ADMIN user
    if (targetUserRole === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot assign to a SUPER_ADMIN user');
    }

    // Cross-org assignments cannot target orgs with the same type (only when target is a different org)
    const targetType = targetUserOrgType || targetOrgType;
    const targetOrganizationId = targetOrgId || targetUserOrgId;
    if (
      targetType &&
      targetType === actor.organizationType &&
      targetOrganizationId &&
      targetOrganizationId !== actor.organizationId
    ) {
      throw new ForbiddenException(
        `Cannot assign to a ${targetType.toLowerCase()} organization from another ${targetType.toLowerCase()} organization`,
      );
    }

    if (actor.role === 'ORG_ADMIN') {
      const isRaiser = raisedByOrgId === actor.organizationId;
      const isAssignedToActorOrg = currentAssignedOrgId === actor.organizationId;

      // Raiser's org admin, issue currently outside their org → can route outside only
      if (isRaiser && !isAssignedToActorOrg) {
        if (targetUserId && targetUserOrgId && targetUserOrgId === actor.organizationId) {
          throw new ForbiddenException(
            'This issue was raised by your organization but is assigned elsewhere; you can only route to other organizations',
          );
        }
        if (targetOrgId && targetOrgId === actor.organizationId) {
          throw new ForbiddenException(
            'This issue was raised by your organization but is assigned elsewhere; you can only route to other organizations',
          );
        }
        return;
      }

      // Issue is in actor's org → internal routing only
      if (isAssignedToActorOrg) {
        if (targetUserId && targetUserOrgId && targetUserOrgId !== actor.organizationId) {
          throw new ForbiddenException(
            'This issue is in your organization queue; you can only assign within your organization',
          );
        }
        if (targetOrgId && targetOrgId !== actor.organizationId) {
          throw new ForbiddenException(
            'This issue is in your organization queue; you can only route within your organization',
          );
        }
        return;
      }

      // Fallback: internal only
      if (targetUserId && targetUserOrgId && targetUserOrgId !== actor.organizationId) {
        throw new ForbiddenException(
          'ORG_ADMIN can only assign users within their own organization',
        );
      }
      return;
    }

    if (actor.role === 'USER') {
      // Assignee can only reroute to an admin in their own org
      if (isCurrentAssignee) {
        if (!targetUserId) {
          throw new ForbiddenException(
            'As the assignee, you can only reassign to an admin in your organization',
          );
        }
        if (targetUserOrgId !== actor.organizationId) {
          throw new ForbiddenException(
            'As the assignee, you can only reassign to an admin in your own organization',
          );
        }
        if (targetUserRole !== 'ORG_ADMIN') {
          throw new ForbiddenException('As the assignee, you can only reassign to an admin');
        }
        return;
      }

      // If not the assignee, only users in the raiser's org can reroute
      if (raisedByOrgId !== actor.organizationId) {
        throw new ForbiddenException(
          'Only the assignee or users from the raising organization can reroute this issue',
        );
      }

      if (targetUserId) {
        if (!targetUserOrgId) {
          throw new ForbiddenException('Cannot assign to unknown user');
        }
        if (targetUserOrgId === actor.organizationId) {
          throw new ForbiddenException('You cannot assign to users in your own organization');
        }
        return;
      }
      if (targetOrgId) {
        if (targetOrgId === actor.organizationId) {
          throw new ForbiddenException('You cannot route to your own organization');
        }
        return;
      }
      throw new ForbiddenException('Invalid assignment request');
    }

    throw new ForbiddenException('You are not authorized to assign issues');
  }

  /**
   * Returns a Prisma filter that restricts issues to projects
   * the actor has access to.
   * SUPER_ADMIN: no restrictions (sees all).
   */
  async getVisibleIssuesFilter(actor: JwtPayload): Promise<Prisma.IssueWhereInput> {
    return this.projectsService.getVisibleProjectFilter(actor);
  }

  /**
   * Part B: Authorization check for status changes.
   * SUPER_ADMIN: always allowed.
   * Otherwise: allowed if actor's org matches raisedByOrgId or assignedToOrgId,
   * or if actor is the assigned user.
   */
  canActOnIssue(
    actor: JwtPayload,
    issue: {
      raisedByOrgId: string;
      assignedToOrgId: string | null;
      assignedToUserId: string | null;
    },
  ): boolean {
    if (actor.role === 'SUPER_ADMIN') return true;

    if (actor.organizationId === issue.raisedByOrgId) return true;
    if (issue.assignedToOrgId && actor.organizationId === issue.assignedToOrgId) return true;
    if (issue.assignedToUserId && actor.userId === issue.assignedToUserId) return true;

    return false;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Return successfully to prevent email enumeration
      return;
    }

    // Delete any existing reset tokens for this user
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    await this.emailService.sendPasswordResetEmail(user.email, token);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }
    if (newPassword.length > 128) {
      throw new BadRequestException('Password must not exceed 128 characters');
    }

    const resetRecord = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.delete({
        where: { id: resetRecord.id },
      }),
    ]);
  }
}
