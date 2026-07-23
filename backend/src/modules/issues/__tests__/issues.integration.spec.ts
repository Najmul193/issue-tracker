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
import { IssuesModule } from '../issues.module';
import { ProjectsModule } from '../../projects/projects.module';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/decorators/current-user.decorator';

describe('Issues Integration (all scenarios)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let bankOrgId: string;
  let dataEdgeOrgId: string;
  let oracleOrgId: string;
  let bankAdminId: string;
  let bankUserId: string;
  let siAdminId: string;
  let siUserId: string;
  let oracleAdminId: string;
  let oracleUserId: string;
  let superAdminId: string;
  let projectId: string;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdIssueIds: string[] = [];
  const createdCommentIds: string[] = [];
  const createdActivityLogIds: string[] = [];
  const createdNotificationIds: string[] = [];
  const createdAttachmentIds: string[] = [];
  const createdProjectIds: string[] = [];

  const suiteId = 'iss-' + Math.random().toString(36).substring(2, 8);

  function token(userId: string, role: string, orgId: string, orgType: string): string {
    return jwtService.sign({
      userId,
      role,
      organizationId: orgId,
      organizationType: orgType,
    } satisfies JwtPayload);
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
        ProjectsModule,
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

    await seed();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function cleanup() {
    if (createdIssueIds.length > 0) {
      await prisma.notification.deleteMany({ where: { issueId: { in: createdIssueIds } } });
      await prisma.activityLog.deleteMany({ where: { issueId: { in: createdIssueIds } } });
      await prisma.comment.deleteMany({ where: { issueId: { in: createdIssueIds } } });
      await prisma.attachment.deleteMany({ where: { issueId: { in: createdIssueIds } } });
    }
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({ where: { id: { in: createdNotificationIds } } });
    }
    if (createdActivityLogIds.length > 0) {
      await prisma.activityLog.deleteMany({ where: { id: { in: createdActivityLogIds } } });
    }
    if (createdAttachmentIds.length > 0) {
      await prisma.attachment.deleteMany({ where: { id: { in: createdAttachmentIds } } });
    }
    if (createdCommentIds.length > 0) {
      await prisma.comment.deleteMany({ where: { id: { in: createdCommentIds } } });
    }
    if (createdIssueIds.length > 0) {
      await prisma.issue.deleteMany({ where: { id: { in: createdIssueIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.activityLog.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.projectUser.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdProjectIds.length > 0) {
      await prisma.projectOrganization.deleteMany({
        where: { projectId: { in: createdProjectIds } },
      });
      await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
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
      data: { name: `Bank-${suiteId}`, type: 'CLIENT' },
    });
    const dataEdgeOrg = await prisma.organization.create({
      data: { name: `Data-Edge-${suiteId}`, type: 'SI' },
    });
    const oracleOrg = await prisma.organization.create({
      data: { name: `Oracle-${suiteId}`, type: 'OEM' },
    });
    createdOrgIds.push(superAdminOrg.id, bankOrg.id, dataEdgeOrg.id, oracleOrg.id);

    bankOrgId = bankOrg.id;
    dataEdgeOrgId = dataEdgeOrg.id;
    oracleOrgId = oracleOrg.id;

    const superAdmin = await prisma.user.create({
      data: { name: 'Super Admin', email: `superadmin-${suiteId}@test.dev`, passwordHash: pw, role: 'SUPER_ADMIN', organizationId: superAdminOrg.id, status: 'ACTIVE' },
    });
    const bankAdmin = await prisma.user.create({
      data: { name: 'Bank Admin', email: `bankadmin-${suiteId}@test.dev`, passwordHash: pw, role: 'ORG_ADMIN', organizationId: bankOrg.id, status: 'ACTIVE' },
    });
    const bankUser = await prisma.user.create({
      data: { name: 'Bank User', email: `bankuser-${suiteId}@test.dev`, passwordHash: pw, role: 'USER', organizationId: bankOrg.id, status: 'ACTIVE' },
    });
    const siAdmin = await prisma.user.create({
      data: { name: 'SI Admin', email: `siadmin-${suiteId}@test.dev`, passwordHash: pw, role: 'ORG_ADMIN', organizationId: dataEdgeOrg.id, status: 'ACTIVE' },
    });
    const siUser = await prisma.user.create({
      data: { name: 'SI User', email: `siuser-${suiteId}@test.dev`, passwordHash: pw, role: 'USER', organizationId: dataEdgeOrg.id, status: 'ACTIVE' },
    });
    const oracleAdmin = await prisma.user.create({
      data: { name: 'Oracle Admin', email: `oracleadmin-${suiteId}@test.dev`, passwordHash: pw, role: 'ORG_ADMIN', organizationId: oracleOrg.id, status: 'ACTIVE' },
    });
    const oracleUser = await prisma.user.create({
      data: { name: 'Oracle User', email: `oracleuser-${suiteId}@test.dev`, passwordHash: pw, role: 'USER', organizationId: oracleOrg.id, status: 'ACTIVE' },
    });
    createdUserIds.push(superAdmin.id, bankAdmin.id, bankUser.id, siAdmin.id, siUser.id, oracleAdmin.id, oracleUser.id);

    superAdminId = superAdmin.id;
    bankAdminId = bankAdmin.id;
    bankUserId = bankUser.id;
    siAdminId = siAdmin.id;
    siUserId = siUser.id;
    oracleAdminId = oracleAdmin.id;
    oracleUserId = oracleUser.id;

    const project = await prisma.project.create({
      data: { name: `TestProject-${suiteId}`, description: 'Integration test project' },
    });
    projectId = project.id;
    createdProjectIds.push(project.id);

    for (const org of [bankOrg, dataEdgeOrg, oracleOrg]) {
      await prisma.projectOrganization.create({
        data: { projectId: project.id, organizationId: org.id },
      });
    }
    for (const user of [superAdmin, bankAdmin, bankUser, siAdmin, siUser, oracleAdmin, oracleUser]) {
      await prisma.projectUser.create({ data: { projectId: project.id, userId: user.id } });
    }
  }

  async function createIssue(actor: { token: string }, overrides: Record<string, any> = {}) {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const res = await request(app.getHttpServer())
      .post('/api/issues')
      .set('Cookie', `access_token=${actor.token}`)
      .send({ title: 'Test Issue', description: 'Test description', type: 'BUG', priority: 'HIGH', deadline: future, projectId, ...overrides });
    if (res.body && res.body.id) createdIssueIds.push(res.body.id);
    return res;
  }

  // Helper: advance issue through full SI internal flow (no QA) to a given status
  async function advanceToUnderReview(issueId: string, siAdminT: string) {
    return request(app.getHttpServer())
      .patch(`/api/issues/${issueId}/status`)
      .set('Cookie', `access_token=${siAdminT}`)
      .send({ status: 'UNDER_REVIEW' });
  }

  // ─── Scenario 1: Create issue ─────────────────────────────────────────────
  describe('Scenario 1: Create issue as Bank user', () => {
    it('auto-sets raised_by_id and raised_by_org_id from JWT', async () => {
      const t = token(bankUserId, 'USER', bankOrgId, 'CLIENT');
      const res = await createIssue({ token: t });
      expect(res.status).toBe(201);
      expect(res.body.raisedById).toBe(bankUserId);
      expect(res.body.raisedByOrgId).toBe(bankOrgId);
      expect(res.body.status).toBe('NEW');
    });
  });

  // ─── Scenario 2: NEW -> UNDER_REVIEW gate (SI only) ──────────────────────
  describe('Scenario 2: NEW -> UNDER_REVIEW gate', () => {
    it('CLIENT ORG_ADMIN cannot move to UNDER_REVIEW', async () => {
      const t = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const issue = await createIssue({ token: t });
      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/status`)
        .set('Cookie', `access_token=${t}`)
        .send({ status: 'UNDER_REVIEW' });
      expect(res.status).toBe(403);
    });

    it('SI ORG_ADMIN can move to UNDER_REVIEW', async () => {
      const bankT = token(bankUserId, 'USER', bankOrgId, 'CLIENT');
      const siT = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const issue = await createIssue({ token: bankT });
      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/status`)
        .set('Cookie', `access_token=${siT}`)
        .send({ status: 'UNDER_REVIEW' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UNDER_REVIEW');
    });
  });

  // ─── Scenario 3: Clarification requested ─────────────────────────────────
  describe('Scenario 3: UNDER_REVIEW -> CLARIFICATION_REQUESTED', () => {
    it('SI admin can request clarification with a comment', async () => {
      const bankT = token(bankUserId, 'USER', bankOrgId, 'CLIENT');
      const siT = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const issue = await createIssue({ token: bankT });
      await advanceToUnderReview(issue.body.id, siT);

      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/status`)
        .set('Cookie', `access_token=${siT}`)
        .send({ status: 'CLARIFICATION_REQUESTED', comment: 'Please clarify the steps to reproduce' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CLARIFICATION_REQUESTED');
    });

    it('CLARIFICATION_REQUESTED without comment fails with 400', async () => {
      const bankT = token(bankUserId, 'USER', bankOrgId, 'CLIENT');
      const siT = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const issue = await createIssue({ token: bankT });
      await advanceToUnderReview(issue.body.id, siT);

      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/status`)
        .set('Cookie', `access_token=${siT}`)
        .send({ status: 'CLARIFICATION_REQUESTED' });
      expect(res.status).toBe(400);
    });

    it('Client can respond with UNDER_REVIEW (providing clarification)', async () => {
      const bankT = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const siT = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const issue = await createIssue({ token: bankT });
      await advanceToUnderReview(issue.body.id, siT);
      await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/status`)
        .set('Cookie', `access_token=${siT}`)
        .send({ status: 'CLARIFICATION_REQUESTED', comment: 'Please clarify' });

      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/status`)
        .set('Cookie', `access_token=${bankT}`)
        .send({ status: 'UNDER_REVIEW', comment: 'Here is the clarification: steps are ABC' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UNDER_REVIEW');
    });
  });

  // ─── Scenario 4: Flow A — Client -> SI ────────────────────────────
  describe('Scenario 4: Full Flow A — Client-SI', () => {
    it('runs NEW -> UNDER_REVIEW -> ASSIGNED -> IN_PROGRESS -> SI_REVIEW -> PENDING_CLIENT_APPROVAL -> CLOSED', async () => {
      const bankT = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const siAdminT = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const siUserT = token(siUserId, 'USER', dataEdgeOrgId, 'SI');
      const issue = await createIssue({ token: bankT });
      const id = issue.body.id;

      // SI reviews
      await advanceToUnderReview(id, siAdminT);

      // SI assigns to SI user
      let r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/assign`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ targetUserId: siUserId, targetOrgId: dataEdgeOrgId });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('ASSIGNED');

      // SI engineer starts work
      r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siUserT}`)
        .send({ status: 'IN_PROGRESS' });
      expect(r.status).toBe(200);

      // SI engineer resolves -> should land in SI_REVIEW
      r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siUserT}`)
        .send({ status: 'RESOLVED', resolutionNote: 'Fixed the root cause' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('SI_REVIEW');

      // SI Admin approves -> PENDING_CLIENT_APPROVAL
      r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ status: 'PENDING_CLIENT_APPROVAL' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('PENDING_CLIENT_APPROVAL');

      // Client closes it
      r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${bankT}`)
        .send({ status: 'CLOSED' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('CLOSED');
      expect(r.body.closedAt).not.toBeNull();
    });
  });

  // ─── Scenario 5: Flow A — SI Rejects Fix ─────────────────────────
  describe('Scenario 5: Full Flow A — SI Rejects Fix', () => {
    it('runs IN_PROGRESS -> SI_REVIEW -> IN_PROGRESS -> SI_REVIEW -> PENDING_CLIENT_APPROVAL path', async () => {
      const bankT = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const siAdminT = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const siUserT = token(siUserId, 'USER', dataEdgeOrgId, 'SI');
      const issue = await createIssue({ token: bankT });
      const id = issue.body.id;

      await advanceToUnderReview(id, siAdminT);
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/assign`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ targetUserId: siUserId, targetOrgId: dataEdgeOrgId });
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siUserT}`)
        .send({ status: 'IN_PROGRESS' });

      // Resolve -> should land in SI_REVIEW
      let r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siUserT}`)
        .send({ status: 'RESOLVED', resolutionNote: 'Done' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('SI_REVIEW');

      // SI Admin rejects -> back to ASSIGNED
      r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ status: 'ASSIGNED', comment: 'Missed a spot' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('ASSIGNED');

      // Assignee must start work again
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siUserT}`)
        .send({ status: 'IN_PROGRESS' });

      // Resolve again
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siUserT}`)
        .send({ status: 'RESOLVED', resolutionNote: 'Fixed the regression' });

      // SI passes
      r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ status: 'PENDING_CLIENT_APPROVAL' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('PENDING_CLIENT_APPROVAL');
    });
  });

  // ─── Scenario 6: Flow B — Client -> SI -> OEM ────────────────────────────
  describe('Scenario 6: Full Flow B — Client-SI-OEM', () => {
    it('runs IN_PROGRESS(OEM) -> SI_REVIEW -> PENDING_CLIENT_APPROVAL -> CLOSED', async () => {
      const bankT = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const siAdminT = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const oracleUserT = token(oracleUserId, 'USER', oracleOrgId, 'OEM');
      const oracleAdminT = token(oracleAdminId, 'ORG_ADMIN', oracleOrgId, 'OEM');
      const issue = await createIssue({ token: bankT });
      const id = issue.body.id;

      await advanceToUnderReview(id, siAdminT);

      // SI assigns to OEM
      let r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/assign`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ targetUserId: oracleUserId, targetOrgId: oracleOrgId });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('ASSIGNED');

      // OEM starts work
      r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${oracleUserT}`)
        .send({ status: 'IN_PROGRESS' });
      expect(r.status).toBe(200);

      // OEM resolves -> auto-routed to SI_REVIEW (because assignedOrg is OEM)
      r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${oracleUserT}`)
        .send({ status: 'RESOLVED', resolutionNote: 'Patched the OEM component' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('SI_REVIEW');

      // Non-SI cannot perform SI_REVIEW actions
      r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${oracleAdminT}`)
        .send({ status: 'PENDING_CLIENT_APPROVAL' });
      expect(r.status).toBe(403);

      // SI approves OEM's fix
      r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ status: 'PENDING_CLIENT_APPROVAL' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('PENDING_CLIENT_APPROVAL');

      // Client closes
      r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${bankT}`)
        .send({ status: 'CLOSED' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('CLOSED');
    });

    it('SI can reject OEM fix and reassign to OEM lead (SI_REVIEW -> ASSIGNED)', async () => {
      const bankT = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const siAdminT = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const oracleUserT = token(oracleUserId, 'USER', oracleOrgId, 'OEM');
      const issue = await createIssue({ token: bankT });
      const id = issue.body.id;

      await advanceToUnderReview(id, siAdminT);
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/assign`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ targetUserId: oracleUserId, targetOrgId: oracleOrgId });
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${oracleUserT}`)
        .send({ status: 'IN_PROGRESS' });
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${oracleUserT}`)
        .send({ status: 'RESOLVED', resolutionNote: 'Attempted fix' });

      // SI rejects -> back to ASSIGNED (SI reassigns to OEM)
      const r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/assign`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ targetUserId: oracleUserId, targetOrgId: oracleOrgId });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('ASSIGNED');
    });
  });

  // ─── Scenario 7: Client rejection -> back to ASSIGNED ────────────────
  describe('Scenario 7: Client rejects -> PENDING_CLIENT_APPROVAL -> ASSIGNED', () => {
    it('client org admin sends back to ASSIGNED', async () => {
      const bankT = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const siAdminT = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const siUserT = token(siUserId, 'USER', dataEdgeOrgId, 'SI');
      const issue = await createIssue({ token: bankT });
      const id = issue.body.id;

      await advanceToUnderReview(id, siAdminT);
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/assign`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ targetUserId: siUserId, targetOrgId: dataEdgeOrgId });
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siUserT}`)
        .send({ status: 'IN_PROGRESS' });
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siUserT}`)
        .send({ status: 'RESOLVED', resolutionNote: 'Fixed' });
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ status: 'PENDING_CLIENT_APPROVAL' });

      const r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${bankT}`)
        .send({ status: 'ASSIGNED', comment: 'The issue still exists, please re-investigate' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('ASSIGNED');
    });
  });

  // ─── Scenario 8: CLOSED -> UNDER_REVIEW (reopen) — SI only ───────────────
  describe('Scenario 8: CLOSED -> UNDER_REVIEW reopen gate', () => {
    it('SI ORG_ADMIN can reopen a closed issue', async () => {
      const bankT = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const siAdminT = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const siUserT = token(siUserId, 'USER', dataEdgeOrgId, 'SI');
      const issue = await createIssue({ token: bankT });
      const id = issue.body.id;

      await advanceToUnderReview(id, siAdminT);
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/assign`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ targetUserId: siUserId, targetOrgId: dataEdgeOrgId });
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siUserT}`)
        .send({ status: 'IN_PROGRESS' });
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siUserT}`)
        .send({ status: 'RESOLVED', resolutionNote: 'Fixed' });
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ status: 'PENDING_CLIENT_APPROVAL' });
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${bankT}`)
        .send({ status: 'CLOSED' });

      const r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ status: 'UNDER_REVIEW', comment: 'Customer reported the issue again' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('UNDER_REVIEW');
    });

    it('CLIENT ORG_ADMIN cannot reopen a closed issue', async () => {
      const bankT = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const siAdminT = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const siUserT = token(siUserId, 'USER', dataEdgeOrgId, 'SI');
      const issue = await createIssue({ token: bankT });
      const id = issue.body.id;

      await advanceToUnderReview(id, siAdminT);
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/assign`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ targetUserId: siUserId, targetOrgId: dataEdgeOrgId });
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siUserT}`)
        .send({ status: 'IN_PROGRESS' });
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siUserT}`)
        .send({ status: 'RESOLVED', resolutionNote: 'Fixed' });
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ status: 'PENDING_CLIENT_APPROVAL' });
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${bankT}`)
        .send({ status: 'CLOSED' });

      const r = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${bankT}`)
        .send({ status: 'UNDER_REVIEW', comment: 'Still broken' });
      expect(r.status).toBe(403);
    });
  });

  // ─── Scenario 9: Invalid transitions ─────────────────────────────────────
  describe('Scenario 9: Invalid status transitions', () => {
    it('NEW -> CLOSED is invalid', async () => {
      const t = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const issue = await createIssue({ token: t });
      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/status`)
        .set('Cookie', `access_token=${t}`)
        .send({ status: 'CLOSED' });
      expect(res.status).toBe(400);
    });

    it('RESOLVED without resolutionNote fails with 400', async () => {
      const bankT = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const siAdminT = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const siUserT = token(siUserId, 'USER', dataEdgeOrgId, 'SI');
      const issue = await createIssue({ token: bankT });
      const id = issue.body.id;

      await advanceToUnderReview(id, siAdminT);
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/assign`)
        .set('Cookie', `access_token=${siAdminT}`)
        .send({ targetUserId: siUserId, targetOrgId: dataEdgeOrgId });
      await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siUserT}`)
        .send({ status: 'IN_PROGRESS' });

      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${id}/status`)
        .set('Cookie', `access_token=${siUserT}`)
        .send({ status: 'RESOLVED' });
      expect(res.status).toBe(400);
    });
  });

  // ─── Scenario 10: Create & basic CRUD ────────────────────────────────────
  describe('Scenario 10: Issue creation validation', () => {
    it('fails with past deadline', async () => {
      const t = token(bankUserId, 'USER', bankOrgId, 'CLIENT');
      const past = new Date(Date.now() - 86_400_000).toISOString();
      const res = await request(app.getHttpServer())
        .post('/api/issues')
        .set('Cookie', `access_token=${t}`)
        .send({ title: 'Past Deadline', type: 'BUG', priority: 'HIGH', deadline: past, projectId });
      expect(res.status).toBe(400);
    });

    it('fails when title is missing', async () => {
      const t = token(bankUserId, 'USER', bankOrgId, 'CLIENT');
      const future = new Date(Date.now() + 86_400_000).toISOString();
      const res = await request(app.getHttpServer())
        .post('/api/issues')
        .set('Cookie', `access_token=${t}`)
        .send({ type: 'BUG', priority: 'HIGH', deadline: future, projectId });
      expect(res.status).toBe(400);
    });
  });

  // ─── Scenario 11: Issue deletion ─────────────────────────────────────────
  describe('Scenario 11: Issue deletion', () => {
    it('creator can delete their own issue', async () => {
      const t = token(bankUserId, 'USER', bankOrgId, 'CLIENT');
      const issue = await createIssue({ token: t });
      const res = await request(app.getHttpServer())
        .delete(`/api/issues/${issue.body.id}`)
        .set('Cookie', `access_token=${t}`);
      expect(res.status).toBe(204);
    });

    it('non-creator non-admin cannot delete', async () => {
      const creatorT = token(bankUserId, 'USER', bankOrgId, 'CLIENT');
      const otherT = token(oracleUserId, 'USER', oracleOrgId, 'OEM');
      const issue = await createIssue({ token: creatorT });
      const res = await request(app.getHttpServer())
        .delete(`/api/issues/${issue.body.id}`)
        .set('Cookie', `access_token=${otherT}`);
      expect(res.status).toBe(403);
    });
  });

  // ─── Scenario 12: Activity log ────────────────────────────────────────────
  describe('Scenario 12: Activity log on status change', () => {
    it('records STATUS_CHANGED entry with old/new values', async () => {
      const bankT = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const siT = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const issue = await createIssue({ token: bankT });
      const id = issue.body.id;

      await advanceToUnderReview(id, siT);

      const activity = await request(app.getHttpServer())
        .get(`/api/issues/${id}/activity`)
        .set('Cookie', `access_token=${siT}`);
      const logs = activity.body;
      expect(logs.some((l: any) => l.action === 'STATUS_CHANGED' && l.oldValue === 'NEW' && l.newValue === 'UNDER_REVIEW')).toBe(true);
    });
  });
});
