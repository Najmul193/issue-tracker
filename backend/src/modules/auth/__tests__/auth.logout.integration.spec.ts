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
import { AuthModule } from '../auth.module';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

describe('Auth — logout cookie invalidation', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let orgId: string;
  let userId: string;
  const suiteId = 'logout-' + Math.random().toString(36).substring(2, 8);

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
    jwtService = app.get(JwtService);

    const pw = await bcrypt.hash('password123', 4);
    const org = await prisma.organization.create({
      data: { name: `LogoutTestOrg-${suiteId}`, type: 'CLIENT' },
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: {
        name: 'Logout Test User',
        email: `logouttest-${suiteId}@test.dev`,
        passwordHash: pw,
        role: 'USER',
        status: 'ACTIVE',
        organizationId: orgId,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await app.close();
  });

  it('login sets the cookie with correct attributes', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `logouttest-${suiteId}@test.dev`, password: 'password123' });

    expect(res.status).toBe(200);
    const setCookieHeader: string[] = res.headers['set-cookie'] as unknown as string[];
    expect(setCookieHeader).toBeDefined();

    const accessCookie = setCookieHeader.find((c: string) => c.startsWith('access_token='));
    expect(accessCookie).toBeDefined();
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie).toMatch(/Path=\//i);
  });

  it('logout sends a Set-Cookie header with Max-Age=0 (or past Expires) and matching attributes', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `logouttest-${suiteId}@test.dev`, password: 'password123' });

    const rawCookie = ((loginRes.headers['set-cookie'] as unknown as string[]) || []).find(
      (c: string) => c.startsWith('access_token='),
    );
    const cookieValue = rawCookie!.split(';')[0];

    const logoutRes = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookieValue);

    expect(logoutRes.status).toBe(200);
    const logoutHeaders: string[] = logoutRes.headers['set-cookie'] as unknown as string[];
    expect(logoutHeaders).toBeDefined();

    const cleared = logoutHeaders.find((c: string) => c.startsWith('access_token='));
    expect(cleared).toBeDefined();

    const hasMaxAgeZero = /Max-Age=0/i.test(cleared!);
    const hasExpiredDate = /Expires=Thu, 0?1 Jan 1970|Expires=.*19\d{2}/i.test(cleared!);
    expect(hasMaxAgeZero || hasExpiredDate).toBe(true);

    expect(cleared).toContain('HttpOnly');
    expect(cleared).toMatch(/Path=\//i);
  });

  it('after logout, the browser no longer sends the cookie and /api/auth/me returns 401', async () => {
    const agent = request.agent(app.getHttpServer());

    // Login — agent stores the cookie
    const loginRes = await agent
      .post('/api/auth/login')
      .send({ email: `logouttest-${suiteId}@test.dev`, password: 'password123' });

    expect(loginRes.status).toBe(200);

    // Verify agent sends cookie and gets 200 on /me (logged in)
    const meBefore = await agent.get('/api/auth/me');
    expect(meBefore.status).toBe(200);

    // Logout — agent's cookie jar is updated with Max-Age=0
    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(200);

    // Now the agent should NOT send the access_token cookie → 401
    const meAfter = await agent.get('/api/auth/me');
    expect(meAfter.status).toBe(401);
  });

  it('rejects a request at /api/auth/me when no cookie or bearer token is sent', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
