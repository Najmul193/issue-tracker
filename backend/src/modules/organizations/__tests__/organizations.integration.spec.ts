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
import { OrganizationsModule } from '../organizations.module';
import { ProjectsModule } from '../../projects/projects.module';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/decorators/current-user.decorator';

describe('Organizations Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let superAdminOrgId: string;
  let superAdminId: string;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];

  const suiteId = 'org-' + Math.random().toString(36).substring(2, 8);

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
        OrganizationsModule,
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
      data: { name: `SuperAdminOrg-${suiteId}`, type: 'SUPER_ADMIN' },
    });
    createdOrgIds.push(superAdminOrg.id);
    superAdminOrgId = superAdminOrg.id;

    const superAdmin = await prisma.user.create({
      data: { name: 'Super Admin', email: `sa-${suiteId}@test.dev`, passwordHash: pw, role: 'SUPER_ADMIN', organizationId: superAdminOrg.id, status: 'ACTIVE' },
    });
    createdUserIds.push(superAdmin.id);
    superAdminId = superAdmin.id;
  }

  describe('GET /organizations', () => {
    it('returns organizations that have active users', async () => {
      const pw = await bcrypt.hash('password123', 4);
      const bankOrg = await prisma.organization.create({
        data: { name: `Bank-${suiteId}`, type: 'BANK' },
      });
      createdOrgIds.push(bankOrg.id);
      const user = await prisma.user.create({
        data: { name: 'Bank User', email: `bank-${suiteId}@test.dev`, passwordHash: pw, role: 'USER', organizationId: bankOrg.id, status: 'ACTIVE' },
      });
      createdUserIds.push(user.id);

      const t = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .get('/api/organizations')
        .set('Cookie', `access_token=${t}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((o: any) => o.id);
      expect(ids).toContain(bankOrg.id);
    });

    it('excludes organizations where all users are soft-deleted', async () => {
      const pw = await bcrypt.hash('password123', 4);
      const deletedOrg = await prisma.organization.create({
        data: { name: `DeletedOrg-${suiteId}`, type: 'OEM' },
      });
      createdOrgIds.push(deletedOrg.id);
      const deletedUser = await prisma.user.create({
        data: { name: 'Deleted User', email: `deleted-${suiteId}@test.dev`, passwordHash: pw, role: 'USER', organizationId: deletedOrg.id, status: 'INACTIVE' },
      });
      createdUserIds.push(deletedUser.id);

      const t = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .get('/api/organizations')
        .set('Cookie', `access_token=${t}`);
      expect(res.status).toBe(200);
      const ids = res.body.map((o: any) => o.id);
      expect(ids).not.toContain(deletedOrg.id);
    });
  });

  describe('GET /organizations/deleted', () => {
    it('SUPER_ADMIN can list deleted organizations', async () => {
      const t = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .get('/api/organizations/deleted')
        .set('Cookie', `access_token=${t}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('non-SUPER_ADMIN cannot list deleted organizations', async () => {
      const pw = await bcrypt.hash('password123', 4);
      const org = await prisma.organization.create({
        data: { name: `OrgForUser-${suiteId}`, type: 'BANK' },
      });
      createdOrgIds.push(org.id);
      const user = await prisma.user.create({
        data: { name: 'Org User', email: `orguser-${suiteId}@test.dev`, passwordHash: pw, role: 'ORG_ADMIN', organizationId: org.id, status: 'ACTIVE' },
      });
      createdUserIds.push(user.id);

      const t = token(user.id, 'ORG_ADMIN', org.id, 'BANK');
      const res = await request(app.getHttpServer())
        .get('/api/organizations/deleted')
        .set('Cookie', `access_token=${t}`);
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /organizations/:id (soft-delete)', () => {
    it('SUPER_ADMIN can soft-delete an organization', async () => {
      const pw = await bcrypt.hash('password123', 4);
      const org = await prisma.organization.create({
        data: { name: `SoftDelOrg-${suiteId}`, type: 'SI' },
      });
      const user = await prisma.user.create({
        data: { name: 'SoftDel User', email: `softdel-${suiteId}@test.dev`, passwordHash: pw, role: 'USER', organizationId: org.id, status: 'ACTIVE' },
      });

      const t = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .delete(`/api/organizations/${org.id}`)
        .set('Cookie', `access_token=${t}`);
      expect(res.status).toBe(200);

      const deletedUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(deletedUser?.email).toContain('deleted-');
      expect(deletedUser?.status).toBe('INACTIVE');
    });

    it('non-SUPER_ADMIN cannot soft-delete an organization', async () => {
      const pw = await bcrypt.hash('password123', 4);
      const org = await prisma.organization.create({
        data: { name: `NoDelOrg-${suiteId}`, type: 'BANK' },
      });
      createdOrgIds.push(org.id);
      const user = await prisma.user.create({
        data: { name: 'NoDel User', email: `nodel-${suiteId}@test.dev`, passwordHash: pw, role: 'ORG_ADMIN', organizationId: org.id, status: 'ACTIVE' },
      });
      createdUserIds.push(user.id);

      const t = token(user.id, 'ORG_ADMIN', org.id, 'BANK');
      const res = await request(app.getHttpServer())
        .delete(`/api/organizations/${org.id}`)
        .set('Cookie', `access_token=${t}`);
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /organizations/:id/permanent', () => {
    it('SUPER_ADMIN can permanently delete an organization', async () => {
      const pw = await bcrypt.hash('password123', 4);
      const org = await prisma.organization.create({
        data: { name: `PermDelOrg-${suiteId}`, type: 'OEM' },
      });
      const user = await prisma.user.create({
        data: { name: 'PermDel User', email: `permdel-${suiteId}@test.dev`, passwordHash: pw, role: 'USER', organizationId: org.id, status: 'ACTIVE' },
      });

      const t = token(superAdminId, 'SUPER_ADMIN', superAdminOrgId, 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .delete(`/api/organizations/${org.id}/permanent`)
        .set('Cookie', `access_token=${t}`);
      expect(res.status).toBe(200);

      const goneOrg = await prisma.organization.findUnique({ where: { id: org.id } });
      expect(goneOrg).toBeNull();
      const goneUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(goneUser).toBeNull();
    });

    it('non-SUPER_ADMIN cannot permanently delete an organization', async () => {
      const pw = await bcrypt.hash('password123', 4);
      const org = await prisma.organization.create({
        data: { name: `NoPermOrg-${suiteId}`, type: 'BANK' },
      });
      createdOrgIds.push(org.id);
      const user = await prisma.user.create({
        data: { name: 'NoPerm User', email: `noperm-${suiteId}@test.dev`, passwordHash: pw, role: 'ORG_ADMIN', organizationId: org.id, status: 'ACTIVE' },
      });
      createdUserIds.push(user.id);

      const t = token(user.id, 'ORG_ADMIN', org.id, 'BANK');
      const res = await request(app.getHttpServer())
        .delete(`/api/organizations/${org.id}/permanent`)
        .set('Cookie', `access_token=${t}`);
      expect(res.status).toBe(403);
    });
  });
});
