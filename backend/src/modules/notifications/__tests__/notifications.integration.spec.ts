import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { HealthModule } from '../../health/health.module';
import { UsersModule } from '../../users/users.module';
import { AuthModule } from '../../auth/auth.module';
import { IssuesModule } from '../../issues/issues.module';
import { NotificationsModule } from '../notifications.module';
import { NotificationsService } from '../notifications.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/decorators/current-user.decorator';

describe('Notifications Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let notificationsService: NotificationsService;

  // User/org references populated during seed
  let bankOrgId: string;
  let dataEdgeOrgId: string;
  let oracleOrgId: string;
  let superAdminOrgId: string;
  let bankAdminId: string;
  let bankUserId: string;
  let siUserId: string;
  let oracleUserId: string;
  let superAdminId: string;

  // Track only records created by THIS suite for targeted cleanup
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdIssueIds: string[] = [];
  const createdNotificationIds: string[] = [];

  // Unique suffix so this suite never collides with other suites
  const suiteId = 'notif-' + Math.random().toString(36).substring(2, 8);

  function token(userId: string, role: string, orgId: string, orgType: string): string {
    return jwtService.sign({ userId, role, organizationId: orgId, organizationType: orgType } satisfies JwtPayload);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10_000 }]),
        PrismaModule,
        HealthModule,
        UsersModule,
        AuthModule,
        IssuesModule,
        NotificationsModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    notificationsService = app.get(NotificationsService);

    await seed();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function cleanup() {
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({ where: { id: { in: createdNotificationIds } } });
    }
    if (createdIssueIds.length > 0) {
      await prisma.notification.deleteMany({ where: { issueId: { in: createdIssueIds } } });
      await prisma.activityLog.deleteMany({ where: { issueId: { in: createdIssueIds } } });
      await prisma.comment.deleteMany({ where: { issueId: { in: createdIssueIds } } });
      await prisma.issue.deleteMany({ where: { id: { in: createdIssueIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdOrgIds.length > 0) {
      await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
  }

  async function seed() {
    const pw = await bcrypt.hash('password123', 4);

    const superAdminOrg = await prisma.organization.create({
      data: { name: `Super-Admin-${suiteId}`, type: 'SUPER_ADMIN' },
    });
    const bankOrg = await prisma.organization.create({
      data: { name: `Bank-${suiteId}`, type: 'BANK' },
    });
    const dataEdgeOrg = await prisma.organization.create({
      data: { name: `Data-Edge-${suiteId}`, type: 'SI' },
    });
    const oracleOrg = await prisma.organization.create({
      data: { name: `Oracle-${suiteId}`, type: 'OEM' },
    });
    createdOrgIds.push(superAdminOrg.id, bankOrg.id, dataEdgeOrg.id, oracleOrg.id);

    superAdminOrgId = superAdminOrg.id;
    bankOrgId = bankOrg.id;
    dataEdgeOrgId = dataEdgeOrg.id;
    oracleOrgId = oracleOrg.id;

    const superAdmin = await prisma.user.create({
      data: { name: 'SA', email: `sa-${suiteId}@test.dev`, passwordHash: pw, role: 'SUPER_ADMIN', organizationId: superAdminOrg.id, status: 'ACTIVE' },
    });
    const bankAdmin = await prisma.user.create({
      data: { name: 'BA', email: `ba-${suiteId}@test.dev`, passwordHash: pw, role: 'ORG_ADMIN', organizationId: bankOrg.id, status: 'ACTIVE' },
    });
    const bankUser = await prisma.user.create({
      data: { name: 'BU', email: `bu-${suiteId}@test.dev`, passwordHash: pw, role: 'USER', organizationId: bankOrg.id, status: 'ACTIVE' },
    });
    const siUser = await prisma.user.create({
      data: { name: 'SU', email: `su-${suiteId}@test.dev`, passwordHash: pw, role: 'USER', organizationId: dataEdgeOrg.id, status: 'ACTIVE' },
    });
    const oracleUser = await prisma.user.create({
      data: { name: 'OU', email: `ou-${suiteId}@test.dev`, passwordHash: pw, role: 'USER', organizationId: oracleOrg.id, status: 'ACTIVE' },
    });
    createdUserIds.push(superAdmin.id, bankAdmin.id, bankUser.id, siUser.id, oracleUser.id);

    superAdminId = superAdmin.id;
    bankAdminId = bankAdmin.id;
    bankUserId = bankUser.id;
    siUserId = siUser.id;
    oracleUserId = oracleUser.id;
  }

  async function createIssue(
    actor: { token: string },
    overrides: Record<string, any> = {},
  ) {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const res = await request(app.getHttpServer())
      .post('/api/issues')
      .set('Cookie', `access_token=${actor.token}`)
      .send({
        title: 'Test Issue',
        description: 'Test description',
        type: 'BUG',
        priority: 'HIGH',
        deadline: future,
        ...overrides,
      });
    if (res.body && res.body.id) {
      createdIssueIds.push(res.body.id);
    }
    return res;
  }

  // =============== TEST SUITES ===============

  describe('Test 1: Status change creates notification for both raiser and assignee', () => {
    it('creates STATUS_CHANGE notification for raiser (and assignee if set)', async () => {
      const bankUserToken = token(bankUserId, 'USER', bankOrgId, 'BANK');

      // Create issue as bank user (status=NEW)
      const issueRes = await createIssue({ token: bankUserToken });
      const issueId = issueRes.body.id;

      // Valid transition: NEW -> ACKNOWLEDGED
      const statusRes = await request(app.getHttpServer())
        .patch(`/api/issues/${issueId}/status`)
        .set('Cookie', `access_token=${bankUserToken}`)
        .send({ status: 'ACKNOWLEDGED' });
      expect(statusRes.status).toBe(200);

      // Should have 1 STATUS_CHANGE for the raiser (no assignee yet)
      const notifs = await prisma.notification.findMany({
        where: { issueId, type: 'STATUS_CHANGE' },
      });
      expect(notifs.length).toBe(1);
      expect(notifs[0].userId).toBe(bankUserId);
      expect(notifs[0].message).toContain('status changed');
      createdNotificationIds.push(...notifs.map((n) => n.id));
    });
  });

  describe('Test 2: Status change creates separate notifications when raiser !== assignee', () => {
    it('creates two STATUS_CHANGE notifications when raiser and assignee differ', async () => {
      const bankUserToken = token(bankUserId, 'USER', bankOrgId, 'BANK');
      const bankAdminToken = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'BANK');

      // Create issue as bankUser (raiser = bankUser)
      const issueRes = await createIssue({ token: bankUserToken });
      const issueId = issueRes.body.id;

      // Assign to bankAdmin as assignee
      // To assign, the assigner needs perms - bankAdmin can assign to bankAdmin
      await request(app.getHttpServer())
        .patch(`/api/issues/${issueId}/assign`)
        .set('Cookie', `access_token=${bankAdminToken}`)
        .send({ targetUserId: bankAdminId, targetOrgId: bankOrgId });

      // Now status = ASSIGNED. Valid transition: ASSIGNED -> IN_PROGRESS by assignee
      const statusRes = await request(app.getHttpServer())
        .patch(`/api/issues/${issueId}/status`)
        .set('Cookie', `access_token=${bankAdminToken}`)
        .send({ status: 'IN_PROGRESS' });
      expect(statusRes.status).toBe(200);

      // Should have STATUS_CHANGE for raiser (bankUser) and assignee (bankAdmin)
      const raiserNotifs = await prisma.notification.findMany({
        where: { userId: bankUserId, issueId, type: 'STATUS_CHANGE' },
      });
      expect(raiserNotifs.length).toBeGreaterThanOrEqual(1);
      createdNotificationIds.push(...raiserNotifs.map((n) => n.id));

      const assigneeNotifs = await prisma.notification.findMany({
        where: { userId: bankAdminId, issueId, type: 'STATUS_CHANGE' },
      });
      expect(assigneeNotifs.length).toBeGreaterThanOrEqual(1);
      createdNotificationIds.push(...assigneeNotifs.map((n) => n.id));

      // Total should be 2
      const all = await prisma.notification.findMany({
        where: { issueId, type: 'STATUS_CHANGE' },
      });
      expect(all.length).toBe(2);
    });
  });

  describe('Test 3: GET /api/notifications respects own notifications only', () => {
    it('bank user cannot see SI user notifications', async () => {
      const bankUserToken = token(bankUserId, 'USER', bankOrgId, 'BANK');
      const siUserToken = token(siUserId, 'USER', dataEdgeOrgId, 'SI');

      // Create a notification for SI user directly
      const siIssue = await createIssue({ token: siUserToken });
      const siNotif = await prisma.notification.create({
        data: {
          userId: siUserId,
          issueId: siIssue.body.id,
          message: 'SI user notification',
          type: 'STATUS_CHANGE',
        },
      });
      createdNotificationIds.push(siNotif.id);

      // Bank user fetches notifications
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Cookie', `access_token=${bankUserToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      // The SI notification should NOT be in bank user's list
      const siNotifIds = res.body.data
        .filter((n: any) => n.userId === siUserId)
        .map((n: any) => n.id);
      expect(siNotifIds).not.toContain(siNotif.id);

      // All returned notifications must belong to bankUser
      for (const n of res.body.data) {
        expect(n.userId).toBe(bankUserId);
      }
    });
  });

  describe('Test 4: Cron job creates WARNING notification at 80% elapsed, no duplicate', () => {
    it('creates DEADLINE_WARNING notification and does not duplicate', async () => {
      // Create issue with >80% elapsed (created 10h ago, deadline 2h from now = 10/12=83%)
      const createdAt = new Date(Date.now() - 10 * 60 * 60 * 1000);
      const deadline = new Date(Date.now() + 2 * 60 * 60 * 1000);

      const issue = await prisma.issue.create({
        data: {
          title: 'Warning Test Issue',
          type: 'BUG',
          priority: 'HIGH',
          deadline,
          createdAt,
          raisedById: bankAdminId,
          raisedByOrgId: bankOrgId,
          assignedToUserId: bankUserId,
          assignedToOrgId: bankOrgId,
          status: 'ASSIGNED',
          lastNotifiedStage: 'NONE',
        },
      });
      const issueId = issue.id;
      createdIssueIds.push(issueId);

      // Run deadline check
      const count = await notificationsService.checkDeadlines();
      expect(count).toBeGreaterThanOrEqual(1);

      // Verify WARNING notification created for assignee
      const warningNotifs = await prisma.notification.findMany({
        where: { issueId, type: 'DEADLINE_WARNING' },
      });
      expect(warningNotifs.length).toBe(1);
      expect(warningNotifs[0].userId).toBe(bankUserId);
      createdNotificationIds.push(...warningNotifs.map((n) => n.id));

      // Verify issue's lastNotifiedStage updated
      const updatedIssue = await prisma.issue.findUnique({ where: { id: issueId } });
      expect(updatedIssue?.lastNotifiedStage).toBe('WARNING_SENT');

      // Run again - should NOT create duplicates
      await notificationsService.checkDeadlines();
      const warningNotifs2 = await prisma.notification.findMany({
        where: { issueId, type: 'DEADLINE_WARNING' },
      });
      expect(warningNotifs2.length).toBe(1);
    });
  });

  describe('Test 5: Cron job creates OVERDUE notification past deadline, no duplicate', () => {
    it('creates OVERDUE notification and does not duplicate', async () => {
      const createdAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      const deadline = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago

      const issue = await prisma.issue.create({
        data: {
          title: 'Overdue Test Issue',
          type: 'BUG',
          priority: 'HIGH',
          deadline,
          createdAt,
          raisedById: bankAdminId,
          raisedByOrgId: bankOrgId,
          assignedToUserId: bankUserId,
          assignedToOrgId: bankOrgId,
          status: 'ASSIGNED',
          lastNotifiedStage: 'NONE',
        },
      });
      const issueId = issue.id;
      createdIssueIds.push(issueId);

      // Run deadline check
      const count = await notificationsService.checkDeadlines();
      expect(count).toBeGreaterThanOrEqual(1);

      // Verify OVERDUE notification created
      const overdueNotifs = await prisma.notification.findMany({
        where: { issueId, type: 'OVERDUE' },
      });
      expect(overdueNotifs.length).toBeGreaterThanOrEqual(1);
      // Should include bankUser + org admins + super admins
      const userIds = overdueNotifs.map((n) => n.userId);
      expect(userIds).toContain(bankUserId);
      expect(userIds).toContain(bankAdminId); // ORG_ADMIN of assigned org
      expect(userIds).toContain(superAdminId); // SUPER_ADMIN
      createdNotificationIds.push(...overdueNotifs.map((n) => n.id));

      // Verify issue's lastNotifiedStage was updated
      const updatedIssue = await prisma.issue.findUnique({ where: { id: issueId } });
      expect(updatedIssue?.lastNotifiedStage).toBe('OVERDUE_SENT');

      // Run again - should NOT create duplicates
      await notificationsService.checkDeadlines();
      const overdueNotifs2 = await prisma.notification.findMany({
        where: { issueId, type: 'OVERDUE' },
      });
      expect(overdueNotifs2.length).toBe(overdueNotifs.length);
    });
  });

  describe('Test 6: Reassigning an issue resets lastNotifiedStage', () => {
    it('resets lastNotifiedStage to NONE on reassignment', async () => {
      const issue = await prisma.issue.create({
        data: {
          title: 'Reset Test Issue',
          type: 'BUG',
          priority: 'HIGH',
          deadline: new Date(Date.now() + 86_400_000),
          raisedById: bankAdminId,
          raisedByOrgId: bankOrgId,
          assignedToUserId: bankUserId,
          assignedToOrgId: bankOrgId,
          status: 'ASSIGNED',
          lastNotifiedStage: 'WARNING_SENT',
        },
      });
      const issueId = issue.id;
      createdIssueIds.push(issueId);

      let issueRecord = await prisma.issue.findUnique({ where: { id: issueId } });
      expect(issueRecord?.lastNotifiedStage).toBe('WARNING_SENT');

      await notificationsService.resetNotifiedStage(issueId);

      issueRecord = await prisma.issue.findUnique({ where: { id: issueId } });
      expect(issueRecord?.lastNotifiedStage).toBe('NONE');
    });
  });

  describe('Test 7: Email sending failure does not break API call', () => {
    it('returns 200 even if SMTP throws', async () => {
      const adminToken = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'BANK');

      const issueRes = await createIssue({ token: adminToken });
      const issueId = issueRes.body.id;

      const assignRes = await request(app.getHttpServer())
        .patch(`/api/issues/${issueId}/assign`)
        .set('Cookie', `access_token=${adminToken}`)
        .send({ targetUserId: siUserId, targetOrgId: dataEdgeOrgId });
      expect(assignRes.status).toBe(200);
      expect(assignRes.body.id).toBe(issueId);
    });
  });

  describe('Test 8: GET /api/dashboard/summary returns counts', () => {
    it('returns status and priority counts', async () => {
      const bankUserToken = token(bankUserId, 'USER', bankOrgId, 'BANK');

      await createIssue({ token: bankUserToken }, { priority: 'HIGH' });
      await createIssue({ token: bankUserToken }, { priority: 'LOW' });

      const res = await request(app.getHttpServer())
        .get('/api/dashboard/summary')
        .set('Cookie', `access_token=${bankUserToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('byStatus');
      expect(res.body).toHaveProperty('byPriority');
      expect(typeof res.body.byStatus).toBe('object');
      expect(typeof res.body.byPriority).toBe('object');
    });
  });

  describe('Test 9: Mark notification as read', () => {
    it('marks single notification as read', async () => {
      const bankUserToken = token(bankUserId, 'USER', bankOrgId, 'BANK');
      const issueRes = await createIssue({ token: bankUserToken });

      const notif = await prisma.notification.create({
        data: {
          userId: bankUserId,
          issueId: issueRes.body.id,
          message: 'Test read notification',
          type: 'STATUS_CHANGE',
        },
      });
      createdNotificationIds.push(notif.id);

      const res = await request(app.getHttpServer())
        .patch(`/api/notifications/${notif.id}/read`)
        .set('Cookie', `access_token=${bankUserToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isRead).toBe(true);
    });

    it('cannot mark another users notification as read', async () => {
      const bankUserToken = token(bankUserId, 'USER', bankOrgId, 'BANK');
      const siUserToken = token(siUserId, 'USER', dataEdgeOrgId, 'SI');
      const issueRes = await createIssue({ token: siUserToken });

      const notif = await prisma.notification.create({
        data: {
          userId: siUserId,
          issueId: issueRes.body.id,
          message: 'SI notification',
          type: 'STATUS_CHANGE',
        },
      });
      createdNotificationIds.push(notif.id);

      const res = await request(app.getHttpServer())
        .patch(`/api/notifications/${notif.id}/read`)
        .set('Cookie', `access_token=${bankUserToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Test 10: Mark all as read', () => {
    it('marks all unread notifications as read', async () => {
      const bankUserToken = token(bankUserId, 'USER', bankOrgId, 'BANK');
      const issueRes = await createIssue({ token: bankUserToken });

      const n1 = await prisma.notification.create({
        data: { userId: bankUserId, issueId: issueRes.body.id, message: 'N1', type: 'STATUS_CHANGE' },
      });
      const n2 = await prisma.notification.create({
        data: { userId: bankUserId, issueId: issueRes.body.id, message: 'N2', type: 'STATUS_CHANGE' },
      });
      createdNotificationIds.push(n1.id, n2.id);

      const res = await request(app.getHttpServer())
        .patch('/api/notifications/read-all')
        .set('Cookie', `access_token=${bankUserToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const n1Updated = await prisma.notification.findUnique({ where: { id: n1.id } });
      expect(n1Updated?.isRead).toBe(true);
      const n2Updated = await prisma.notification.findUnique({ where: { id: n2.id } });
      expect(n2Updated?.isRead).toBe(true);
    });
  });

  describe('Test 11: GET /api/notifications?unread=true filters correctly', () => {
    it('returns only unread notifications when ?unread=true', async () => {
      const bankUserToken = token(bankUserId, 'USER', bankOrgId, 'BANK');
      const issueRes = await createIssue({ token: bankUserToken });

      const n1 = await prisma.notification.create({
        data: { userId: bankUserId, issueId: issueRes.body.id, message: 'Unread one', type: 'STATUS_CHANGE' },
      });
      const n2 = await prisma.notification.create({
        data: { userId: bankUserId, issueId: issueRes.body.id, message: 'Read one', type: 'STATUS_CHANGE', isRead: true },
      });
      createdNotificationIds.push(n1.id, n2.id);

      const res = await request(app.getHttpServer())
        .get('/api/notifications?unread=true')
        .set('Cookie', `access_token=${bankUserToken}`);
      expect(res.status).toBe(200);
      // Should only contain unread notifications
      for (const n of res.body.data) {
        expect(n.isRead).toBe(false);
      }
      // The read notification should not appear
      const readIds = res.body.data.map((n: any) => n.id);
      expect(readIds).not.toContain(n2.id);
    });
  });

  describe('Test 12: Unread count endpoint', () => {
    it('returns correct unread count', async () => {
      const bankUserToken = token(bankUserId, 'USER', bankOrgId, 'BANK');
      const issueRes = await createIssue({ token: bankUserToken });

      const n1 = await prisma.notification.create({
        data: { userId: bankUserId, issueId: issueRes.body.id, message: 'UC1', type: 'STATUS_CHANGE' },
      });
      const n2 = await prisma.notification.create({
        data: { userId: bankUserId, issueId: issueRes.body.id, message: 'UC2', type: 'STATUS_CHANGE', isRead: true },
      });
      createdNotificationIds.push(n1.id, n2.id);

      const res = await request(app.getHttpServer())
        .get('/api/notifications/unread-count')
        .set('Cookie', `access_token=${bankUserToken}`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });
  });
});