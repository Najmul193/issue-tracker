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
import { UsersModule } from '../users.module';
import { AuthModule } from '../../auth/auth.module';
import { IssuesModule } from '../../issues/issues.module';
import { ProjectsModule } from '../../projects/projects.module';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/decorators/current-user.decorator';

describe('Users Management (all scenarios)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let superAdminOrgId: string;
  let bankOrgId: string;
  let dataEdgeOrgId: string;
  let oracleOrgId: string;
  let superAdminId: string;
  let bankAdminId: string;
  let bankUserId: string;
  let siAdminId: string;
  let siUserId: string;
  let oracleUserId: string;
  let projectId: string;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdIssueIds: string[] = [];
  const createdAttachmentIds: string[] = [];
  const createdCommentIds: string[] = [];
  const createdActivityLogIds: string[] = [];
  const createdNotificationIds: string[] = [];
  const createdProjectIds: string[] = [];

  const suiteId = 'usr-' + Math.random().toString(36).substring(2, 8);

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
      await prisma.issue.deleteMany({ where: { id: { in: createdIssueIds } } });
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
    if (createdUserIds.length > 0) {
      await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
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
      data: { name: `SuperAdminOrg-${suiteId}`, type: 'SUPER_ADMIN' },
    });
    const bankOrg = await prisma.organization.create({
      data: { name: `BankOrg-${suiteId}`, type: 'CLIENT' },
    });
    const dataEdgeOrg = await prisma.organization.create({
      data: { name: `DataEdgeOrg-${suiteId}`, type: 'SI' },
    });
    const oracleOrg = await prisma.organization.create({
      data: { name: `OracleOrg-${suiteId}`, type: 'OEM' },
    });
    createdOrgIds.push(superAdminOrg.id, bankOrg.id, dataEdgeOrg.id, oracleOrg.id);

    superAdminOrgId = superAdminOrg.id;
    bankOrgId = bankOrg.id;
    dataEdgeOrgId = dataEdgeOrg.id;
    oracleOrgId = oracleOrg.id;

    const superAdmin = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: `superadmin-${suiteId}@test.dev`,
        passwordHash: pw,
        role: 'SUPER_ADMIN',
        organizationId: superAdminOrg.id,
        status: 'ACTIVE',
      },
    });
    const bankAdmin = await prisma.user.create({
      data: {
        name: 'Bank Admin',
        email: `bankadmin-${suiteId}@test.dev`,
        passwordHash: pw,
        role: 'ORG_ADMIN',
        organizationId: bankOrg.id,
        status: 'ACTIVE',
      },
    });
    const bankUser = await prisma.user.create({
      data: {
        name: 'Bank User',
        email: `bankuser-${suiteId}@test.dev`,
        passwordHash: pw,
        role: 'USER',
        organizationId: bankOrg.id,
        status: 'ACTIVE',
      },
    });
    const siAdmin = await prisma.user.create({
      data: {
        name: 'SI Admin',
        email: `siadmin-${suiteId}@test.dev`,
        passwordHash: pw,
        role: 'ORG_ADMIN',
        organizationId: dataEdgeOrg.id,
        status: 'ACTIVE',
      },
    });
    const siUser = await prisma.user.create({
      data: {
        name: 'SI User',
        email: `siuser-${suiteId}@test.dev`,
        passwordHash: pw,
        role: 'USER',
        organizationId: dataEdgeOrg.id,
        status: 'ACTIVE',
      },
    });
    const oracleUser = await prisma.user.create({
      data: {
        name: 'Oracle User',
        email: `oracleuser-${suiteId}@test.dev`,
        passwordHash: pw,
        role: 'USER',
        organizationId: oracleOrg.id,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(
      superAdmin.id,
      bankAdmin.id,
      bankUser.id,
      siAdmin.id,
      siUser.id,
      oracleUser.id,
    );

    superAdminId = superAdmin.id;
    bankAdminId = bankAdmin.id;
    bankUserId = bankUser.id;
    siAdminId = siAdmin.id;
    siUserId = siUser.id;
    oracleUserId = oracleUser.id;

    const project = await prisma.project.create({
      data: { name: `TestProject-${suiteId}`, description: 'Users test project' },
    });
    projectId = project.id;
    createdProjectIds.push(project.id);

    for (const org of [bankOrg, dataEdgeOrg, oracleOrg]) {
      await prisma.projectOrganization.create({
        data: { projectId: project.id, organizationId: org.id },
      });
    }

    for (const user of [superAdmin, bankAdmin, bankUser, siAdmin, siUser, oracleUser]) {
      await prisma.projectUser.create({
        data: { projectId: project.id, userId: user.id },
      });
    }
  }

  describe('Scenario 1: SUPER_ADMIN creates an ORG_ADMIN for Bank', () => {
    it('succeeds', async () => {
      const t = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .post('/api/users')
        .set('Cookie', `access_token=${t}`)
        .send({
          name: 'New Bank Admin',
          email: `newbankadmin-${suiteId}@test.dev`,
          password: 'password123',
          role: 'ORG_ADMIN',
          organizationId: bankOrgId,
        });
      expect(res.status).toBe(201);
      expect(res.body.email).toBe(`newbankadmin-${suiteId}@test.dev`);
      expect(res.body.role).toBe('ORG_ADMIN');
      if (res.body.id) createdUserIds.push(res.body.id);
    });
  });

  describe('Scenario 2: ORG_ADMIN (Bank) attempts to create an ORG_ADMIN', () => {
    it('returns 403', async () => {
      const t = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const res = await request(app.getHttpServer())
        .post('/api/users')
        .set('Cookie', `access_token=${t}`)
        .send({
          name: 'Wannabe Admin',
          email: `wannabe-${suiteId}@test.dev`,
          password: 'password123',
          role: 'ORG_ADMIN',
          organizationId: bankOrgId,
        });
      expect(res.status).toBe(403);
    });
  });

  describe('Scenario 3: ORG_ADMIN (Bank) creates a USER in their own org', () => {
    it('succeeds', async () => {
      const t = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const res = await request(app.getHttpServer())
        .post('/api/users')
        .set('Cookie', `access_token=${t}`)
        .send({
          name: 'New Bank User',
          email: `newbankuser-${suiteId}@test.dev`,
          password: 'password123',
          role: 'USER',
          organizationId: bankOrgId,
        });
      expect(res.status).toBe(201);
      expect(res.body.role).toBe('USER');
      if (res.body.id) createdUserIds.push(res.body.id);
    });
  });

  describe('Scenario 4: ORG_ADMIN (Bank) attempts to create a USER in Oracle org', () => {
    it('returns 403', async () => {
      const t = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const res = await request(app.getHttpServer())
        .post('/api/users')
        .set('Cookie', `access_token=${t}`)
        .send({
          name: 'Cross Org User',
          email: `crossorg-${suiteId}@test.dev`,
          password: 'password123',
          role: 'USER',
          organizationId: oracleOrgId,
        });
      expect(res.status).toBe(403);
    });
  });

  describe('Scenario 5: USER attempts to create anyone', () => {
    it('returns 403', async () => {
      const t = token(bankUserId, 'USER', bankOrgId, 'CLIENT');
      const res = await request(app.getHttpServer())
        .post('/api/users')
        .set('Cookie', `access_token=${t}`)
        .send({
          name: 'User Tries',
          email: `usertries-${suiteId}@test.dev`,
          password: 'password123',
          role: 'USER',
          organizationId: bankOrgId,
        });
      expect(res.status).toBe(403);
    });
  });

  describe('Scenario 6: Open issue visibility - Oracle USER views Bank/SI issue', () => {
    it('Oracle user with zero involvement can view a Bank-raised issue', async () => {
      const bankToken = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const siToken = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');

      const future = new Date(Date.now() + 86_400_000).toISOString();
      const createRes = await request(app.getHttpServer())
        .post('/api/issues')
        .set('Cookie', `access_token=${bankToken}`)
        .send({
          title: 'Cross-Org Test Issue',
          description: 'Bank issue visible to all',
          type: 'BUG',
          priority: 'HIGH',
          deadline: future,
          projectId,
        });
      expect(createRes.status).toBe(201);
      const issueId = createRes.body.id;
      createdIssueIds.push(issueId);

      await request(app.getHttpServer())
        .patch(`/api/issues/${issueId}/assign`)
        .set('Cookie', `access_token=${bankToken}`)
        .send({ targetOrgId: dataEdgeOrgId });

      await request(app.getHttpServer())
        .post(`/api/issues/${issueId}/comments`)
        .set('Cookie', `access_token=${siToken}`)
        .send({ text: 'SI comment on Bank issue' });

      const oracleToken = token(oracleUserId, 'USER', oracleOrgId, 'OEM');
      const viewRes = await request(app.getHttpServer())
        .get(`/api/issues/${issueId}`)
        .set('Cookie', `access_token=${oracleToken}`);
      expect(viewRes.status).toBe(200);
      expect(viewRes.body.title).toBe('Cross-Org Test Issue');
      expect(viewRes.body.comments).toBeDefined();
      expect(viewRes.body.comments.length).toBeGreaterThanOrEqual(1);
      expect(viewRes.body.attachments).toBeDefined();
    });
  });

  describe('Scenario 7: Open comment - Oracle user comments on Bank/SI issue', () => {
    it('Oracle user with zero involvement can comment on a Bank/SI-only issue', async () => {
      const bankToken = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const future = new Date(Date.now() + 86_400_000).toISOString();
      const createRes = await request(app.getHttpServer())
        .post('/api/issues')
        .set('Cookie', `access_token=${bankToken}`)
        .send({
          title: 'Comment Test Issue',
          description: 'test',
          type: 'BUG',
          priority: 'HIGH',
          deadline: future,
          projectId,
        });
      const issueId = createRes.body.id;
      createdIssueIds.push(issueId);

      const oracleToken = token(oracleUserId, 'USER', oracleOrgId, 'OEM');
      const res = await request(app.getHttpServer())
        .post(`/api/issues/${issueId}/comments`)
        .set('Cookie', `access_token=${oracleToken}`)
        .send({ text: 'Oracle user commenting on a Bank issue - should succeed' });
      expect(res.status).toBe(201);
      expect(res.body.text).toContain('Oracle user commenting');
    });
  });

  describe('Scenario 8: Scoped status change - Oracle user cannot change status on Bank/SI issue', () => {
    it('returns 403 for Oracle user trying to change status', async () => {
      const bankToken = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const future = new Date(Date.now() + 86_400_000).toISOString();
      const createRes = await request(app.getHttpServer())
        .post('/api/issues')
        .set('Cookie', `access_token=${bankToken}`)
        .send({
          title: 'Status Test Issue',
          description: 'test',
          type: 'BUG',
          priority: 'HIGH',
          deadline: future,
          projectId,
        });
      const issueId = createRes.body.id;
      createdIssueIds.push(issueId);

      const oracleToken = token(oracleUserId, 'USER', oracleOrgId, 'OEM');
      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issueId}/status`)
        .set('Cookie', `access_token=${oracleToken}`)
        .send({ status: 'ACKNOWLEDGED' });
      expect(res.status).toBe(403);
    });
  });

  describe('Scenario 9: Scoped status change - assigned user can change status', () => {
    it('returns 200 for assigned user changing status', async () => {
      const bankAdminToken = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const siAdminToken = token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
      const siUserToken = token(siUserId, 'USER', dataEdgeOrgId, 'SI');
      const future = new Date(Date.now() + 86_400_000).toISOString();
      const createRes = await request(app.getHttpServer())
        .post('/api/issues')
        .set('Cookie', `access_token=${bankAdminToken}`)
        .send({
          title: 'Assign Status Test',
          description: 'test',
          type: 'BUG',
          priority: 'HIGH',
          deadline: future,
          projectId,
        });
      const issueId = createRes.body.id;
      createdIssueIds.push(issueId);

      await request(app.getHttpServer())
        .patch(`/api/issues/${issueId}/assign`)
        .set('Cookie', `access_token=${bankAdminToken}`)
        .send({ targetOrgId: dataEdgeOrgId });

      await request(app.getHttpServer())
        .patch(`/api/issues/${issueId}/assign`)
        .set('Cookie', `access_token=${siAdminToken}`)
        .send({ targetUserId: siUserId, targetOrgId: dataEdgeOrgId });

      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issueId}/status`)
        .set('Cookie', `access_token=${siUserToken}`)
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_PROGRESS');
    });
  });

  describe('Scenario 10: ORG_ADMIN PATCH another org user', () => {
    it('returns 403', async () => {
      const bankAdminToken = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const res = await request(app.getHttpServer())
        .patch(`/api/users/${oracleUserId}`)
        .set('Cookie', `access_token=${bankAdminToken}`)
        .send({ name: 'Hacked Name' });
      expect(res.status).toBe(403);
    });
  });

  describe('Scenario 11: ORG_ADMIN PATCH another ORG_ADMIN in their own org', () => {
    it('returns 403', async () => {
      const pw = await bcrypt.hash('password123', 4);
      const otherAdmin = await prisma.user.create({
        data: {
          name: 'Other Admin',
          email: `otheradmin-${suiteId}@test.dev`,
          passwordHash: pw,
          role: 'ORG_ADMIN',
          organizationId: bankOrgId,
          status: 'ACTIVE',
        },
      });
      createdUserIds.push(otherAdmin.id);

      const bankAdminToken = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const res = await request(app.getHttpServer())
        .patch(`/api/users/${otherAdmin.id}`)
        .set('Cookie', `access_token=${bankAdminToken}`)
        .send({ name: 'Renamed' });
      expect(res.status).toBe(403);
    });
  });

  describe('Scenario 12: User cannot deactivate own account', () => {
    it('returns 403', async () => {
      const bankAdminToken = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const res = await request(app.getHttpServer())
        .patch(`/api/users/${bankAdminId}`)
        .set('Cookie', `access_token=${bankAdminToken}`)
        .send({ status: 'INACTIVE' });
      expect(res.status).toBe(403);
    });
  });

  describe('Scenario 13: Soft-delete user', () => {
    it('sets email to deleted prefix and status to INACTIVE', async () => {
      const pw = await bcrypt.hash('password123', 4);
      const deleteTarget = await prisma.user.create({
        data: {
          name: 'Delete Me',
          email: `deleteme-${suiteId}@test.dev`,
          passwordHash: pw,
          role: 'USER',
          organizationId: bankOrgId,
          status: 'ACTIVE',
        },
      });
      createdUserIds.push(deleteTarget.id);

      const adminToken = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const res = await request(app.getHttpServer())
        .delete(`/api/users/${deleteTarget.id}`)
        .set('Cookie', `access_token=${adminToken}`);
      expect(res.status).toBe(200);

      const deletedUser = await prisma.user.findUnique({ where: { id: deleteTarget.id } });
      expect(deletedUser?.email).toContain('deleted-');
      expect(deletedUser?.status).toBe('INACTIVE');
    });
  });

  describe('Scenario 14: Permanent delete - SUPER_ADMIN only', () => {
    it('SUPER_ADMIN can permanently delete a user', async () => {
      const pw = await bcrypt.hash('password123', 4);
      const permanentTarget = await prisma.user.create({
        data: {
          name: 'Permanent Delete',
          email: `permdelete-${suiteId}@test.dev`,
          passwordHash: pw,
          role: 'USER',
          organizationId: bankOrgId,
          status: 'ACTIVE',
        },
      });

      const saToken = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .delete(`/api/users/${permanentTarget.id}/permanent`)
        .set('Cookie', `access_token=${saToken}`);
      expect(res.status).toBe(200);

      const gone = await prisma.user.findUnique({ where: { id: permanentTarget.id } });
      expect(gone).toBeNull();
    });

    it('ORG_ADMIN cannot permanently delete a user', async () => {
      const pw = await bcrypt.hash('password123', 4);
      const permanentTarget = await prisma.user.create({
        data: {
          name: 'Perm Block',
          email: `permblock-${suiteId}@test.dev`,
          passwordHash: pw,
          role: 'USER',
          organizationId: bankOrgId,
          status: 'ACTIVE',
        },
      });
      createdUserIds.push(permanentTarget.id);

      const adminToken = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const res = await request(app.getHttpServer())
        .delete(`/api/users/${permanentTarget.id}/permanent`)
        .set('Cookie', `access_token=${adminToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Scenario 15: GET /users/deleted returns soft-deleted users', () => {
    it('SUPER_ADMIN can list deleted users', async () => {
      const saToken = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .get('/api/users/deleted')
        .set('Cookie', `access_token=${saToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('ORG_ADMIN cannot list deleted users', async () => {
      const adminToken = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const res = await request(app.getHttpServer())
        .get('/api/users/deleted')
        .set('Cookie', `access_token=${adminToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Scenario 16: GET /users/assignable returns role-appropriate users', () => {
    it('returns assignable users for issue context', async () => {
      const adminToken = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const createRes = await request(app.getHttpServer())
        .post('/api/issues')
        .set('Cookie', `access_token=${adminToken}`)
        .send({
          title: 'Assignable Test',
          description: 'test',
          type: 'BUG',
          priority: 'HIGH',
          deadline: new Date(Date.now() + 86_400_000).toISOString(),
          projectId,
        });
      const issueId = createRes.body.id;
      createdIssueIds.push(issueId);

      const res = await request(app.getHttpServer())
        .get(`/api/users/assignable?issueId=${issueId}`)
        .set('Cookie', `access_token=${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Scenario 17: GET /users returns filtered list', () => {
    it('ORG_ADMIN sees only own org users', async () => {
      const adminToken = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'CLIENT');
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Cookie', `access_token=${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const u of res.body) {
        expect(u.organizationId).toBe(bankOrgId);
      }
    });

    it('USER cannot list users', async () => {
      const userToken = token(bankUserId, 'USER', bankOrgId, 'CLIENT');
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Cookie', `access_token=${userToken}`);
      expect(res.status).toBe(403);
    });
  });
});
