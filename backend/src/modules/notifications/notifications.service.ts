import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { Prisma, NotifiedStage } from '@prisma/client';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly projectsService: ProjectsService,
  ) {}

  private async buildDashboardFilter(
    actor: JwtPayload,
    projectIds?: string,
  ): Promise<Prisma.IssueWhereInput> {
    const visibilityFilter = await this.projectsService.getVisibleProjectFilter(actor);
    if (!projectIds) return visibilityFilter;
    if (projectIds === '__none__') return { id: { in: [] } };
    const ids = projectIds.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return { id: { in: [] } };
    return { AND: [visibilityFilter, { projectId: { in: ids } }] };
  }

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
    query: { page?: string; limit?: string; unread?: string; projectIds?: string },
  ) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { userId: actor.userId };
    if (query.unread === 'true') {
      where.isRead = false;
    }
    if (query.projectIds) {
      if (query.projectIds === '__none__') {
        where.issue = { id: { in: [] } };
      } else {
        const ids = query.projectIds.split(',').map((s) => s.trim()).filter(Boolean);
        if (ids.length > 0) {
          where.issue = { projectId: { in: ids } };
        } else {
          where.issue = { id: { in: [] } };
        }
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          issue: {
            select: { id: true, title: true, projectId: true },
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

  async getUnreadCount(actor: JwtPayload, projectIds?: string) {
    const where: Prisma.NotificationWhereInput = { userId: actor.userId, isRead: false };
    if (projectIds) {
      if (projectIds === '__none__') {
        where.issue = { id: { in: [] } };
      } else {
        const ids = projectIds.split(',').map((s) => s.trim()).filter(Boolean);
        if (ids.length > 0) {
          where.issue = { projectId: { in: ids } };
        } else {
          where.issue = { id: { in: [] } };
        }
      }
    }
    const count = await this.prisma.notification.count({ where });
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
        updatedAt: true,
        deadline: true,
        lastNotifiedStage: true,
        assignedToUserId: true,
        assignedToOrgId: true,
        projectId: true,
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

      // Use updatedAt as proxy for last meaningful activity (assignment, status change)
      const lastActivity = issue.updatedAt || createdAt;
      const elapsed = now.getTime() - lastActivity.getTime();
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
  async getDashboardSummary(actor: JwtPayload, projectIds?: string) {
    const visibilityFilter = await this.buildDashboardFilter(actor, projectIds);

    const [statusCounts, priorityCounts] = await Promise.all([
      this.prisma.issue.groupBy({
        by: ['status'],
        where: visibilityFilter,
        _count: { id: true },
      }),
      this.prisma.issue.groupBy({
        by: ['priority'],
        where: visibilityFilter,
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

    const overdue = await this.prisma.issue.count({
      where: {
        ...visibilityFilter,
        deadline: { lt: new Date() },
        status: { notIn: ['CLOSED', 'VERIFIED'] as any },
      },
    });

    return { byStatus: statusSummary, byPriority: prioritySummary, overdue };
  }

  // ------- Dashboard metrics (extended) -------
  async getDashboardMetrics(actor: JwtPayload, projectIds?: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const visibilityFilter = await this.buildDashboardFilter(actor, projectIds);

    const [statusCounts, priorityCounts, typeCounts, overdueCount, resolvedThisMonth] =
      await Promise.all([
        this.prisma.issue.groupBy({ by: ['status'], where: visibilityFilter, _count: { id: true } }),
        this.prisma.issue.groupBy({ by: ['priority'], where: visibilityFilter, _count: { id: true } }),
        this.prisma.issue.groupBy({ by: ['type'], where: visibilityFilter, _count: { id: true } }),
        this.prisma.issue.count({
          where: {
            ...visibilityFilter,
            deadline: { lt: now },
            status: { notIn: ['CLOSED', 'VERIFIED'] as any },
          },
        }),
        this.prisma.issue.count({
          where: {
            ...visibilityFilter,
            status: { in: ['RESOLVED', 'CLOSED', 'VERIFIED'] as any },
            updatedAt: { gte: startOfMonth },
          },
        }),
      ]);

    const byStatus: Record<string, number> = {};
    for (const r of statusCounts) byStatus[r.status] = r._count.id;
    const byPriority: Record<string, number> = {};
    for (const r of priorityCounts) byPriority[r.priority] = r._count.id;
    const byType: Record<string, number> = {};
    for (const r of typeCounts) byType[r.type] = r._count.id;

    // Average resolution time (days) for closed/verified/resolved issues with resolvedAt
    const resolvedWithDate = await this.prisma.issue.findMany({
      where: {
        ...visibilityFilter,
        status: { in: ['RESOLVED', 'CLOSED', 'VERIFIED'] as any },
        resolvedAt: { not: null },
      },
      select: { createdAt: true, resolvedAt: true },
    });
    let avgResolutionDays: number | null = null;
    if (resolvedWithDate.length > 0) {
      const totalMs = resolvedWithDate.reduce((sum, i) => {
        return sum + (i.resolvedAt!.getTime() - i.createdAt.getTime());
      }, 0);
      avgResolutionDays = Math.round((totalMs / resolvedWithDate.length) / (1000 * 60 * 60 * 24));
    }

    // Trend: created vs resolved per day for last 30 days
    const [createdRaw, resolvedRaw] = await Promise.all([
      this.prisma.issue.findMany({
        where: { ...visibilityFilter, createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
      }),
      this.prisma.issue.findMany({
        where: {
          ...visibilityFilter,
          resolvedAt: { gte: thirtyDaysAgo, not: null },
          status: { in: ['RESOLVED', 'CLOSED', 'VERIFIED'] as any },
        },
        select: { resolvedAt: true },
      }),
    ]);

    const trendMap: Record<string, { created: number; resolved: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      trendMap[key] = { created: 0, resolved: 0 };
    }
    for (const r of createdRaw) {
      const key = r.createdAt.toISOString().split('T')[0];
      if (trendMap[key]) trendMap[key].created++;
    }
    for (const r of resolvedRaw) {
      const key = r.resolvedAt!.toISOString().split('T')[0];
      if (trendMap[key]) trendMap[key].resolved++;
    }
    const trendLast30Days = Object.entries(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    // My assigned issues (top 5 by deadline) — scoped to visibility
    const myAssignedIssues = await this.prisma.issue.findMany({
      where: {
        ...visibilityFilter,
        assignedToUserId: actor.userId,
        status: { notIn: ['CLOSED', 'VERIFIED'] as any },
      },
      orderBy: { deadline: 'asc' },
      take: 5,
      select: { id: true, title: true, priority: true, status: true, deadline: true },
    });

    // Recent activity (last 10 entries) — scoped to visible issues
    const recentActivity = await this.prisma.activityLog.findMany({
      where: {
        issue: visibilityFilter,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        oldValue: true,
        newValue: true,
        createdAt: true,
        user: { select: { name: true } },
        issue: { select: { id: true, title: true } },
      },
    });

    // Org comparison — SUPER_ADMIN only (no project filter)
    let orgComparison: Array<{ orgName: string; open: number; overdue: number }> = [];
    if (actor.role === 'SUPER_ADMIN') {
      const orgs = await this.prisma.organization.findMany({
        where: {
          type: { not: 'SUPER_ADMIN' as any },
          users: { some: { email: { not: { startsWith: 'deleted-' } } } },
        },
        select: { id: true, name: true },
      });
      const openStatuses = ['NEW', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED'];
      orgComparison = await Promise.all(
        orgs.map(async (org) => {
          const [open, overdue] = await Promise.all([
            this.prisma.issue.count({
              where: { raisedByOrgId: org.id, status: { in: openStatuses as any } },
            }),
            this.prisma.issue.count({
              where: {
                raisedByOrgId: org.id,
                deadline: { lt: now },
                status: { notIn: ['CLOSED', 'VERIFIED'] as any },
              },
            }),
          ]);
          return { orgName: org.name, open, overdue };
        }),
      );
    }

    return {
      byStatus,
      byPriority,
      byType,
      overdue: overdueCount,
      resolvedThisMonth,
      avgResolutionDays,
      trendLast30Days,
      myAssignedIssues,
      recentActivity,
      orgComparison,
    };
  }
}
