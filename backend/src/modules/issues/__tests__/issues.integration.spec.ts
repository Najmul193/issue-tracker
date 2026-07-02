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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/decorators/current-user.decorator';

describe('Issues Integration (all 10 scenarios)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // User/org references populated during seed
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

    // Seed fresh data
    await seed();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function cleanup() {
    await prisma.notification.deleteMany();
    await prisma.activityLog.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.issue.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
  }

  async function seed() {
    await cleanup();

    const pw = await bcrypt.hash('password123', 4);

    const superAdminOrg = await prisma.organization.create({
      data: { name: 'Super Admin', type: 'SUPER_ADMIN' },
    });
    const bankOrg = await prisma.organization.create({
      data: { name: 'Bank', type: 'BANK' },
    });
    const dataEdgeOrg = await prisma.organization.create({
      data: { name: 'Data Edge', type: 'SI' },
    });
    const oracleOrg = await prisma.organization.create({
      data: { name: 'Oracle', type: 'ORACLE' },
    });

    bankOrgId = bankOrg.id;
    dataEdgeOrgId = dataEdgeOrg.id;
    oracleOrgId = oracleOrg.id;

    const superAdmin = await prisma.user.create({
      data: { name: 'Super Admin', email: 'superadmin@test.dev', passwordHash: pw, role: 'SUPER_ADMIN', organizationId: superAdminOrg.id, status: 'ACTIVE' },
    });
    const bankAdmin = await prisma.user.create({
      data: { name: 'Bank Admin', email: 'bankadmin@test.dev', passwordHash: pw, role: 'ORG_ADMIN', organizationId: bankOrg.id, status: 'ACTIVE' },
    });
    const bankUser = await prisma.user.create({
      data: { name: 'Bank User', email: 'bankuser@test.dev', passwordHash: pw, role: 'USER', organizationId: bankOrg.id, status: 'ACTIVE' },
    });
    const siAdmin = await prisma.user.create({
      data: { name: 'SI Admin', email: 'siadmin@test.dev', passwordHash: pw, role: 'ORG_ADMIN', organizationId: dataEdgeOrg.id, status: 'ACTIVE' },
    });
    const siUser = await prisma.user.create({
      data: { name: 'SI User', email: 'siuser@test.dev', passwordHash: pw, role: 'USER', organizationId: dataEdgeOrg.id, status: 'ACTIVE' },
    });
    const oracleAdmin = await prisma.user.create({
      data: { name: 'Oracle Admin', email: 'oracleadmin@test.dev', passwordHash: pw, role: 'ORG_ADMIN', organizationId: oracleOrg.id, status: 'ACTIVE' },
    });
    const oracleUser = await prisma.user.create({
      data: { name: 'Oracle User', email: 'oracleuser@test.dev', passwordHash: pw, role: 'USER', organizationId: oracleOrg.id, status: 'ACTIVE' },
    });

    superAdminId = superAdmin.id;
    bankAdminId = bankAdmin.id;
    bankUserId = bankUser.id;
    siAdminId = siAdmin.id;
    siUserId = siUser.id;
    oracleAdminId = oracleAdmin.id;
    oracleUserId = oracleUser.id;
  }

  // Helper to create an issue as a specific user
  async function createIssue(actor: { token: string }, overrides: Record<string, any> = {}) {
    const future = new Date(Date.now() + 86_400_000).toISOString(); // tomorrow
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
    return res;
  }

  describe('Scenario 1: Create issue as Bank user', () => {
    it('auto-sets raised_by_id and raised_by_org_id from JWT', async () => {
      const t = token(bankUserId, 'USER', bankOrgId, 'BANK');
      const res = await createIssue({ token: t });
      expect(res.status).toBe(201);
      expect(res.body.raisedById).toBe(bankUserId);
      expect(res.body.raisedByOrgId).toBe(bankOrgId);
      expect(res.body.raisedBy?.email).toBe('bankuser@test.dev');
      expect(res.body.raisedByOrg?.name).toBe('Bank');
    });
  });

  describe('Scenario 2: ORG_ADMIN assigns within own org', () => {
    it('succeeds', async () => {
      const t = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'BANK');
      const issue = await createIssue({ token: t });
      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/assign`)
        .set('Cookie', `access_token=${t}`)
        .send({ targetUserId: bankUserId, targetOrgId: bankOrgId });
      expect(res.status).toBe(200);
      expect(res.body.assignedToUserId).toBe(bankUserId);
      expect(res.body.assignedToOrgId).toBe(bankOrgId);
      expect(res.body.assignedById).toBe(bankAdminId);
    });
  });

  describe('Scenario 3: ORG_ADMIN assigns to user in different org', () => {
    it('fails with 403', async () => {
      const t = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const issue = await createIssue({ token: t });
      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/assign`)
        .set('Cookie', `access_token=${t}`)
        .send({ targetUserId: oracleUserId, targetOrgId: oracleOrgId });
      expect(res.status).toBe(403);
    });
  });

  describe('Scenario 4: ORG_ADMIN org-level handoff (no userId)', () => {
    it('succeeds, assigned_to_user_id stays null', async () => {
      const t = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const issue = await createIssue({ token: t });
      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/assign`)
        .set('Cookie', `access_token=${t}`)
        .send({ targetOrgId: oracleOrgId });
      expect(res.status).toBe(200);
      expect(res.body.assignedToUserId).toBeNull();
      expect(res.body.assignedToOrgId).toBe(oracleOrgId);
    });
  });

  describe('Scenario 5: USER attempts to assign', () => {
    it('fails with 403', async () => {
      const t = token(bankUserId, 'USER', bankOrgId, 'BANK');
      const issue = await createIssue({ token: t });
      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/assign`)
        .set('Cookie', `access_token=${t}`)
        .send({ targetUserId: bankUserId, targetOrgId: bankOrgId });
      expect(res.status).toBe(403);
    });
  });

  describe('Scenario 6: Valid status transition NEW -> ACKNOWLEDGED', () => {
    it('succeeds and creates ActivityLog entry', async () => {
      const t = token(bankUserId, 'USER', bankOrgId, 'BANK');
      const issue = await createIssue({ token: t });
      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/status`)
        .set('Cookie', `access_token=${t}`)
        .send({ status: 'ACKNOWLEDGED' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACKNOWLEDGED');

      const activity = await request(app.getHttpServer())
        .get(`/api/issues/${issue.body.id}/activity`)
        .set('Cookie', `access_token=${t}`);
      expect(activity.status).toBe(200);
      const logs = activity.body;
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].action).toBe('STATUS_CHANGED');
      expect(logs[0].oldValue).toBe('NEW');
      expect(logs[0].newValue).toBe('ACKNOWLEDGED');
    });
  });

  describe('Scenario 7: Invalid status transition NEW -> CLOSED', () => {
    it('fails with 400', async () => {
      const t = token(bankUserId, 'USER', bankOrgId, 'BANK');
      const issue = await createIssue({ token: t });
      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/status`)
        .set('Cookie', `access_token=${t}`)
        .send({ status: 'CLOSED' });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot transition');
    });
  });

  describe('Scenario 8: REOPENED without comment', () => {
    it('fails with 400', async () => {
      const t = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'BANK');
      const issue = await createIssue({ token: t });

      // Transition NEW -> ACKNOWLEDGED first (need a valid path to RESOLVED)
      await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/status`)
        .set('Cookie', `access_token=${t}`)
        .send({ status: 'ACKNOWLEDGED' });

      // Need to assign and progress through the chain to get to RESOLVED
      const issue2 = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/assign`)
        .set('Cookie', `access_token=${t}`)
        .send({ targetUserId: bankUserId, targetOrgId: bankOrgId });

      await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/status`)
        .set('Cookie', `access_token=${t}`)
        .send({ status: 'IN_PROGRESS' });

      await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/status`)
        .set('Cookie', `access_token=${t}`)
        .send({ status: 'RESOLVED' });

      // Now REOPENED without comment
      const reopenRes = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.body.id}/status`)
        .set('Cookie', `access_token=${t}`)
        .send({ status: 'REOPENED' });
      expect(reopenRes.status).toBe(400);
      expect(reopenRes.body.message).toContain('comment is required');
    });
  });

  describe('Scenario 9: Cross-org visibility 404', () => {
    it('Bank user gets 404 for an issue only involving SI/Oracle', async () => {
      const siToken = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const siIssue = await createIssue({ token: siToken });
      const issueId = siIssue.body.id;

      const bankToken = token(bankUserId, 'USER', bankOrgId, 'BANK');
      const res = await request(app.getHttpServer())
        .get(`/api/issues/${issueId}`)
        .set('Cookie', `access_token=${bankToken}`);
      expect(res.status).toBe(404);

      // SI admin CAN see it (same org as raiser)
      const siAdminToken = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const res2 = await request(app.getHttpServer())
        .get(`/api/issues/${issueId}`)
        .set('Cookie', `access_token=${siAdminToken}`);
      expect(res2.status).toBe(200);
    });
  });

  describe('Scenario 10: GET /api/issues respects visibility filter', () => {
    it('Bank user list contains only issues they can see', async () => {
      const bankToken = token(bankUserId, 'USER', bankOrgId, 'BANK');
      const siToken = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');

      // Create 2 issues: 1 Bank, 1 SI (no Bank involvement)
      await createIssue({ token: bankToken });
      const siIssue = await createIssue({ token: siToken });

      // Bank user's list
      const bankList = await request(app.getHttpServer())
        .get('/api/issues')
        .set('Cookie', `access_token=${bankToken}`);
      expect(bankList.status).toBe(200);

      const issueIds = bankList.body.data.map((i: any) => i.id);
      expect(issueIds).not.toContain(siIssue.body.id);
      expect(bankList.body.total).toBeGreaterThanOrEqual(1);

      // SI user's list includes the SI issue
      const siList = await request(app.getHttpServer())
        .get('/api/issues')
        .set('Cookie', `access_token=${siToken}`);
      const siIds = siList.body.data.map((i: any) => i.id);
      expect(siIds).toContain(siIssue.body.id);
    });
  });
});
