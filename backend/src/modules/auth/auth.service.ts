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
  ): void {
    if (actor.role === 'SUPER_ADMIN') {
      return;
    }

    if (actor.role === 'ORG_ADMIN') {
      if (targetUserId && targetOrgId) {
        const actorOrg = actor.organizationId;
        if (targetOrgId !== actorOrg) {
          throw new ForbiddenException(
            'ORG_ADMIN can only assign users within their own org when specifying a user',
          );
        }
        return;
      }

      if (targetUserId && !targetOrgId) {
        return;
      }

      if (targetOrgId && !targetUserId) {
        return;
      }

      return;
    }

    throw new ForbiddenException('USER cannot assign issues');
  }

  getVisibleIssuesFilter(actor: JwtPayload): Prisma.IssueWhereInput {
    if (actor.role === 'SUPER_ADMIN') {
      return {};
    }

    if (actor.role === 'ORG_ADMIN') {
      return {
        OR: [
          { raisedByOrgId: actor.organizationId },
          { assignedToOrgId: actor.organizationId },
        ],
      };
    }

    return {
      OR: [
        { assignedToUserId: actor.userId },
        {
          assignedToOrgId: actor.organizationId,
          assignedToUserId: null,
        },
        { raisedById: actor.userId },
      ],
    };
  }
}
