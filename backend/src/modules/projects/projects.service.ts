import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { Prisma, OrganizationType } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: { name: string; description?: string; organizationIds: string[] },
    actor: JwtPayload,
  ) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN can create projects');
    }

    const orgs = await this.prisma.organization.findMany({
      where: { id: { in: dto.organizationIds } },
    });

    if (orgs.length !== dto.organizationIds.length) {
      throw new BadRequestException('One or more organization IDs are invalid');
    }

    const types = new Set(orgs.map((o) => o.type));
    if (!types.has('CLIENT')) {
      throw new BadRequestException('At least one CLIENT organization is required');
    }
    if (!types.has('SI')) {
      throw new BadRequestException('At least one SI organization is required');
    }
    if (!types.has('OEM')) {
      throw new BadRequestException('At least one OEM organization is required');
    }

    const existing = await this.prisma.project.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('A project with this name already exists');
    }

    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        organizations: {
          create: dto.organizationIds.map((orgId) => ({
            organizationId: orgId,
          })),
        },
      },
      include: {
        organizations: {
          include: { organization: { select: { id: true, name: true, type: true } } },
        },
        _count: { select: { users: true, issues: true } },
      },
    });

    const allOrgUsers = await this.prisma.user.findMany({
      where: {
        organizationId: { in: dto.organizationIds },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (allOrgUsers.length > 0) {
      await this.prisma.projectUser.createMany({
        data: allOrgUsers.map((u) => ({
          projectId: project.id,
          userId: u.id,
          addedById: actor.userId,
        })),
        skipDuplicates: true,
      });
    }

    return project;
  }

  async findAll(actor: JwtPayload) {
    if (actor.role === 'SUPER_ADMIN') {
      return this.prisma.project.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          organizations: {
            include: { organization: { select: { id: true, name: true, type: true } } },
          },
          _count: { select: { users: true, issues: true } },
        },
      });
    }

    if (actor.role === 'ORG_ADMIN') {
      return this.prisma.project.findMany({
        where: {
          organizations: {
            some: { organizationId: actor.organizationId },
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          organizations: {
            include: { organization: { select: { id: true, name: true, type: true } } },
          },
          _count: { select: { users: true, issues: true } },
        },
      });
    }

    return this.prisma.project.findMany({
      where: {
        users: {
          some: { userId: actor.userId },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        organizations: {
          include: { organization: { select: { id: true, name: true, type: true } } },
        },
        _count: { select: { users: true, issues: true } },
      },
    });
  }

  async findOne(id: string, actor: JwtPayload) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        organizations: {
          include: { organization: { select: { id: true, name: true, type: true } } },
        },
        _count: { select: { users: true, issues: true } },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    await this.assertMember(id, actor);

    return project;
  }

  async update(id: string, dto: { name?: string; description?: string }, actor: JwtPayload) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN can update projects');
    }

    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');

    if (dto.name && dto.name !== project.name) {
      const existing = await this.prisma.project.findUnique({ where: { name: dto.name } });
      if (existing) {
        throw new ConflictException('A project with this name already exists');
      }
    }

    return this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
      include: {
        organizations: {
          include: { organization: { select: { id: true, name: true, type: true } } },
        },
        _count: { select: { users: true, issues: true } },
      },
    });
  }

  async remove(id: string, actor: JwtPayload) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN can delete projects');
    }

    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');

    // Clear project reference and assignments for issues in this project
    await this.prisma.issue.updateMany({
      where: { projectId: id },
      data: {
        projectId: null,
        assignedToUserId: null,
        assignedToOrgId: null,
      },
    });

    await this.prisma.project.delete({ where: { id } });

    return { message: 'Project deleted successfully' };
  }

  async addOrganization(projectId: string, organizationId: string, actor: JwtPayload) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN can manage project organizations');
    }

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const existing = await this.prisma.projectOrganization.findUnique({
      where: { projectId_organizationId: { projectId, organizationId } },
    });
    if (existing) {
      throw new ConflictException('Organization is already in this project');
    }

    const result = await this.prisma.projectOrganization.create({
      data: { projectId, organizationId },
      include: { organization: { select: { id: true, name: true, type: true } } },
    });

    const orgUsers = await this.prisma.user.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: { id: true },
    });

    if (orgUsers.length > 0) {
      await this.prisma.projectUser.createMany({
        data: orgUsers.map((u) => ({
          projectId,
          userId: u.id,
          addedById: actor.userId,
        })),
        skipDuplicates: true,
      });
    }

    return result;
  }

  async removeOrganization(projectId: string, organizationId: string, actor: JwtPayload) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN can manage project organizations');
    }

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const existing = await this.prisma.projectOrganization.findUnique({
      where: { projectId_organizationId: { projectId, organizationId } },
    });
    if (!existing) {
      throw new NotFoundException('Organization is not in this project');
    }

    const usersToRemove = await this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true },
    });

    await this.prisma.projectUser.deleteMany({
      where: {
        projectId,
        userId: { in: usersToRemove.map((u) => u.id) },
      },
    });

    await this.prisma.projectOrganization.delete({
      where: { projectId_organizationId: { projectId, organizationId } },
    });

    // Unset assignedToOrgId on issues in this project that reference the removed org
    await this.prisma.issue.updateMany({
      where: { projectId, assignedToOrgId: organizationId },
      data: { assignedToOrgId: null },
    });

    // Also clear individual user assignments for users from the removed org
    const userIdsToRemove = usersToRemove.map((u) => u.id);
    if (userIdsToRemove.length > 0) {
      await this.prisma.issue.updateMany({
        where: {
          projectId,
          assignedToUserId: { in: userIdsToRemove },
        },
        data: { assignedToUserId: null },
      });
    }

    return { message: 'Organization removed from project' };
  }

  async getUsers(projectId: string, actor: JwtPayload) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    await this.assertMember(projectId, actor);

    return this.prisma.projectUser.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            organization: { select: { id: true, name: true, type: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addUser(projectId: string, userId: string, actor: JwtPayload) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const isOrgMember = await this.prisma.projectOrganization.findUnique({
      where: { projectId_organizationId: { projectId, organizationId: user.organizationId } },
    });
    if (!isOrgMember) {
      throw new BadRequestException(
        'User must belong to an organization that is a member of this project',
      );
    }

    if (actor.role !== 'SUPER_ADMIN') {
      if (actor.role === 'ORG_ADMIN' && actor.organizationId !== user.organizationId) {
        throw new ForbiddenException('ORG_ADMIN can only add users from their own organization');
      }
      if (actor.role === 'USER') {
        throw new ForbiddenException('USER cannot add users to projects');
      }
    }

    const existing = await this.prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (existing) {
      throw new ConflictException('User is already in this project');
    }

    return this.prisma.projectUser.create({
      data: {
        projectId,
        userId,
        addedById: actor.userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            organization: { select: { id: true, name: true, type: true } },
          },
        },
      },
    });
  }

  async removeUser(projectId: string, userId: string, actor: JwtPayload) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const existing = await this.prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!existing) {
      throw new NotFoundException('User is not in this project');
    }

    if (actor.role !== 'SUPER_ADMIN') {
      const targetUser = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) throw new NotFoundException('User not found');

      if (actor.role === 'ORG_ADMIN' && actor.organizationId !== targetUser.organizationId) {
        throw new ForbiddenException('ORG_ADMIN can only remove users from their own organization');
      }
      if (actor.role === 'USER') {
        throw new ForbiddenException('USER cannot remove users from projects');
      }
    }

    await this.prisma.projectUser.delete({
      where: { projectId_userId: { projectId, userId } },
    });

    return { message: 'User removed from project' };
  }

  async getOrganizations(projectId: string, actor: JwtPayload) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    await this.assertMember(projectId, actor);

    return this.prisma.projectOrganization.findMany({
      where: {
        projectId,
        organization: {
          users: { some: { email: { not: { startsWith: 'deleted-' } } } },
        },
      },
      include: { organization: { select: { id: true, name: true, type: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async assertMember(projectId: string, actor: JwtPayload) {
    if (actor.role === 'SUPER_ADMIN') return;

    const isOrgMember = await this.prisma.projectOrganization.findUnique({
      where: {
        projectId_organizationId: { projectId, organizationId: actor.organizationId },
      },
    });

    if (actor.role === 'ORG_ADMIN') {
      if (!isOrgMember) {
        throw new ForbiddenException('You do not have access to this project');
      }
      return;
    }

    const isUserMember = await this.prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId, userId: actor.userId } },
    });

    if (!isUserMember) {
      throw new ForbiddenException('You do not have access to this project');
    }
  }

  async getVisibleProjectFilter(actor: JwtPayload): Promise<Prisma.IssueWhereInput> {
    if (actor.role === 'SUPER_ADMIN') return {};

    if (actor.role === 'ORG_ADMIN') {
      return {
        project: {
          organizations: {
            some: { organizationId: actor.organizationId },
          },
        },
      };
    }

    // USER role: see issues in projects they're members of, OR non-project issues they're directly involved with
    return {
      OR: [
        // Issues in projects the user is a member of
        {
          project: {
            users: {
              some: { userId: actor.userId },
            },
          },
        },
        // Issues without a project where user is directly involved
        {
          projectId: null,
          OR: [{ raisedById: actor.userId }, { assignedToUserId: actor.userId }],
        },
      ],
    };
  }
}
