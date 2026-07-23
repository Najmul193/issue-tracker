import {
  Injectable,
  Logger,
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
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly stateMachine: StateMachine,
    private readonly attachmentsService: AttachmentsService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(dto: CreateIssueDto, actor: JwtPayload) {
    const deadline = new Date(dto.deadline);
    if (deadline <= new Date()) {
      throw new BadRequestException('Deadline must be in the future');
    }

    // Verify project exists before creating issue
    const projectExists = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true },
    });
    if (!projectExists) {
      throw new BadRequestException('Project not found');
    }

    if (actor.role !== 'SUPER_ADMIN') {
      await this.assertProjectAccess(dto.projectId, actor);
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
        projectId: dto.projectId,
      },
      include: {
        raisedBy: { select: { id: true, name: true, email: true } },
        raisedByOrg: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        issueId: issue.id,
        userId: actor.userId,
        action: 'CREATED',
        oldValue: null,
        newValue: null,
      },
    });

    return issue;
  }

  async findAll(query: QueryIssuesDto, actor: JwtPayload) {
    const andClauses: Prisma.IssueWhereInput[] = [];

    const projectFilter = await this.authService.getVisibleIssuesFilter(actor);
    if (Object.keys(projectFilter).length > 0) {
      andClauses.push(projectFilter);
    }

    if (query.projectId) {
      andClauses.push({ projectId: query.projectId });
    }

    if (query.projectIds) {
      if (query.projectIds === '__none__') {
        andClauses.push({ id: { in: [] } });
      } else {
        const ids = query.projectIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (ids.length > 0) {
          andClauses.push({ projectId: { in: ids } });
        } else {
          andClauses.push({ id: { in: [] } });
        }
      }
    }

    if (query.status) andClauses.push({ status: query.status });
    if (query.priority) andClauses.push({ priority: query.priority });
    if (query.type) andClauses.push({ type: query.type });
    if (query.module) andClauses.push({ module: { contains: query.module, mode: 'insensitive' } });
    if (query.assignedOrg) andClauses.push({ assignedToOrgId: query.assignedOrg });
    if (query.overdue === 'true') {
      andClauses.push({
        deadline: { lt: new Date() },
        status: { notIn: ['CLOSED', 'PENDING_CLIENT_APPROVAL'] as IssueStatus[] },
      });
    }

    if (query.concern === 'true') {
      const isOrgLevel = actor.role === 'ORG_ADMIN' || actor.role === 'SUPER_ADMIN';

      if (query.concernFilter === 'raised') {
        const raisedOr: Prisma.IssueWhereInput[] = [{ raisedById: actor.userId }];
        if (isOrgLevel) {
          raisedOr.push({ raisedBy: { organizationId: actor.organizationId } });
        }
        andClauses.push({ OR: raisedOr });
      } else if (query.concernFilter === 'assigned') {
        const assignedOr: Prisma.IssueWhereInput[] = [{ assignedToUserId: actor.userId }];
        if (isOrgLevel) {
          assignedOr.push({ assignedToOrgId: actor.organizationId });
          assignedOr.push({ assignedToUser: { organizationId: actor.organizationId } });
        }
        andClauses.push({ OR: assignedOr });
      } else {
        const concernOr: Prisma.IssueWhereInput[] = [
          { assignedToUserId: actor.userId },
          { raisedById: actor.userId },
        ];
        if (isOrgLevel) {
          concernOr.push({ assignedToOrgId: actor.organizationId });
          concernOr.push({ raisedBy: { organizationId: actor.organizationId } });
          concernOr.push({ assignedToUser: { organizationId: actor.organizationId } });
        }
        andClauses.push({ OR: concernOr });
      }
    }

    const where: Prisma.IssueWhereInput = {
      AND: andClauses.length > 0 ? andClauses : [{}],
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
          assignedToUser: { select: { id: true, name: true, email: true, organizationId: true } },
          raisedByOrg: { select: { id: true, name: true } },
          assignedToOrg: { select: { id: true, name: true } },
          assignedToDepartment: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
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
        assignedToUser: { select: { id: true, name: true, email: true, organizationId: true } },
        assignedToOrg: { select: { id: true, name: true } },
        assignedToDepartment: { select: { id: true, name: true } },
        assignedBy: { select: { id: true, name: true, email: true } },
        resolvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            organization: { select: { id: true, name: true } },
          },
        },
        comments: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        attachments: true,
        activityLogs: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
        project: { select: { id: true, name: true } },
      },
    });

    if (!issue) throw new NotFoundException('Issue not found');

    if (issue.projectId) {
      await this.assertProjectAccess(issue.projectId, actor);
    }

    return issue;
  }

  async assign(id: string, dto: AssignIssueDto, actor: JwtPayload) {
    if (!dto.targetUserId && !dto.targetOrgId && !dto.targetDepartmentId) {
      throw new BadRequestException(
        'At least one of targetUserId, targetOrgId, or targetDepartmentId must be provided',
      );
    }

    if (dto.targetUserId && dto.targetDepartmentId) {
      throw new BadRequestException('Cannot assign to both a user and a department simultaneously');
    }

    const issue = await this.findOne(id, actor);

    if (issue.status === 'CLOSED') {
      throw new ForbiddenException('Cannot assign a closed issue. Reopen it first.');
    }

    // In the new workflow, assignment is only allowed during triage / review / clarification
    // or when SI rejects OEM work (SI_REVIEW -> ASSIGNED) or from IN_PROGRESS for re-routing.
    const assignableStatuses: string[] = [
      'NEW', 'UNDER_REVIEW', 'CLARIFICATION_REQUESTED', 'ASSIGNED', 'IN_PROGRESS',
      'REOPENED', // kept for backward-compat with any residual data
      'SI_REVIEW', // SI rejects OEM -> reassign to OEM lead
    ];
    if (!assignableStatuses.includes(issue.status as string)) {
      throw new ForbiddenException(
        `Cannot reassign an issue in status ${issue.status}`,
      );
    }

    const newTargetUser = dto.targetUserId
      ? await this.prisma.user.findUnique({
          where: { id: dto.targetUserId, status: 'ACTIVE' },
          select: {
            id: true,
            name: true,
            organizationId: true,
            role: true,
            organization: { select: { type: true } },
          },
        })
      : null;

    const newTargetOrg = dto.targetOrgId
      ? await this.prisma.organization.findUnique({
          where: { id: dto.targetOrgId },
          select: { id: true, name: true, type: true },
        })
      : null;

    let newTargetDepartment: { id: string; name: string; organizationId: string } | null = null;
    if (dto.targetDepartmentId) {
      newTargetDepartment = await this.prisma.department.findUnique({
        where: { id: dto.targetDepartmentId },
        select: { id: true, name: true, organizationId: true },
      });
      if (!newTargetDepartment) {
        throw new NotFoundException('Department not found');
      }
      if (!dto.targetOrgId) {
        dto.targetOrgId = newTargetDepartment.organizationId;
      }
      const deptOrg = await this.prisma.organization.findUnique({
        where: { id: newTargetDepartment.organizationId },
        select: { id: true, name: true, type: true },
      });
      if (deptOrg && !newTargetOrg) {
        Object.assign(newTargetOrg || {}, deptOrg);
      }
      if (!newTargetOrg && deptOrg) {
        (dto as any)._resolvedOrg = deptOrg;
      }
    }

    const resolvedTargetOrg = newTargetOrg || (dto as any)._resolvedOrg;

    if (issue.projectId) {
      if (dto.targetUserId && newTargetUser) {
        const targetInProject = await this.prisma.projectUser.findUnique({
          where: { projectId_userId: { projectId: issue.projectId, userId: dto.targetUserId } },
        });
        const targetOrgInProject = await this.prisma.projectOrganization.findUnique({
          where: {
            projectId_organizationId: {
              projectId: issue.projectId,
              organizationId: newTargetUser.organizationId,
            },
          },
        });
        if (!targetInProject && !targetOrgInProject) {
          throw new ForbiddenException("Target user is not a member of this issue's project");
        }
      }
      if (dto.targetOrgId && resolvedTargetOrg) {
        const targetOrgInProject = await this.prisma.projectOrganization.findUnique({
          where: {
            projectId_organizationId: {
              projectId: issue.projectId,
              organizationId: dto.targetOrgId,
            },
          },
        });
        if (!targetOrgInProject) {
          throw new ForbiddenException(
            "Target organization is not a member of this issue's project",
          );
        }
      }
      if (dto.targetDepartmentId && newTargetDepartment) {
        const deptInProject = await this.prisma.projectDepartment.findUnique({
          where: {
            projectId_departmentId: {
              projectId: issue.projectId,
              departmentId: dto.targetDepartmentId,
            },
          },
        });
        if (!deptInProject) {
          throw new ForbiddenException("Target department is not a member of this issue's project");
        }
      }
    }

    if (dto.targetDepartmentId && newTargetDepartment) {
      if (newTargetDepartment.organizationId === issue.raisedByOrgId) {
        throw new ForbiddenException(
          'Cannot route to a department in the same organization as the issue raiser',
        );
      }
    }

    const currentAssignedOrgId =
      issue.assignedToOrgId ?? issue.assignedToUser?.organizationId ?? null;
    const isAlreadyAssigned = !!(issue.assignedToUserId || issue.assignedToOrgId || issue.assignedToDepartmentId);

    this.authService.canAssign(
      actor,
      dto.targetUserId ?? null,
      dto.targetOrgId ?? null,
      newTargetUser?.organizationId,
      newTargetUser?.role,
      issue.assignedToUserId === actor.userId,
      currentAssignedOrgId,
      issue.raisedByOrgId,
      newTargetUser?.organization?.type,
      resolvedTargetOrg?.type,
      isAlreadyAssigned,
    );

    const oldTargetUser = issue.assignedToUserId
      ? await this.prisma.user.findUnique({
          where: { id: issue.assignedToUserId },
          select: { id: true, name: true },
        })
      : null;
    const oldTargetOrg = issue.assignedToOrgId
      ? await this.prisma.organization.findUnique({
          where: { id: issue.assignedToOrgId },
          select: { id: true, name: true },
        })
      : null;
    const oldTargetDept = issue.assignedToDepartmentId
      ? await this.prisma.department.findUnique({
          where: { id: issue.assignedToDepartmentId },
          select: { id: true, name: true },
        })
      : null;

    const updated = await this.prisma.issue.update({
      where: { id },
      data: {
        assignedToUserId: dto.targetUserId ?? null,
        assignedToOrgId: dto.targetOrgId ?? newTargetUser?.organizationId ?? null,
        assignedToDepartmentId: dto.targetDepartmentId ?? null,
        assignedById: actor.userId,
        status: (() => {
          if (issue.status === 'NEW') {
            return (actor.organizationType === 'SI' || actor.role === 'SUPER_ADMIN') ? 'ASSIGNED' : 'UNDER_REVIEW';
          }
          if (['UNDER_REVIEW', 'CLARIFICATION_REQUESTED', 'SI_REVIEW'].includes(issue.status as string)) {
            return 'ASSIGNED';
          }
          return issue.status;
        })(),
        closedAt: null,
      },
    });

    const action = issue.assignedToUserId ? 'REASSIGNED' : 'ASSIGNED';

    await this.prisma.activityLog.create({
      data: {
        issueId: id,
        userId: actor.userId,
        action,
        oldValue: JSON.stringify({
          assignedToUserId: oldTargetUser?.id ?? null,
          assignedToUserName: oldTargetUser?.name ?? null,
          assignedToOrgId: oldTargetOrg?.id ?? null,
          assignedToOrgName: oldTargetOrg?.name ?? null,
          assignedToDepartmentId: oldTargetDept?.id ?? null,
          assignedToDepartmentName: oldTargetDept?.name ?? null,
        }),
        newValue: JSON.stringify({
          assignedToUserId: newTargetUser?.id ?? null,
          assignedToUserName: newTargetUser?.name ?? null,
          assignedToOrgId: resolvedTargetOrg?.id ?? dto.targetOrgId ?? null,
          assignedToOrgName: resolvedTargetOrg?.name ?? null,
          assignedToDepartmentId: newTargetDepartment?.id ?? null,
          assignedToDepartmentName: newTargetDepartment?.name ?? null,
        }),
      },
    });

    await this.notificationsService.resetNotifiedStage(id);

    if (dto.targetUserId) {
      await this.notificationsService.createNotification({
        userId: dto.targetUserId,
        issueId: id,
        message: `Issue "${issue.title}" has been assigned to you`,
        type: 'ASSIGNMENT',
      });
      const targetUser = await this.prisma.user.findUnique({
        where: { id: dto.targetUserId },
        select: { email: true },
      });
      if (targetUser) {
        this.emailService
          .sendAssignmentEmail(targetUser.email, issue.title, id)
          .catch((err) => this.logger.error('Assignment email failed', err));
      }
    } else if (dto.targetDepartmentId && newTargetDepartment) {
      const deptUsers = await this.prisma.user.findMany({
        where: { departmentId: dto.targetDepartmentId, status: 'ACTIVE' },
      });
      if (deptUsers.length > 0) {
        await this.notificationsService.createNotificationsBulk(
          deptUsers.map((u) => ({
            userId: u.id,
            issueId: id,
            message: `Issue "${issue.title}" has been assigned to the ${newTargetDepartment!.name} department`,
            type: 'ASSIGNMENT',
          })),
        );
      }
      const managers = await this.prisma.departmentManager.findMany({
        where: { departmentId: dto.targetDepartmentId },
        include: { user: { select: { email: true, status: true } } },
      });
      for (const m of managers) {
        if (m.user.status === 'ACTIVE') {
          this.emailService
            .sendAssignmentEmail(m.user.email, issue.title, id)
            .catch((err) => this.logger.error('Assignment email failed', err));
        }
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
      for (const u of orgUsers) {
        if (u.role === 'ORG_ADMIN') {
          this.emailService
            .sendAssignmentEmail(u.email, issue.title, id)
            .catch((err) => this.logger.error('Assignment email failed', err));
        }
      }
    }

    return this.findOne(id, actor);
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: JwtPayload) {
    const issue = await this.findOne(id, actor);

    if (!this.authService.canActOnIssue(actor, issue)) {
      throw new ForbiddenException('You are not authorized to change the status of this issue');
    }

    // --- State machine validation ---
    const transition = this.stateMachine.canTransition(issue.status, dto.status as IssueStatus);
    if (!transition.valid) {
      throw new BadRequestException(transition.error);
    }

    // --- Determine actual stored status (RESOLVED is a virtual action) ---
    let actualStatus: IssueStatus = dto.status as IssueStatus;

    if (dto.status === 'RESOLVED') {
      if (!dto.resolutionNote?.trim()) {
        throw new BadRequestException('Resolution note is required when resolving an issue');
      }

      // Unconditionally route to SI_REVIEW for SI verification
      actualStatus = 'SI_REVIEW';
    }

    // --- Role-based guards per status ---

    // Only SI org members (or SUPER_ADMIN) can move NEW -> UNDER_REVIEW
    if (actualStatus === 'UNDER_REVIEW' && issue.status === 'NEW') {
      if (actor.role !== 'SUPER_ADMIN' && actor.organizationType !== 'SI') {
        throw new ForbiddenException(
          'Only the SI (Data Edge) team can move an issue to Under Review',
        );
      }
    }

    // UNDER_REVIEW actions: only SI org members (or SUPER_ADMIN) can validate or ask for clarification
    if (issue.status === 'UNDER_REVIEW' && (actualStatus === 'ASSIGNED' || actualStatus === 'CLARIFICATION_REQUESTED')) {
      if (actor.role !== 'SUPER_ADMIN' && actor.organizationType !== 'SI') {
        throw new ForbiddenException(
          'Only the SI (Data Edge) team can validate or request clarification for an issue under review',
        );
      }
    }

    // PENDING_CLIENT_APPROVAL -> CLOSED: only CLIENT org admin, issue creator, or SUPER_ADMIN
    if (actualStatus === 'CLOSED') {
      if (actor.role !== 'SUPER_ADMIN') {
        const isCreator = issue.raisedById === actor.userId;
        const isCreatorOrgAdmin =
          actor.organizationId === issue.raisedByOrgId && actor.role === 'ORG_ADMIN';
        if (!isCreator && !isCreatorOrgAdmin) {
          throw new ForbiddenException(
            'Only the issue creator or their org admin can close this issue',
          );
        }
      }
    }

    // PENDING_CLIENT_APPROVAL -> ASSIGNED (client rejects): issue creator, CLIENT org admin, or SUPER_ADMIN
    if (actualStatus === 'ASSIGNED' && issue.status === 'PENDING_CLIENT_APPROVAL') {
      if (actor.role !== 'SUPER_ADMIN') {
        const isCreator = issue.raisedById === actor.userId;
        const isCreatorOrgAdmin = actor.organizationId === issue.raisedByOrgId && actor.role === 'ORG_ADMIN';
        if (!isCreator && !isCreatorOrgAdmin) {
          throw new ForbiddenException(
            'Only the issue creator or their org admin can send an issue back for review',
          );
        }
      }
    }

    // SI_REVIEW -> ASSIGNED (SI rejects): SI admin or SUPER_ADMIN
    if (actualStatus === 'ASSIGNED' && issue.status === 'SI_REVIEW') {
      if (actor.role !== 'SUPER_ADMIN' && actor.organizationType !== 'SI') {
        throw new ForbiddenException(
          'Only the SI (Data Edge) team can reject an issue in SI Review',
        );
      }
    }

    // CLOSED -> UNDER_REVIEW: only SI org admin or SUPER_ADMIN
    if (actualStatus === 'UNDER_REVIEW' && issue.status === 'CLOSED') {
      if (actor.role !== 'SUPER_ADMIN') {
        if (actor.organizationType !== 'SI' || actor.role !== 'ORG_ADMIN') {
          throw new ForbiddenException(
            'Only the SI org admin or SUPER_ADMIN can reopen a closed issue',
          );
        }
      }
    }

    // SI_REVIEW actions: only SI org admin or SI dept managers (or SUPER_ADMIN)
    if (issue.status === 'SI_REVIEW') {
      if (actor.role !== 'SUPER_ADMIN' && actor.organizationType !== 'SI') {
        throw new ForbiddenException(
          'Only the SI (Data Edge) team can perform review on OEM-resolved issues',
        );
      }
    }

    // IN_QA actions: only SI org admin or dept managers (or SUPER_ADMIN)
    if (issue.status === 'IN_QA') {
      if (actor.role !== 'SUPER_ADMIN' && actor.organizationType !== 'SI') {
        throw new ForbiddenException('Only the SI (Data Edge) team can perform QA validation');
      }
    }

    // CLARIFICATION_REQUESTED requires a comment, and only assignee/SI can request it
    if (actualStatus === 'CLARIFICATION_REQUESTED' && issue.status !== 'CLARIFICATION_REQUESTED') {
      if (!dto.comment?.trim()) {
        throw new BadRequestException(
          'A comment is required when requesting clarification from the client',
        );
      }
      const isAssignee = actor.userId === issue.assignedToUserId;
      const isAssigneeOrg = actor.organizationId === (issue.assignedToOrgId ?? issue.assignedToUser?.organizationId);
      if (!isAssignee && !isAssigneeOrg && actor.role !== 'SUPER_ADMIN' && actor.organizationType !== 'SI') {
        throw new ForbiddenException('Only the assigned team can request clarification');
      }
    }

    // UNDER_REVIEW or IN_PROGRESS from CLARIFICATION_REQUESTED requires a comment, and only issue creator/client org can provide it
    if (
      (actualStatus === 'UNDER_REVIEW' || actualStatus === 'IN_PROGRESS') &&
      issue.status === 'CLARIFICATION_REQUESTED'
    ) {
      if (!dto.comment?.trim()) {
        throw new BadRequestException(
          'A comment is required when providing clarification',
        );
      }
      const isCreator = issue.raisedById === actor.userId;
      const isClientOrgAdmin = actor.organizationId === issue.raisedByOrgId && actor.role === 'ORG_ADMIN';
      if (!isCreator && !isClientOrgAdmin && actor.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException('Only the issue creator or client org admin can provide clarification');
      }
    }

    // Moving to IN_PROGRESS from ASSIGNED can only be done by the assigned team
    if (actualStatus === 'IN_PROGRESS' && issue.status === 'ASSIGNED') {
      const isAssignee = actor.userId === issue.assignedToUserId;
      const isAssigneeOrg = actor.organizationId === (issue.assignedToOrgId ?? issue.assignedToUser?.organizationId);
      if (!isAssignee && !isAssigneeOrg && actor.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException('Only the assigned team can mark the issue as in progress');
      }
    }

    // Resolving an issue can only be done by the assigned team or SI
    if (dto.status === 'RESOLVED') {
      const isAssignee = actor.userId === issue.assignedToUserId;
      const isAssigneeOrg = actor.organizationId === (issue.assignedToOrgId ?? issue.assignedToUser?.organizationId);
      if (!isAssignee && !isAssigneeOrg && actor.role !== 'SUPER_ADMIN' && actor.organizationType !== 'SI') {
        throw new ForbiddenException('Only the assigned team can resolve this issue');
      }
    }

    // --- Build update payload ---
    const updateData: Prisma.IssueUpdateInput = { status: actualStatus };

    if (actualStatus === 'CLOSED') {
      updateData.closedAt = new Date();
    }

    if (dto.status === 'RESOLVED') {
      updateData.resolutionNote = dto.resolutionNote?.trim();
      const userExists = await this.prisma.user.findUnique({
        where: { id: actor.userId },
        select: { id: true },
      });
      if (userExists) {
        updateData.resolvedBy = { connect: { id: actor.userId } };
      }
      updateData.resolvedAt = new Date();
    }

    await this.prisma.issue.update({ where: { id }, data: updateData });

    await this.prisma.activityLog.create({
      data: {
        issueId: id,
        userId: actor.userId,
        action: 'STATUS_CHANGED',
        oldValue: issue.status,
        newValue: actualStatus,
      },
    });

    if (dto.comment && dto.comment.trim().length > 0) {
      await this.prisma.comment.create({
        data: { issueId: id, userId: actor.userId, text: dto.comment },
      });
    }

    await this.notificationsService.createStatusChangeNotifications(
      id,
      issue.title,
      issue.status,
      actualStatus,
      issue.raisedById,
      issue.assignedToUserId,
    );

    // When issue enters SI_REVIEW, notify all SI org admins and dept managers in the project
    if (actualStatus === 'SI_REVIEW' && issue.projectId) {
      await this.notificationsService.notifySiTeamForReview(
        id,
        issue.title,
        issue.projectId,
      );
    }

    return this.findOne(id, actor);
  }

  async addComment(
    id: string,
    dto: AddCommentDto,
    actor: JwtPayload,
    files?: Express.Multer.File[],
  ) {
    const issue = await this.findOne(id, actor);

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
      await this.attachmentsService.uploadToComment(comment.id, files, id, actor);
    }

    return comment;
  }

  async addAttachments(id: string, files: Express.Multer.File[], actor: JwtPayload) {
    await this.findOne(id, actor);
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

  async delete(id: string, actor: JwtPayload) {
    const issue = await this.findOne(id, actor);

    if (
      actor.userId !== issue.raisedById &&
      actor.role !== 'SUPER_ADMIN' &&
      actor.role !== 'ORG_ADMIN'
    ) {
      throw new ForbiddenException(
        'Only the creator, their org admin, or SUPER_ADMIN can delete issues',
      );
    }
    if (actor.role === 'ORG_ADMIN' && actor.organizationId !== issue.raisedByOrgId) {
      throw new ForbiddenException('You can only delete issues from your own organization');
    }

    await this.prisma.issue.delete({ where: { id } });
  }

  private async assertProjectAccess(projectId: string, actor: JwtPayload) {
    if (actor.role === 'SUPER_ADMIN') return;

    if (actor.role === 'ORG_ADMIN') {
      const isOrgMember = await this.prisma.projectOrganization.findUnique({
        where: {
          projectId_organizationId: { projectId, organizationId: actor.organizationId },
        },
      });
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
}
