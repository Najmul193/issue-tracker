import { Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './decorators/current-user.decorator';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
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
  ): void {
    if (actor.role === 'SUPER_ADMIN') return;

    if (actor.role === 'ORG_ADMIN') {
      if (targetUserId && targetUserOrgId && targetUserOrgId !== actor.organizationId) {
        throw new ForbiddenException('ORG_ADMIN can only assign users within their own organization');
      }
      return;
    }

    if (actor.role === 'USER') {
      if (targetUserId) {
        if (!targetUserOrgId) {
          throw new ForbiddenException('Cannot assign to unknown user');
        }
        if (targetUserOrgId === actor.organizationId) {
          throw new ForbiddenException('You cannot assign to users in your own organization');
        }
        return;
      }
      if (targetOrgId) return;
      throw new ForbiddenException('Invalid assignment request');
    }

    throw new ForbiddenException('You are not authorized to assign issues');
  }

  /**
   * Part A: All authenticated users can view any issue.
   * Returns an empty filter (no restrictions) for all roles.
   */
  getVisibleIssuesFilter(_actor: JwtPayload): Prisma.IssueWhereInput {
    return {};
  }

  /**
   * Part B: Authorization check for status changes.
   * SUPER_ADMIN: always allowed.
   * Otherwise: allowed if actor's org matches raisedByOrgId or assignedToOrgId,
   * or if actor is the assigned user.
   */
  canActOnIssue(
    actor: JwtPayload,
    issue: { raisedByOrgId: string; assignedToOrgId: string | null; assignedToUserId: string | null },
  ): boolean {
    if (actor.role === 'SUPER_ADMIN') return true;

    if (actor.organizationId === issue.raisedByOrgId) return true;
    if (issue.assignedToOrgId && actor.organizationId === issue.assignedToOrgId) return true;
    if (issue.assignedToUserId && actor.userId === issue.assignedToUserId) return true;

    return false;
  }
}