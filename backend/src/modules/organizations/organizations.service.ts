import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/decorators/current-user.decorator';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.organization.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    });
  }

  async remove(id: string, actor: JwtPayload) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN can delete organizations');
    }

    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    await this.prisma.$transaction(async (tx) => {
      // Get all users in this org
      const users = await tx.user.findMany({ where: { organizationId: id }, select: { id: true } });
      const userIds = users.map((u) => u.id);

      if (userIds.length > 0) {
        // Delete notifications for all users
        await tx.notification.deleteMany({ where: { userId: { in: userIds } } });
        // Delete activity logs
        await tx.activityLog.deleteMany({ where: { userId: { in: userIds } } });
        // Delete comments
        await tx.comment.deleteMany({ where: { userId: { in: userIds } } });
        // Delete attachments
        await tx.attachment.deleteMany({ where: { uploadedById: { in: userIds } } });
        // Delete issue assignee records
        await tx.issueAssignee.deleteMany({ where: { userId: { in: userIds } } });
        // Unset issue references for these users
        await tx.issue.updateMany({ where: { assignedToUserId: { in: userIds } }, data: { assignedToUserId: null } });
        await tx.issue.updateMany({ where: { assignedById: { in: userIds } }, data: { assignedById: null } });
        await tx.issue.updateMany({ where: { resolvedById: { in: userIds } }, data: { resolvedById: null } });
        // Soft-delete users in this org (keep records for raisedById FK)
        for (const uid of userIds) {
          await tx.user.update({
            where: { id: uid },
            data: { email: `deleted-${uid}@deleted.com`, passwordHash: '', phone: null, status: 'INACTIVE' },
          });
        }
      }

      // Unset assignedToOrgId (no one left to manage the queue)
      await tx.issue.updateMany({ where: { assignedToOrgId: id }, data: { assignedToOrgId: null } });
      // Mark org as deleted (keep record for issue history)
      await tx.organization.update({ where: { id }, data: { deletedAt: new Date() } });
    });

    return { message: 'Organization deleted successfully' };
  }
}
