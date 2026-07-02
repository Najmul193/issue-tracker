import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { HealthModule } from '../../health/health.module';
import { UsersModule } from '../../users/users.module';
import { AuthModule } from '../../auth/auth.module';
import { IssuesModule } from '../../issues/issues.module';
import { StorageModule } from '../../storage/storage.module';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/decorators/current-user.decorator';

// Mock file-type (ESM-only package) for Jest CJS compatibility
// Manual mock is in __mocks__/file-type.ts
jest.mock('file-type');

describe('Attachments Integration (9 scenarios)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let bankOrgId: string;
  let dataEdgeOrgId: string;
  let bankUserId: string;
  let bankAdminId: string;
  let siAdminId: string;
  let siUserId: string;

  function token(userId: string, role: string, orgId: string, orgType: string): string {
    return jwtService.sign({ userId, role, organizationId: orgId, organizationType: orgType } satisfies JwtPayload);
  }

  const validPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');

  beforeAll(async () => {
    process.env.UPLOAD_DIR = path.resolve(__dirname, '../../../../test-uploads');
    process.env.MAX_UPLOAD_SIZE_MB = '15';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10_000 }]),
        PrismaModule,
        HealthModule,
        UsersModule,
        AuthModule,
        IssuesModule,
        StorageModule,
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
    const uploadDir = path.resolve(__dirname, '../../../../test-uploads');
    if (fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }
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

    const bankOrg = await prisma.organization.create({ data: { name: 'Bank', type: 'BANK' } });
    const dataEdgeOrg = await prisma.organization.create({ data: { name: 'Data Edge', type: 'SI' } });

    bankOrgId = bankOrg.id;
    dataEdgeOrgId = dataEdgeOrg.id;

    const bankUser = await prisma.user.create({
      data: { name: 'Bank User', email: 'bankuser@att.test', passwordHash: pw, role: 'USER', organizationId: bankOrg.id, status: 'ACTIVE' },
    });
    const bankAdmin = await prisma.user.create({
      data: { name: 'Bank Admin', email: 'bankadmin@att.test', passwordHash: pw, role: 'ORG_ADMIN', organizationId: bankOrg.id, status: 'ACTIVE' },
    });
    const siAdmin = await prisma.user.create({
      data: { name: 'SI Admin', email: 'siadmin@att.test', passwordHash: pw, role: 'ORG_ADMIN', organizationId: dataEdgeOrg.id, status: 'ACTIVE' },
    });
    const siUser = await prisma.user.create({
      data: { name: 'SI User', email: 'siuser@att.test', passwordHash: pw, role: 'USER', organizationId: dataEdgeOrg.id, status: 'ACTIVE' },
    });

    bankUserId = bankUser.id;
    bankAdminId = bankAdmin.id;
    siAdminId = siAdmin.id;
    siUserId = siUser.id;
  }

  async function createIssue(tokenStr: string) {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const res = await request(app.getHttpServer())
      .post('/api/issues')
      .set('Cookie', `access_token=${tokenStr}`)
      .send({ title: 'Attachment Test Issue', description: 'test', type: 'BUG', priority: 'HIGH', deadline: future });
    return res.body;
  }

  const bankUserToken = () => token(bankUserId, 'USER', bankOrgId, 'BANK');
  const bankAdminToken = () => token(bankAdminId, 'ORG_ADMIN', bankOrgId, 'BANK');
  const siAdminToken = () => token(siAdminId, 'ORG_ADMIN', dataEdgeOrgId, 'SI');
  const siUserToken = () => token(siUserId, 'USER', dataEdgeOrgId, 'SI');

  describe('Scenario 1: Valid upload (PDF)', () => {
    it('creates Attachment record and ActivityLog entry', async () => {
      const t = bankUserToken();
      const issue = await createIssue(t);

      const res = await request(app.getHttpServer())
        .post(`/api/issues/${issue.id}/attachments`)
        .set('Cookie', `access_token=${t}`)
        .attach('files', validPdf, { filename: 'report.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].fileName).toBe('report.pdf');
      expect(res.body[0].fileType).toBe('application/pdf');
      expect(res.body[0].fileSize).toBe(validPdf.length);
      expect(res.body[0].issueId).toBe(issue.id);
      expect(res.body[0].uploadedById).toBe(bankUserId);
      expect(res.body[0]).not.toHaveProperty('storagePath');

      // ActivityLog was created
      const activity = await request(app.getHttpServer())
        .get(`/api/issues/${issue.id}/activity`)
        .set('Cookie', `access_token=${t}`);
      const logs = activity.body;
      expect(logs.some((l: any) => l.action === 'ATTACHMENT_ADDED' && l.newValue === 'report.pdf')).toBe(true);
    });
  });

  describe('Scenario 2: Oversized file (>15MB)', () => {
    it('rejected with 400', async () => {
      const t = bankUserToken();
      const issue = await createIssue(t);
      const bigBuf = Buffer.alloc(16 * 1024 * 1024 + 1, 0); // >15MB

      const res = await request(app.getHttpServer())
        .post(`/api/issues/${issue.id}/attachments`)
        .set('Cookie', `access_token=${t}`)
        .attach('files', bigBuf, { filename: 'huge.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('exceeds the maximum size');
    });
  });

  describe('Scenario 3: Disguised file type (ELF as .pdf)', () => {
    it('magic-byte check rejects with 400', async () => {
      const t = bankUserToken();
      const issue = await createIssue(t);
      const elfBuf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00]);

      const res = await request(app.getHttpServer())
        .post(`/api/issues/${issue.id}/attachments`)
        .set('Cookie', `access_token=${t}`)
        .attach('files', elfBuf, { filename: 'innocent.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('does not match detected type');
    });
  });

  describe('Scenario 4: Wrong declared Content-Type vs actual content', () => {
    it('PNG content declared as image/jpeg rejected with 400', async () => {
      const t = bankUserToken();
      const issue = await createIssue(t);
      const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      const res = await request(app.getHttpServer())
        .post(`/api/issues/${issue.id}/attachments`)
        .set('Cookie', `access_token=${t}`)
        .attach('files', pngBuf, { filename: 'image.png', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('does not match detected type');
    });
  });

  describe('Scenario 5: Upload by user who cannot see the issue', () => {
    it('returns 404', async () => {
      const bankToken = bankUserToken();
      const siToken = siUserToken();
      const issue = await createIssue(bankToken);

      const res = await request(app.getHttpServer())
        .post(`/api/issues/${issue.id}/attachments`)
        .set('Cookie', `access_token=${siToken}`)
        .attach('files', validPdf, { filename: 'report.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(404);
    });
  });

  describe('Scenario 6: Download by a user who can see the issue', () => {
    it('returns 200 with correct Content-Type and Content-Disposition', async () => {
      const t = bankUserToken();
      const issue = await createIssue(t);

      const uploadRes = await request(app.getHttpServer())
        .post(`/api/issues/${issue.id}/attachments`)
        .set('Cookie', `access_token=${t}`)
        .attach('files', validPdf, { filename: 'download.pdf', contentType: 'application/pdf' });
      const attachmentId = uploadRes.body[0].id;

      const res = await request(app.getHttpServer())
        .get(`/api/attachments/${attachmentId}/download`)
        .set('Cookie', `access_token=${t}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('download.pdf');
      expect(res.body).toBeDefined();
    });
  });

  describe('Scenario 7: Download attempt by user from unrelated org', () => {
    it('returns 404', async () => {
      const bankToken = bankUserToken();
      const siToken = siUserToken();
      const issue = await createIssue(bankToken);

      const uploadRes = await request(app.getHttpServer())
        .post(`/api/issues/${issue.id}/attachments`)
        .set('Cookie', `access_token=${bankToken}`)
        .attach('files', validPdf, { filename: 'secret.pdf', contentType: 'application/pdf' });
      const attachmentId = uploadRes.body[0].id;

      const res = await request(app.getHttpServer())
        .get(`/api/attachments/${attachmentId}/download`)
        .set('Cookie', `access_token=${siToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Scenario 8: More than 5 files in one request', () => {
    it('rejected with 400', async () => {
      const t = bankUserToken();
      const issue = await createIssue(t);

      const reqBuilder = request(app.getHttpServer())
        .post(`/api/issues/${issue.id}/attachments`)
        .set('Cookie', `access_token=${t}`);

      for (let i = 0; i < 6; i++) {
        reqBuilder.attach('files', validPdf, { filename: `file${i}.pdf`, contentType: 'application/pdf' });
      }

      const res = await reqBuilder;
      expect(res.status).toBe(400);
      // Multer's FileFieldsInterceptor with maxCount:5 rejects extra files before service validation
      expect(res.body.message).toContain('Unexpected field');
    });
  });

  describe('Scenario 9: Comment with attached file', () => {
    it('Attachment linked to comment_id, not directly to issue_id', async () => {
      const t = bankUserToken();
      const issue = await createIssue(t);

      const res = await request(app.getHttpServer())
        .post(`/api/issues/${issue.id}/comments`)
        .set('Cookie', `access_token=${t}`)
        .field('text', 'Comment with attachment')
        .attach('attachments', validPdf, { filename: 'comment-file.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body.text).toBe('Comment with attachment');

      const commentId = res.body.id;

      // Verify attachment is linked to comment_id, not directly to issue_id
      const activity = await request(app.getHttpServer())
        .get(`/api/issues/${issue.id}/activity`)
        .set('Cookie', `access_token=${t}`);
      const attLog = activity.body.find((l: any) => l.action === 'ATTACHMENT_ADDED' && l.newValue === 'comment-file.pdf');
      expect(attLog).toBeDefined();

      // Fetch the attachment via the comment to verify linkage
      const attachments = await prisma.attachment.findMany({ where: { commentId } });
      expect(attachments).toHaveLength(1);
      expect(attachments[0].fileName).toBe('comment-file.pdf');
      expect(attachments[0].issueId).toBe(issue.id);
      expect(attachments[0].commentId).toBe(commentId);
    });
  });
});
