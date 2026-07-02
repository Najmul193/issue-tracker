import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { StateMachine } from './state-machine';
import { CreateIssueDto } from './dto/create-issue.dto';
import { AssignIssueDto } from './dto/assign-issue.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { QueryIssuesDto } from './dto/query-issues.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { IssueStatus, IssuePriority, IssueType, Prisma } from '@prisma/client';
import { AttachmentsService } from '../attachments/attachments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../notifications/email.service';

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly stateMachine: StateMachine,
    private readonly attachmentsService: AttachmentsService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateIssueDto, actor: JwtPayload) {
    const deadline = new Date(dto.deadline);
    if (deadline <= new Date()) {
      throw new BadRequestException('Deadline must be in the future');
    }

    const issue = await this.prisma.issue.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        type: dto.type,
        priority: dto.priority,
        deadline,
        module: dto.module ?? null,
        raisedById: actor.userId,
        raisedByOrgId: actor.organizationId,
      },
      include: {
        raisedBy: { select: { id: true, name: true, email: true } },
        raisedByOrg: { select: { id: true, name: true } },
      },
    });

    return issue;
  }

  async findAll(query: QueryIssuesDto, actor: JwtPayload) {
    const baseFilter = this.authService.getVisibleIssuesFilter(actor);
    const andClauses: Prisma.IssueWhereInput[] = [];

    if (query.status) andClauses.push({ status: query.status });
    if (query.priority) andClauses.push({ priority: query.priority });
    if (query.type) andClauses.push({ type: query.type });
    if (query.module) andClauses.push({ module: { contains: query.module, mode: 'insensitive' } });
    if (query.assignedOrg) andClauses.push({ assignedToOrgId: query.assignedOrg });
    if (query.overdue === 'true') {
      andClauses.push({ deadline: { lt: new Date() }, status: { notIn: ['CLOSED', 'VERIFIED'] as IssueStatus[] } });
    }

    const where: Prisma.IssueWhereInput = {
      AND: [baseFilter, ...(andClauses.length > 0 ? andClauses : [{}])],
    };

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          raisedBy: { select: { id: true, name: true, email: true } },
          assignedToUser: { select: { id: true, name: true, email: true } },
          raisedByOrg: { select: { id: true, name: true } },
          assignedToOrg: { select: { id: true, name: true } },
        },
      }),
      this.prisma.issue.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, actor: JwtPayload) {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: {
        raisedBy: { select: { id: true, name: true, email: true } },
        raisedByOrg: { select: { id: true, name: true } },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedToOrg: { select: { id: true, name: true } },
        assignedBy: { select: { id: true, name: true, email: true } },
        comments: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        attachments: true,
        activityLogs: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!issue) throw new NotFoundException('Issue not found');

    const filter = this.authService.getVisibleIssuesFilter(actor);
    const visible = await this.prisma.issue.findFirst({
      where: { id, AND: [filter] },
    });
    if (!visible) throw new NotFoundException('Issue not found');

    return issue;
  }

  async assign(id: string, dto: AssignIssueDto, actor: JwtPayload) {
    const issue = await this.findOne(id, actor);

    this.authService.canAssign(actor, dto.targetUserId ?? null, dto.targetOrgId ?? null);

    const oldData = {
      assignedToUserId: issue.assignedToUserId,
      assignedToOrgId: issue.assignedToOrgId,
    };

    const updated = await this.prisma.issue.update({
      where: { id },
      data: {
        assignedToUserId: dto.targetUserId ?? null,
        assignedToOrgId: dto.targetOrgId ?? null,
        assignedById: actor.userId,
        status: (issue.status === 'NEW' || issue.status === 'ACKNOWLEDGED') ? 'ASSIGNED' : issue.status,
        closedAt: null,
      },
    });

    const action = issue.assignedToUserId ? 'REASSIGNED' : 'ASSIGNED';

    await this.prisma.activityLog.create({
      data: {
        issueId: id,
        userId: actor.userId,
        action,
        oldValue: JSON.stringify(oldData),
        newValue: JSON.stringify({
          assignedToUserId: dto.targetUserId ?? null,
          assignedToOrgId: dto.targetOrgId ?? null,
        }),
      },
    });

    // Reset lastNotifiedStage on reassignment
    await this.notificationsService.resetNotifiedStage(id);

    if (dto.targetUserId) {
      await this.notificationsService.createNotification({
        userId: dto.targetUserId,
        issueId: id,
        message: `Issue "${issue.title}" has been assigned to you`,
        type: 'ASSIGNMENT',
      });
      // Send assignment email (non-blocking)
      const targetUser = await this.prisma.user.findUnique({
        where: { id: dto.targetUserId },
        select: { email: true },
      });
      if (targetUser) {
        this.emailService
          .sendAssignmentEmail(targetUser.email, issue.title, id)
          .catch((err) => {});
      }
    } else if (dto.targetOrgId) {
      const orgUsers = await this.prisma.user.findMany({
        where: { organizationId: dto.targetOrgId, status: 'ACTIVE' },
      });
      await this.notificationsService.createNotificationsBulk(
        orgUsers.map((u) => ({
          userId: u.id,
          issueId: id,
          message: `Issue "${issue.title}" has been assigned to your organization`,
          type: 'ASSIGNMENT',
        })),
      );
      // Send assignment emails (non-blocking)
      for (const u of orgUsers) {
        this.emailService
          .sendAssignmentEmail(u.email, issue.title, id)
          .catch((err) => {});
      }
    }

    return this.findOne(id, actor);
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: JwtPayload) {
    const issue = await this.findOne(id, actor);

    const transition = this.stateMachine.canTransition(issue.status, dto.status);
    if (!transition.valid) {
      throw new BadRequestException(transition.error);
    }

    if (dto.status === 'REOPENED' && !dto.comment?.trim()) {
      throw new BadRequestException('A comment is required when reopening an issue');
    }

    const updateData: Prisma.IssueUpdateInput = {
      status: dto.status,
    };
    if (dto.status === 'CLOSED') {
      updateData.closedAt = new Date();
    }

    const updated = await this.prisma.issue.update({
      where: { id },
      data: updateData,
    });

    await this.prisma.activityLog.create({
      data: {
        issueId: id,
        userId: actor.userId,
        action: 'STATUS_CHANGED',
        oldValue: issue.status,
        newValue: dto.status,
      },
    });

    if (dto.comment?.trim()) {
      await this.prisma.comment.create({
        data: {
          issueId: id,
          userId: actor.userId,
          text: dto.comment,
        },
      });
    }

    await this.notificationsService.createStatusChangeNotifications(
      id,
      issue.title,
      issue.status,
      dto.status,
      issue.raisedById,
      issue.assignedToUserId,
    );

    return this.findOne(id, actor);
  }

  async addComment(
    id: string,
    dto: AddCommentDto,
    actor: JwtPayload,
    files?: Express.Multer.File[],
  ) {
    await this.findOne(id, actor);

    const comment = await this.prisma.comment.create({
      data: {
        issueId: id,
        userId: actor.userId,
        text: dto.text,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (files && files.length > 0) {
      await this.attachmentsService.uploadToComment(
        comment.id,
        files,
        id,
        actor,
      );
    }

    return comment;
  }

  async addAttachments(
    id: string,
    files: Express.Multer.File[],
    actor: JwtPayload,
  ) {
    return this.attachmentsService.uploadToIssue(id, files, actor);
  }

  async getActivity(id: string, actor: JwtPayload) {
    await this.findOne(id, actor);

    return this.prisma.activityLog.findMany({
      where: { issueId: id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
