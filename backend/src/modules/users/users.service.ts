import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/decorators/current-user.decorator';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { organization: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(
    dto: { name: string; email: string; password: string; phone?: string; role: string; organizationId?: string; newOrganizationName?: string; newOrganizationType?: string },
    actor: JwtPayload,
  ) {
    // Permission check
    if (actor.role === 'USER') {
      throw new ForbiddenException('USER cannot create users');
    }

    if (actor.role === 'ORG_ADMIN') {
      if (dto.role !== 'USER') {
        throw new ForbiddenException('ORG_ADMIN can only create USER accounts');
      }
      if (dto.organizationId !== actor.organizationId) {
        throw new ForbiddenException('ORG_ADMIN can only create users in their own organization');
      }
    }

    // SUPER_ADMIN: create new org on the fly
    let orgId = dto.organizationId;
    if (actor.role === 'SUPER_ADMIN' && dto.newOrganizationName) {
      const org = await this.prisma.organization.create({
        data: {
          name: dto.newOrganizationName,
          type: (dto.newOrganizationType || 'BANK') as any,
        },
      });
      orgId = org.id;
    }

    if (!orgId) {
      throw new Error('Missing organizationId'); // will 500, but should be caught by validation upstream
    }

    // Check email uniqueness
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        phone: dto.phone ?? null,
        role: dto.role as any,
        organizationId: orgId,
        status: 'ACTIVE',
      },
      select: { id: true, name: true, email: true, role: true, organizationId: true, status: true, createdAt: true },
    });

    return user;
  }

  async findAll(actor: JwtPayload) {
    if (actor.role === 'USER') {
      throw new ForbiddenException('USER cannot list users');
    }

    return this.prisma.user.findMany({
      where: actor.role === 'ORG_ADMIN' ? { organizationId: actor.organizationId } : undefined,
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, email: true, role: true,
        organizationId: true, status: true, phone: true, createdAt: true,
        organization: { select: { id: true, name: true } },
      },
    });
  }

  async findAssignable(actor: JwtPayload, issueId?: string) {
    // SUPER_ADMIN users never assign issues — return empty
    if (actor.role === 'SUPER_ADMIN') {
      return [];
    }

    const actorOrgType = actor.organizationType as any;

    if (actor.role === 'ORG_ADMIN') {
      if (issueId) {
        const issue = await this.prisma.issue.findUnique({
          where: { id: issueId },
          select: {
            raisedByOrgId: true,
            assignedToOrgId: true,
            assignedToUser: { select: { organizationId: true } },
          },
        });
        if (issue) {
          const currentAssignedOrgId = issue.assignedToOrgId ?? issue.assignedToUser?.organizationId ?? null;
          const isRaiser = issue.raisedByOrgId === actor.organizationId;
          const isAssignedToActorOrg = currentAssignedOrgId === actor.organizationId;

          // Raiser's org admin, issue outside their org → show users from different-typed orgs only
          if (isRaiser && !isAssignedToActorOrg) {
            return this.prisma.user.findMany({
              where: {
                status: 'ACTIVE',
                role: { not: 'SUPER_ADMIN' },
                organization: { type: { not: actorOrgType } },
              },
              select: { id: true, name: true, email: true, organizationId: true, role: true },
              orderBy: { name: 'asc' },
            });
          }

          // Issue is in actor's org → show internal users
          if (isAssignedToActorOrg) {
            return this.prisma.user.findMany({
              where: { organizationId: actor.organizationId, status: 'ACTIVE', role: { not: 'SUPER_ADMIN' } },
              select: { id: true, name: true, email: true, organizationId: true, role: true },
              orderBy: { name: 'asc' },
            });
          }
        }
      }
      // Fallback: internal only
      return this.prisma.user.findMany({
        where: { organizationId: actor.organizationId, status: 'ACTIVE', role: { not: 'SUPER_ADMIN' } },
        select: { id: true, name: true, email: true, organizationId: true, role: true },
        orderBy: { name: 'asc' },
      });
    }

    // If actor is the current assignee, only admins in their own org
    if (issueId) {
      const issue = await this.prisma.issue.findUnique({
        where: { id: issueId },
        select: { assignedToUserId: true },
      });
      if (issue && issue.assignedToUserId === actor.userId) {
        return this.prisma.user.findMany({
          where: { organizationId: actor.organizationId, role: 'ORG_ADMIN', status: 'ACTIVE' },
          select: { id: true, name: true, email: true, organizationId: true, role: true },
          orderBy: { name: 'asc' },
        });
      }
    }

    // USER: only users from different-typed orgs (can't assign to own org or same-type orgs)
    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        role: { not: 'SUPER_ADMIN' },
        organization: { type: { not: actorOrgType } },
      },
      select: { id: true, name: true, email: true, organizationId: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  async update(
    id: string,
    dto: { name?: string; phone?: string; status?: string },
    actor: JwtPayload,
  ) {
    if (actor.role === 'USER') {
      throw new ForbiddenException('USER cannot update users');
    }

    const target = await this.findById(id);

    // Prevent self-deactivation
    if (dto.status === 'INACTIVE' && id === actor.userId) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    if (actor.role === 'ORG_ADMIN') {
      if (target.organizationId !== actor.organizationId) {
        throw new ForbiddenException('ORG_ADMIN can only update users in their own organization');
      }
      if (target.role !== 'USER') {
        throw new ForbiddenException('ORG_ADMIN can only update USER accounts');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.status !== undefined ? { status: dto.status as any } : {}),
      },
      select: {
        id: true, name: true, email: true, role: true,
        organizationId: true, status: true, phone: true, createdAt: true,
        organization: { select: { id: true, name: true } },
      },
    });

    return updated;
  }

  async remove(id: string, actor: JwtPayload) {
    if (actor.role === 'USER') {
      throw new ForbiddenException('USER cannot delete users');
    }

    if (id === actor.userId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const target = await this.findById(id);

    if (target.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot delete a SUPER_ADMIN user');
    }

    if (actor.role === 'ORG_ADMIN') {
      if (target.organizationId !== actor.organizationId) {
        throw new ForbiddenException('ORG_ADMIN can only delete users in their own organization');
      }
      if (target.role !== 'USER') {
        throw new ForbiddenException('ORG_ADMIN can only delete USER accounts');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete user's notifications
      await tx.notification.deleteMany({ where: { userId: id } });
      // Delete user's activity logs
      await tx.activityLog.deleteMany({ where: { userId: id } });
      // Delete user's comments
      await tx.comment.deleteMany({ where: { userId: id } });
      // Delete user's attachments
      await tx.attachment.deleteMany({ where: { uploadedById: id } });
      // Delete issue assignee records
      await tx.issueAssignee.deleteMany({ where: { userId: id } });
      // Unset issue references
      await tx.issue.updateMany({ where: { assignedToUserId: id }, data: { assignedToUserId: null } });
      await tx.issue.updateMany({ where: { assignedById: id }, data: { assignedById: null } });
      await tx.issue.updateMany({ where: { resolvedById: id }, data: { resolvedById: null } });
      // Delete the user
      await tx.user.delete({ where: { id } });
    });

    return { message: 'User deleted successfully' };
  }
}