import { Injectable, ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { AddManagerDto } from './dto/add-manager.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: JwtPayload, organizationId?: string) {
    const where: any = {};

    if (actor.role === 'SUPER_ADMIN') {
      if (organizationId) {
        where.organizationId = organizationId;
      }
    } else if (actor.role === 'ORG_ADMIN') {
      where.organizationId = actor.organizationId;
    } else {
      where.organizationId = actor.organizationId;
    }

    return this.prisma.department.findMany({
      where,
      select: {
        id: true,
        name: true,
        organizationId: true,
        createdAt: true,
        organization: { select: { id: true, name: true, type: true } },
        managers: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        _count: {
          select: { users: true, issues: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, actor: JwtPayload) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, type: true } },
        managers: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, email: true, role: true, status: true } },
          },
        },
        users: {
          where: { email: { not: { startsWith: 'deleted-' } } },
          select: { id: true, name: true, email: true, role: true, status: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!dept) {
      throw new NotFoundException('Department not found');
    }

    if (actor.role !== 'SUPER_ADMIN' && dept.organizationId !== actor.organizationId) {
      throw new ForbiddenException('Cannot access departments in other organizations');
    }

    return dept;
  }

  async create(dto: CreateDepartmentDto, actor: JwtPayload) {
    if (actor.role === 'USER') {
      throw new ForbiddenException('USER role cannot create departments');
    }

    const targetOrgId = actor.role === 'SUPER_ADMIN' ? dto.organizationId : actor.organizationId;

    if (actor.role === 'ORG_ADMIN' && dto.organizationId !== actor.organizationId) {
      throw new ForbiddenException('ORG_ADMIN can only create departments in their own organization');
    }

    const org = await this.prisma.organization.findUnique({ where: { id: targetOrgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.type === 'SUPER_ADMIN') {
      throw new BadRequestException('Cannot create departments in SUPER_ADMIN organization');
    }

    try {
      return await this.prisma.department.create({
        data: {
          name: dto.name.trim(),
          organizationId: targetOrgId,
        },
        select: {
          id: true,
          name: true,
          organizationId: true,
          createdAt: true,
          organization: { select: { id: true, name: true, type: true } },
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException(`Department "${dto.name.trim()}" already exists in this organization`);
      }
      throw e;
    }
  }

  async remove(id: string, actor: JwtPayload) {
    if (actor.role === 'USER') {
      throw new ForbiddenException('USER role cannot delete departments');
    }

    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
      },
    });

    if (!dept) {
      throw new NotFoundException('Department not found');
    }

    if (actor.role === 'ORG_ADMIN' && dept.organizationId !== actor.organizationId) {
      throw new ForbiddenException('ORG_ADMIN can only delete departments in their own organization');
    }

    const activeIssueCount = await this.prisma.issue.count({
      where: {
        assignedToDepartmentId: id,
        status: { notIn: ['CLOSED', 'VERIFIED'] },
      },
    });

    if (activeIssueCount > 0) {
      await this.prisma.issue.updateMany({
        where: { assignedToDepartmentId: id },
        data: { assignedToDepartmentId: null },
      });
    }

    await this.prisma.department.delete({ where: { id } });

    return { message: `Department "${dept.name}" deleted. ${activeIssueCount} active issues reassigned to org queue.` };
  }

  async addManager(id: string, dto: AddManagerDto, actor: JwtPayload) {
    if (actor.role === 'USER') {
      throw new ForbiddenException('USER role cannot manage departments');
    }

    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) {
      throw new NotFoundException('Department not found');
    }

    if (actor.role === 'ORG_ADMIN' && dept.organizationId !== actor.organizationId) {
      throw new ForbiddenException('ORG_ADMIN can only manage departments in their own organization');
    }

    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.organizationId !== dept.organizationId) {
      throw new ForbiddenException('User must belong to the same organization as the department');
    }

    if (user.departmentId !== id) {
      throw new BadRequestException('User must belong to this department to be a manager');
    }

    if (user.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot add inactive user as manager');
    }

    try {
      await this.prisma.departmentManager.create({
        data: {
          departmentId: id,
          userId: dto.userId,
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException('User is already a manager of this department');
      }
      throw e;
    }

    return this.findOne(id, actor);
  }

  async removeManager(id: string, userId: string, actor: JwtPayload) {
    if (actor.role === 'USER') {
      throw new ForbiddenException('USER role cannot manage departments');
    }

    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) {
      throw new NotFoundException('Department not found');
    }

    if (actor.role === 'ORG_ADMIN' && dept.organizationId !== actor.organizationId) {
      throw new ForbiddenException('ORG_ADMIN can only manage departments in their own organization');
    }

    const manager = await this.prisma.departmentManager.findUnique({
      where: { departmentId_userId: { departmentId: id, userId } },
    });

    if (!manager) {
      throw new NotFoundException('User is not a manager of this department');
    }

    await this.prisma.departmentManager.delete({
      where: { departmentId_userId: { departmentId: id, userId } },
    });

    return this.findOne(id, actor);
  }

  async getManagers(id: string, actor: JwtPayload) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) {
      throw new NotFoundException('Department not found');
    }

    if (actor.role !== 'SUPER_ADMIN' && dept.organizationId !== actor.organizationId) {
      throw new ForbiddenException('Cannot access departments in other organizations');
    }

    return this.prisma.departmentManager.findMany({
      where: { departmentId: id },
      select: {
        id: true,
        departmentId: true,
        userId: true,
        user: { select: { id: true, name: true, email: true, role: true } },
        createdAt: true,
      },
    });
  }
}
