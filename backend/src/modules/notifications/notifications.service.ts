import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { Prisma, NotifiedStage } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async createNotification(data: {
    userId: string;
    issueId: string;
    message: string;
    type: 'ASSIGNMENT' | 'STATUS_CHANGE' | 'DEADLINE_WARNING' | 'OVERDUE';
  }) {
    return this.prisma.notification.create({ data });
  }

  async createNotificationsBulk(
    items: { userId: string; issueId: string; message: string; type: 'ASSIGNMENT' | 'STATUS_CHANGE' | 'DEADLINE_WARNING' | 'OVERDUE' }[],
  ) {
    if (items.length === 0) return;
    await this.prisma.notification.createMany({ data: items });
  }

  async createStatusChangeNotifications(
    issueId: string,
    issueTitle: string,
    oldStatus: string,
    newStatus: string,
    raisedById: string,
    assignedToUserId: string | null,
  ) {
    const message = `Issue "${issueTitle}" status changed from ${oldStatus} to ${newStatus}`;
    const userIds: string[] = [raisedById];
    if (assignedToUserId && assignedToUserId !== raisedById) {
      userIds.push(assignedToUserId);
    }

    await this.createNotificationsBulk(
      userIds.map((uid) => ({
        userId: uid,
        issueId,
        message,
        type: 'STATUS_CHANGE' as const,
      })),
    );
  }

  // ------- Endpoints -------

  async findAllForUser(
    actor: JwtPayload,
    query: { page?: string; limit?: string; unread?: string },
  ) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { userId: actor.userId };
    if (query.unread === 'true') {
      where.isRead = false;
    }

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          issue: {
            select: { id: true, title: true },
          },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async markAsRead(id: string, actor: JwtPayload) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      return null;
    }
    if (notification.userId !== actor.userId) {
      return null;
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(actor: JwtPayload) {
    await this.prisma.notification.updateMany({
      where: { userId: actor.userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  async getUnreadCount(actor: JwtPayload) {
    const count = await this.prisma.notification.count({
      where: { userId: actor.userId, isRead: false },
    });
    return { count };
  }

  // ------- Deadline monitoring logic -------

  async checkDeadlines(): Promise<number> {
    const now = new Date();
    const TERMINAL_STATUSES: string[] = ['RESOLVED', 'VERIFIED', 'CLOSED'];
    let totalNotifications = 0;

    // Find issues with deadlines that are not in terminal statuses
    const issues = await this.prisma.issue.findMany({
      where: {
        deadline: { not: null },
        status: { notIn: TERMINAL_STATUSES as any },
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        deadline: true,
        lastNotifiedStage: true,
        assignedToUserId: true,
        assignedToOrgId: true,
        assignedToUser: { select: { id: true, email: true, name: true } },
        assignedToOrg: {
          select: {
            id: true,
            name: true,
            users: {
              where: { status: 'ACTIVE' },
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    });

    for (const issue of issues) {
      if (!issue.deadline) continue;
      const deadline: Date = issue.deadline;
      const createdAt = issue.createdAt;
      const totalDuration = deadline.getTime() - createdAt.getTime();

      if (totalDuration <= 0) continue;

      const elapsed = now.getTime() - createdAt.getTime();
      const pct = (elapsed / totalDuration) * 100;

      // ---- Overdue check ----
      if (now > deadline && issue.lastNotifiedStage !== NotifiedStage.OVERDUE_SENT) {
        totalNotifications += await this.sendOverdueNotifications({
          ...issue,
          deadline,
        });
        await this.prisma.issue.update({
          where: { id: issue.id },
          data: { lastNotifiedStage: 'OVERDUE_SENT' as any },
        });
        continue;
      }

      // ---- Warning check (only if not already past overdue) ----
      if (
        pct >= 80 &&
        issue.lastNotifiedStage === NotifiedStage.NONE
      ) {
        totalNotifications += await this.sendWarningNotifications(issue);
        await this.prisma.issue.update({
          where: { id: issue.id },
          data: { lastNotifiedStage: 'WARNING_SENT' as any },
        });
      }
    }

    return totalNotifications;
  }

  private async sendWarningNotifications(issue: {
    id: string;
    title: string;
    assignedToUserId: string | null;
    assignedToOrg: { id: string; name: string; users: { id: string; email: string; name: string }[] } | null;
  }): Promise<number> {
    const message = `Issue "${issue.title}" deadline is approaching (80% of time elapsed)`;
    const notifs: { userId: string; issueId: string; message: string; type: 'DEADLINE_WARNING' }[] = [];

    if (issue.assignedToUserId) {
      notifs.push({
        userId: issue.assignedToUserId,
        issueId: issue.id,
        message,
        type: 'DEADLINE_WARNING',
      });
    } else if (issue.assignedToOrg) {
      for (const u of issue.assignedToOrg.users) {
        notifs.push({
          userId: u.id,
          issueId: issue.id,
          message,
          type: 'DEADLINE_WARNING',
        });
      }
    }

    if (notifs.length > 0) {
      await this.createNotificationsBulk(notifs);
    }
    return notifs.length;
  }

  private async sendOverdueNotifications(issue: {
    id: string;
    title: string;
    deadline: Date;
    assignedToUserId: string | null;
    assignedToOrgId: string | null;
    assignedToOrg: { id: string; name: string; users: { id: string; email: string; name: string }[] } | null;
  }): Promise<number> {
    const message = `Issue "${issue.title}" is past its deadline (OVERDUE)`;
    const notifs: { userId: string; issueId: string; message: string; type: 'OVERDUE' }[] = [];
    const recipientUserIds = new Set<string>();

    // Add assignee
    if (issue.assignedToUserId) {
      recipientUserIds.add(issue.assignedToUserId);
    } else if (issue.assignedToOrg) {
      for (const u of issue.assignedToOrg.users) {
        recipientUserIds.add(u.id);
      }
    }

    // Add ORG_ADMINs of the assigned org
    if (issue.assignedToOrgId) {
      const orgAdmins = await this.prisma.user.findMany({
        where: {
          organizationId: issue.assignedToOrgId,
          role: 'ORG_ADMIN',
          status: 'ACTIVE',
        },
      });
      for (const u of orgAdmins) {
        recipientUserIds.add(u.id);
      }
    }

    // Add all SUPER_ADMINs
    const superAdminUsers = await this.prisma.user.findMany({
      where: {
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });
    for (const u of superAdminUsers) {
      recipientUserIds.add(u.id);
    }

    for (const userId of recipientUserIds) {
      notifs.push({
        userId,
        issueId: issue.id,
        message,
        type: 'OVERDUE',
      });
    }

    if (notifs.length > 0) {
      await this.createNotificationsBulk(notifs);
    }

    // Send overdue emails (non-blocking)
    for (const userId of recipientUserIds) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });
      if (user) {
        this.emailService
          .sendOverdueEmail(user.email, issue.title, issue.id, issue.deadline)
          .catch((err) =>
            this.logger.error(
              `Overdue email failed for ${user.email}: ${err.message}`,
            ),
          );
      }
    }

    return notifs.length;
  }

  // Reset lastNotifiedStage when issue is reassigned or deadline changes
  async resetNotifiedStage(issueId: string) {
    await this.prisma.issue.update({
      where: { id: issueId },
      data: { lastNotifiedStage: NotifiedStage.NONE },
    });
  }

  // ------- Dashboard summary -------
  async getDashboardSummary(actor: JwtPayload) {
    const filter = this.getVisibleIssuesFilter(actor);

    const [statusCounts, priorityCounts] = await Promise.all([
      this.prisma.issue.groupBy({
        by: ['status'],
        where: filter,
        _count: { id: true },
      }),
      this.prisma.issue.groupBy({
        by: ['priority'],
        where: filter,
        _count: { id: true },
      }),
    ]);

    const statusSummary: Record<string, number> = {};
    for (const row of statusCounts) {
      statusSummary[row.status] = row._count.id;
    }

    const prioritySummary: Record<string, number> = {};
    for (const row of priorityCounts) {
      prioritySummary[row.priority] = row._count.id;
    }

    return { byStatus: statusSummary, byPriority: prioritySummary };
  }

  // Copied from AuthService to avoid circular dependencies
  private getVisibleIssuesFilter(actor: JwtPayload): Prisma.IssueWhereInput {
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