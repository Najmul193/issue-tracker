import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { HealthModule } from '../../health/health.module';
import { AuthModule } from '../auth.module';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

/**
 * The 12-character maximum applies only where a password is CREATED or CHANGED.
 * Login must stay uncapped so accounts whose password predates the rule can still
 * sign in — these tests pin both halves of that contract.
 */
describe('Auth — password length rules', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId: string;
  const userIds: string[] = [];
  const suiteId = 'pwlen-' + Math.random().toString(36).substring(2, 8);

  const legacyEmail = `legacy-${suiteId}@test.dev`;
  const legacyPassword = 'a-very-long-legacy-password'; // 27 chars, predates the cap
  const resetEmail = `reset-${suiteId}@test.dev`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10_000 }]),
        PrismaModule,
        HealthModule,
        AuthModule,
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

    const org = await prisma.organization.create({
      data: { name: `PwLenOrg-${suiteId}`, type: 'CLIENT' },
    });
    orgId = org.id;

    const legacyUser = await prisma.user.create({
      data: {
        name: 'Legacy Long Password User',
        email: legacyEmail,
        passwordHash: await bcrypt.hash(legacyPassword, 4),
        role: 'USER',
        status: 'ACTIVE',
        organizationId: orgId,
      },
    });

    const resetUser = await prisma.user.create({
      data: {
        name: 'Reset Target User',
        email: resetEmail,
        passwordHash: await bcrypt.hash('password123', 4),
        role: 'USER',
        status: 'ACTIVE',
        organizationId: orgId,
      },
    });

    userIds.push(legacyUser.id, resetUser.id);
  });

  afterAll(async () => {
    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await app.close();
  });

  async function issueResetToken(userId: string): Promise<string> {
    const token = `tok-${suiteId}-${Math.random().toString(36).substring(2, 12)}`;
    await prisma.passwordResetToken.create({
      data: { userId, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    return token;
  }

  describe('login is NOT capped at 12 characters', () => {
    it('signs in an existing account whose password is longer than 12 characters', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: legacyEmail, password: legacyPassword });

      expect(res.status).toBe(200);
    });

    it('still rejects an empty password with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: legacyEmail, password: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('reset-password IS capped at 12 characters', () => {
    it('rejects a 13-character password with 400', async () => {
      const token = await issueResetToken(userIds[1]);
      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token, password: 'a'.repeat(13) });

      expect(res.status).toBe(400);
    });

    it('accepts a password of exactly 12 characters', async () => {
      const token = await issueResetToken(userIds[1]);
      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token, password: 'a'.repeat(12) });

      expect(res.status).toBe(200);
    });

    it('rejects a 7-character password with 400', async () => {
      const token = await issueResetToken(userIds[1]);
      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token, password: 'a'.repeat(7) });

      expect(res.status).toBe(400);
    });
  });
});
