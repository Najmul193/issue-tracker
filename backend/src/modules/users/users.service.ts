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
    dto: { name: string; email: string; password: string; phone?: string; role: string; organizationId: string },
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
        organizationId: dto.organizationId,
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
    if (actor.role === 'SUPER_ADMIN') {
      return this.prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, email: true, organizationId: true, role: true },
        orderBy: { name: 'asc' },
      });
    }

    if (actor.role === 'ORG_ADMIN') {
      // If issue is assigned outside the actor's org, show users from other orgs (route outside)
      if (issueId) {
        const issue = await this.prisma.issue.findUnique({
          where: { id: issueId },
          select: { assignedToOrgId: true },
        });
        if (issue?.assignedToOrgId && issue.assignedToOrgId !== actor.organizationId) {
          return this.prisma.user.findMany({
            where: { organizationId: { not: actor.organizationId }, status: 'ACTIVE' },
            select: { id: true, name: true, email: true, organizationId: true, role: true },
            orderBy: { name: 'asc' },
          });
        }
      }
      // Otherwise show only internal users
      return this.prisma.user.findMany({
        where: { organizationId: actor.organizationId, status: 'ACTIVE' },
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

    // USER: only users from other orgs (can't assign to own org members)
    return this.prisma.user.findMany({
      where: { organizationId: { not: actor.organizationId }, status: 'ACTIVE' },
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
}