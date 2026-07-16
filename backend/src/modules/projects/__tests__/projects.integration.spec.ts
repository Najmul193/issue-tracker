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
import { ProjectsModule } from '../projects.module';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/decorators/current-user.decorator';

describe('Projects Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let superAdminOrgId: string;
  let superAdminId: string;
  let bankOrgId: string;
  let siOrgId: string;
  let oemOrgId: string;
  let bankAdminId: string;
  let bankUserId: string;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];

  const suiteId = 'proj-' + Math.random().toString(36).substring(2, 8);

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
    if (createdProjectIds.length > 0) {
      await prisma.projectUser.deleteMany({ where: { projectId: { in: createdProjectIds } } });
      await prisma.projectOrganization.deleteMany({ where: { projectId: { in: createdProjectIds } } });
      await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
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
      data: { name: `SAOrg-${suiteId}`, type: 'SUPER_ADMIN' },
    });
    const bankOrg = await prisma.organization.create({
      data: { name: `Bank-${suiteId}`, type: 'BANK' },
    });
    const siOrg = await prisma.organization.create({
      data: { name: `SI-${suiteId}`, type: 'SI' },
    });
    const oemOrg = await prisma.organization.create({
      data: { name: `OEM-${suiteId}`, type: 'OEM' },
    });
    createdOrgIds.push(superAdminOrg.id, bankOrg.id, siOrg.id, oemOrg.id);

    superAdminOrgId = superAdminOrg.id;
    bankOrgId = bankOrg.id;
    siOrgId = siOrg.id;
    oemOrgId = oemOrg.id;

    const superAdmin = await prisma.user.create({
      data: { name: 'SA', email: `sa-${suiteId}@test.dev`, passwordHash: pw, role: 'SUPER_ADMIN', organizationId: superAdminOrg.id, status: 'ACTIVE' },
    });
    const bankAdmin = await prisma.user.create({
      data: { name: 'BankAdmin', email: `ba-${suiteId}@test.dev`, passwordHash: pw, role: 'ORG_ADMIN', organizationId: bankOrg.id, status: 'ACTIVE' },
    });
    const bankUser = await prisma.user.create({
      data: { name: 'BankUser', email: `bu-${suiteId}@test.dev`, passwordHash: pw, role: 'USER', organizationId: bankOrg.id, status: 'ACTIVE' },
    });
    createdUserIds.push(superAdmin.id, bankAdmin.id, bankUser.id);

    superAdminId = superAdmin.id;
    bankAdminId = bankAdmin.id;
    bankUserId = bankUser.id;
  }

  describe('POST /projects', () => {
    it('SUPER_ADMIN can create a project with BANK+SI+OEM orgs', async () => {
      const t = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Cookie', `access_token=${t}`)
        .send({
          name: `TestProject-${suiteId}`,
          description: 'Test project',
          organizationIds: [bankOrgId, siOrgId, oemOrgId],
        });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe(`TestProject-${suiteId}`);
      expect(res.body.organizations).toHaveLength(3);
      if (res.body.id) createdProjectIds.push(res.body.id);
    });

    it('ORG_ADMIN cannot create a project', async () => {
      const t = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'BANK');
      const res = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Cookie', `access_token=${t}`)
        .send({
          name: `FailProject-${suiteId}`,
          organizationIds: [bankOrgId, siOrgId, oemOrgId],
        });
      expect(res.status).toBe(403);
    });

    it('fails if missing required org types', async () => {
      const t = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Cookie', `access_token=${t}`)
        .send({
          name: `MissingType-${suiteId}`,
          organizationIds: [bankOrgId, siOrgId],
        });
      expect(res.status).toBe(400);
    });

    it('fails if project name already exists', async () => {
      const t = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Cookie', `access_token=${t}`)
        .send({
          name: `TestProject-${suiteId}`,
          organizationIds: [bankOrgId, siOrgId, oemOrgId],
        });
      expect(res.status).toBe(409);
    });
  });

  describe('GET /projects', () => {
    it('SUPER_ADMIN sees all projects', async () => {
      const t = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .get('/api/projects')
        .set('Cookie', `access_token=${t}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('ORG_ADMIN sees projects their org is member of', async () => {
      const pw = await bcrypt.hash('password123', 4);
      const org = await prisma.organization.create({
        data: { name: `ProjOrg-${suiteId}`, type: 'BANK' },
      });
      createdOrgIds.push(org.id);
      const admin = await prisma.user.create({
        data: { name: 'ProjAdmin', email: `pa-${suiteId}@test.dev`, passwordHash: pw, role: 'ORG_ADMIN', organizationId: org.id, status: 'ACTIVE' },
      });
      createdUserIds.push(admin.id);

      const project = await prisma.project.create({
        data: { name: `ProjForOrg-${suiteId}` },
      });
      createdProjectIds.push(project.id);
      await prisma.projectOrganization.create({
        data: { projectId: project.id, organizationId: org.id },
      });

      const t = token(admin.id, 'ORG_ADMIN', org.id, 'BANK');
      const res = await request(app.getHttpServer())
        .get('/api/projects')
        .set('Cookie', `access_token=${t}`);
      expect(res.status).toBe(200);
      const ids = res.body.map((p: any) => p.id);
      expect(ids).toContain(project.id);
    });
  });

  describe('GET /projects/:id', () => {
    it('returns project for member', async () => {
      const pw = await bcrypt.hash('password123', 4);
      const org = await prisma.organization.create({
        data: { name: `MemberOrg-${suiteId}`, type: 'SI' },
      });
      createdOrgIds.push(org.id);
      const user = await prisma.user.create({
        data: { name: 'Member', email: `mem-${suiteId}@test.dev`, passwordHash: pw, role: 'USER', organizationId: org.id, status: 'ACTIVE' },
      });
      createdUserIds.push(user.id);

      const project = await prisma.project.create({
        data: { name: `MemberProj-${suiteId}` },
      });
      createdProjectIds.push(project.id);
      await prisma.projectOrganization.create({
        data: { projectId: project.id, organizationId: org.id },
      });
      await prisma.projectUser.create({
        data: { projectId: project.id, userId: user.id },
      });

      const t = token(user.id, 'USER', org.id, 'SI');
      const res = await request(app.getHttpServer())
        .get(`/api/projects/${project.id}`)
        .set('Cookie', `access_token=${t}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(project.id);
    });

    it('returns 403 for non-member', async () => {
      const pw = await bcrypt.hash('password123', 4);
      const org = await prisma.organization.create({
        data: { name: `NonMemberOrg-${suiteId}`, type: 'OEM' },
      });
      createdOrgIds.push(org.id);
      const user = await prisma.user.create({
        data: { name: 'NonMember', email: `nm-${suiteId}@test.dev`, passwordHash: pw, role: 'USER', organizationId: org.id, status: 'ACTIVE' },
      });
      createdUserIds.push(user.id);

      const project = await prisma.project.create({
        data: { name: `NoAccessProj-${suiteId}` },
      });
      createdProjectIds.push(project.id);

      const t = token(user.id, 'USER', org.id, 'OEM');
      const res = await request(app.getHttpServer())
        .get(`/api/projects/${project.id}`)
        .set('Cookie', `access_token=${t}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /projects/:id', () => {
    it('SUPER_ADMIN can update project', async () => {
      const t = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const createRes = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Cookie', `access_token=${t}`)
        .send({ name: `UpdProj-${suiteId}`, organizationIds: [bankOrgId, siOrgId, oemOrgId] });
      const projId = createRes.body.id;
      createdProjectIds.push(projId);

      const res = await request(app.getHttpServer())
        .patch(`/api/projects/${projId}`)
        .set('Cookie', `access_token=${t}`)
        .send({ description: 'Updated description' });
      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Updated description');
    });

    it('ORG_ADMIN cannot update project', async () => {
      const t = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const createRes = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Cookie', `access_token=${t}`)
        .send({ name: `NoUpdProj-${suiteId}`, organizationIds: [bankOrgId, siOrgId, oemOrgId] });
      const projId = createRes.body.id;
      createdProjectIds.push(projId);

      const adminT = token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'BANK');
      const res = await request(app.getHttpServer())
        .patch(`/api/projects/${projId}`)
        .set('Cookie', `access_token=${adminT}`)
        .send({ description: 'Hacked' });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /projects/:id', () => {
    it('SUPER_ADMIN can delete project', async () => {
      const t = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const createRes = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Cookie', `access_token=${t}`)
        .send({ name: `DelProj-${suiteId}`, organizationIds: [bankOrgId, siOrgId, oemOrgId] });
      const projId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .delete(`/api/projects/${projId}`)
        .set('Cookie', `access_token=${t}`);
      expect(res.status).toBe(204);

      const gone = await prisma.project.findUnique({ where: { id: projId } });
      expect(gone).toBeNull();
    });
  });

  describe('POST /projects/:id/organizations', () => {
    it('SUPER_ADMIN can add org to project', async () => {
      const pw = await bcrypt.hash('password123', 4);
      const extraOrg = await prisma.organization.create({
        data: { name: `ExtraOrg-${suiteId}`, type: 'BANK' },
      });
      createdOrgIds.push(extraOrg.id);
      const extraUser = await prisma.user.create({
        data: { name: 'Extra', email: `extra-${suiteId}@test.dev`, passwordHash: pw, role: 'USER', organizationId: extraOrg.id, status: 'ACTIVE' },
      });
      createdUserIds.push(extraUser.id);

      const t = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const createRes = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Cookie', `access_token=${t}`)
        .send({ name: `AddOrgProj-${suiteId}`, organizationIds: [bankOrgId, siOrgId, oemOrgId] });
      const projId = createRes.body.id;
      createdProjectIds.push(projId);

      const res = await request(app.getHttpServer())
        .post(`/api/projects/${projId}/organizations`)
        .set('Cookie', `access_token=${t}`)
        .send({ organizationId: extraOrg.id });
      expect(res.status).toBe(201);

      const userInProject = await prisma.projectUser.findFirst({
        where: { projectId: projId, userId: extraUser.id },
      });
      expect(userInProject).not.toBeNull();
    });
  });
});
