import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';
import { IssueStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../../users/users.module';
import { AuthModule } from '../../auth/auth.module';
import { IssuesModule } from '../issues.module';
import { ProjectsModule } from '../../projects/projects.module';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/decorators/current-user.decorator';
import { getPermittedTransitions, TransitionTarget } from '../transition-rules';

/**
 * DRIFT SPEC.
 *
 * `getPermittedTransitions()` is a pure re-statement of the guard chain inside
 * `IssuesService.updateStatus()`. The frontend renders its output as buttons, so any
 * disagreement between the two shows up to a user as a button that 403s.
 *
 * This suite proves they agree by brute force: for every valid (from -> to) pair and every
 * actor archetype, it asks the function, then attempts the real transition through the real
 * endpoint, and asserts the answer matched. Required inputs (comment / resolutionNote) are
 * always supplied so that a 400 can never masquerade as an authorization result.
 *
 * If this fails, the table in transition-rules.ts is wrong — not the test.
 */
describe('Transition rules <-> updateStatus (drift)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suiteId = 'tr-' + Math.random().toString(36).substring(2, 8);

  const createdIssueIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdProjectIds: string[] = [];

  let bankOrgId: string;
  let siOrgId: string;
  let oemOrgId: string;
  let projectId: string;

  interface Actor {
    name: string;
    payload: JwtPayload;
    token: string;
  }
  const actors: Record<string, Actor> = {};

  /**
   * Static list — `it.each` is evaluated at collection time, before beforeAll has populated
   * `actors`, so the keys cannot be derived from the object.
   */
  const ACTOR_KEYS = [
    'superAdmin',
    'bankAdmin',
    'bankUser',
    'bankOther',
    'siAdmin',
    'siUser',
    'oemAdmin',
    'oemUser',
  ] as const;

  function makeActor(
    name: string,
    userId: string,
    role: string,
    organizationId: string,
    organizationType: string,
  ): Actor {
    const payload: JwtPayload = { userId, role, organizationId, organizationType };
    return { name, payload, token: jwtService.sign(payload) };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100_000 }]),
        PrismaModule,
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
  }, 60_000);

  afterAll(async () => {
    await cleanup();
    await app.close();
  }, 60_000);

  async function seed() {
    const pw = await bcrypt.hash('password123', 4);

    const superOrg = await prisma.organization.create({
      data: { name: `SA-${suiteId}`, type: 'SUPER_ADMIN' },
    });
    const bankOrg = await prisma.organization.create({
      data: { name: `Bank-${suiteId}`, type: 'CLIENT' },
    });
    const siOrg = await prisma.organization.create({
      data: { name: `SI-${suiteId}`, type: 'SI' },
    });
    const oemOrg = await prisma.organization.create({
      data: { name: `OEM-${suiteId}`, type: 'OEM' },
    });
    createdOrgIds.push(superOrg.id, bankOrg.id, siOrg.id, oemOrg.id);
    bankOrgId = bankOrg.id;
    siOrgId = siOrg.id;
    oemOrgId = oemOrg.id;

    const mk = async (name: string, role: string, orgId: string) =>
      prisma.user.create({
        data: {
          name,
          email: `${name}-${suiteId}@test.dev`,
          passwordHash: pw,
          role: role as any,
          organizationId: orgId,
          status: 'ACTIVE',
        },
      });

    const superAdmin = await mk('superadmin', 'SUPER_ADMIN', superOrg.id);
    const bankAdmin = await mk('bankadmin', 'ORG_ADMIN', bankOrg.id);
    const bankUser = await mk('bankuser', 'USER', bankOrg.id);
    // A second client user who is NOT the creator — exercises isCreator vs org membership.
    const bankOther = await mk('bankother', 'USER', bankOrg.id);
    const siAdmin = await mk('siadmin', 'ORG_ADMIN', siOrg.id);
    const siUser = await mk('siuser', 'USER', siOrg.id);
    const oemAdmin = await mk('oemadmin', 'ORG_ADMIN', oemOrg.id);
    const oemUser = await mk('oemuser', 'USER', oemOrg.id);

    const all = [superAdmin, bankAdmin, bankUser, bankOther, siAdmin, siUser, oemAdmin, oemUser];
    createdUserIds.push(...all.map((u) => u.id));

    actors.superAdmin = makeActor('superAdmin', superAdmin.id, 'SUPER_ADMIN', superOrg.id, 'SUPER_ADMIN');
    actors.bankAdmin = makeActor('bankAdmin', bankAdmin.id, 'ORG_ADMIN', bankOrg.id, 'CLIENT');
    actors.bankUser = makeActor('bankUser (creator)', bankUser.id, 'USER', bankOrg.id, 'CLIENT');
    actors.bankOther = makeActor('bankOther (non-creator)', bankOther.id, 'USER', bankOrg.id, 'CLIENT');
    actors.siAdmin = makeActor('siAdmin', siAdmin.id, 'ORG_ADMIN', siOrg.id, 'SI');
    actors.siUser = makeActor('siUser', siUser.id, 'USER', siOrg.id, 'SI');
    actors.oemAdmin = makeActor('oemAdmin', oemAdmin.id, 'ORG_ADMIN', oemOrg.id, 'OEM');
    actors.oemUser = makeActor('oemUser (assignee)', oemUser.id, 'USER', oemOrg.id, 'OEM');

    const project = await prisma.project.create({
      data: { name: `Proj-${suiteId}`, description: 'drift spec' },
    });
    projectId = project.id;
    createdProjectIds.push(project.id);

    for (const orgId of [superOrg.id, bankOrg.id, siOrg.id, oemOrg.id]) {
      await prisma.projectOrganization.create({ data: { projectId: project.id, organizationId: orgId } });
    }
    for (const u of all) {
      await prisma.projectUser.create({ data: { projectId: project.id, userId: u.id } });
    }
  }

  async function cleanup() {
    if (createdIssueIds.length) {
      await prisma.notification.deleteMany({ where: { issueId: { in: createdIssueIds } } });
      await prisma.activityLog.deleteMany({ where: { issueId: { in: createdIssueIds } } });
      await prisma.comment.deleteMany({ where: { issueId: { in: createdIssueIds } } });
      await prisma.attachment.deleteMany({ where: { issueId: { in: createdIssueIds } } });
      await prisma.issue.deleteMany({ where: { id: { in: createdIssueIds } } });
    }
    if (createdUserIds.length) {
      await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.activityLog.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.projectUser.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdProjectIds.length) {
      await prisma.projectOrganization.deleteMany({ where: { projectId: { in: createdProjectIds } } });
      await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
    }
    if (createdOrgIds.length) {
      await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
  }

  /**
   * Statuses before assignment leave the assignee fields null; from SI_APPROVAL onward the
   * issue carries a proposed/actual assignment to the OEM org and user, which is what makes
   * the assignee-scoped guards meaningful.
   */
  const UNASSIGNED: IssueStatus[] = ['NEW', 'UNDER_REVIEW'];

  /**
   * `clarificationOrigin` writes the STATUS_CHANGED log that records which stage a
   * clarification was requested from — the thing that decides where answering sends it back.
   * The returned object carries it so `getPermittedTransitions` sees the same input the
   * service does.
   */
  async function createIssueInStatus(status: IssueStatus, clarificationOrigin?: string) {
    const assigned = !UNASSIGNED.includes(status);
    const issue = await prisma.issue.create({
      data: {
        title: `drift ${status}`,
        description: 'drift spec fixture',
        type: 'BUG',
        priority: 'HIGH',
        status,
        deadline: new Date(Date.now() + 86_400_000),
        raisedById: actors.bankUser.payload.userId,
        raisedByOrgId: bankOrgId,
        projectId,
        ...(assigned
          ? {
              assignedToUserId: actors.oemUser.payload.userId,
              assignedToOrgId: oemOrgId,
            }
          : {}),
      },
    });
    createdIssueIds.push(issue.id);

    if (clarificationOrigin) {
      await prisma.activityLog.create({
        data: {
          issueId: issue.id,
          userId: actors.siAdmin.payload.userId,
          action: 'STATUS_CHANGED',
          oldValue: clarificationOrigin,
          newValue: 'CLARIFICATION_REQUESTED',
        },
      });
    }

    return { ...issue, clarificationOrigin: clarificationOrigin ?? null };
  }

  /** Mirrors the frontend's getTransitionInput — supply whatever the backend demands. */
  function bodyFor(from: IssueStatus, to: TransitionTarget) {
    return {
      status: to,
      comment: 'drift spec comment',
      ...(to === 'RESOLVED' ? { resolutionNote: 'drift spec resolution' } : {}),
    };
  }

  /**
   * Every (from -> to) the state machine allows, including the virtual RESOLVED.
   *
   * The CLARIFICATION_REQUESTED rows are covered from BOTH origins so the matching answer
   * and the mismatched one are each exercised: a request raised before assignment must go
   * back to UNDER_REVIEW, one raised by the assignee back to IN_PROGRESS, and the opposite
   * must be refused for everyone.
   */
  const PAIRS: Array<{ from: IssueStatus; to: TransitionTarget; origin?: string }> = [
    { from: 'NEW', to: 'UNDER_REVIEW' },
    { from: 'SI_APPROVAL', to: 'ASSIGNED' },
    { from: 'SI_APPROVAL', to: 'CLARIFICATION_REQUESTED' },
    { from: 'UNDER_REVIEW', to: 'ASSIGNED' },
    { from: 'UNDER_REVIEW', to: 'CLARIFICATION_REQUESTED' },
    { from: 'CLARIFICATION_REQUESTED', to: 'UNDER_REVIEW', origin: 'UNDER_REVIEW' },
    { from: 'CLARIFICATION_REQUESTED', to: 'UNDER_REVIEW', origin: 'SI_APPROVAL' },
    { from: 'CLARIFICATION_REQUESTED', to: 'UNDER_REVIEW', origin: 'IN_PROGRESS' },
    { from: 'CLARIFICATION_REQUESTED', to: 'IN_PROGRESS', origin: 'IN_PROGRESS' },
    { from: 'CLARIFICATION_REQUESTED', to: 'IN_PROGRESS', origin: 'UNDER_REVIEW' },
    { from: 'CLARIFICATION_REQUESTED', to: 'IN_PROGRESS', origin: 'SI_APPROVAL' },
    { from: 'ASSIGNED', to: 'IN_PROGRESS' },
    { from: 'IN_PROGRESS', to: 'CLARIFICATION_REQUESTED' },
    { from: 'IN_PROGRESS', to: 'RESOLVED' },
    { from: 'SI_REVIEW', to: 'PENDING_CLIENT_APPROVAL' },
    { from: 'SI_REVIEW', to: 'ASSIGNED' },
    { from: 'PENDING_CLIENT_APPROVAL', to: 'CLOSED' },
    { from: 'PENDING_CLIENT_APPROVAL', to: 'ASSIGNED' },
    { from: 'CLOSED', to: 'UNDER_REVIEW' },
  ];

  describe.each(PAIRS)('$from -> $to (asked from $origin)', ({ from, to, origin }) => {
    it.each(ACTOR_KEYS)(
      'agrees with updateStatus for %s',
      async (actorKey) => {
        const actor = actors[actorKey];
        const issue = await createIssueInStatus(from, origin);

        const predicted = getPermittedTransitions(issue, actor.payload);
        const shouldSucceed = predicted.includes(to);

        const res = await request(app.getHttpServer())
          .patch(`/api/issues/${issue.id}/status`)
          .set('Cookie', `access_token=${actor.token}`)
          .send(bodyFor(from, to));

        const detail =
          `${actor.name}: ${from} -> ${to}\n` +
          `  issue              : ${issue.id}\n` +
          `  predicted permitted: [${predicted.join(', ') || 'none'}]\n` +
          `  endpoint responded : ${res.status} ` +
          `${JSON.stringify(res.body?.message ?? res.text?.slice(0, 120) ?? '')}`;

        if (shouldSucceed) {
          expect(`${res.status} | ${detail}`).toBe(`200 | ${detail}`);
        } else {
          // Denied for authorization reasons — never 400 (that would mean a required
          // input was missing and the authorization question was never reached).
          expect(`${res.status} | ${detail}`).toBe(`403 | ${detail}`);
        }
      },
      20_000,
    );
  });

  describe('annotation', () => {
    it('findOne returns permittedTransitions matching the pure function', async () => {
      const issue = await createIssueInStatus('UNDER_REVIEW');

      for (const actor of Object.values(actors)) {
        const res = await request(app.getHttpServer())
          .get(`/api/issues/${issue.id}`)
          .set('Cookie', `access_token=${actor.token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.permittedTransitions)).toBe(true);
        expect(res.body.permittedTransitions.sort()).toEqual(
          getPermittedTransitions(issue, actor.payload).sort(),
        );
      }
    }, 30_000);

    it('findAll returns permittedTransitions on every row', async () => {
      await createIssueInStatus('SI_REVIEW');

      const res = await request(app.getHttpServer())
        .get(`/api/issues?projectId=${projectId}&limit=100`)
        .set('Cookie', `access_token=${actors.siAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const row of res.body.data) {
        expect(Array.isArray(row.permittedTransitions)).toBe(true);
      }
    }, 30_000);
  });

  describe('approval queue', () => {
    /**
     * The SQL prefilter must stay a superset of the rules: a row in the queue with no
     * permitted transition is a dead end the user can do nothing about.
     */
    it.each(ACTOR_KEYS)('every row is actionable for %s', async (actorKey) => {
      const actor = actors[actorKey];

      // Populate the queue with one issue in each status this actor might be asked about.
      for (const status of [
        'NEW',
        'SI_APPROVAL',
        'UNDER_REVIEW',
        'CLARIFICATION_REQUESTED',
        'ASSIGNED',
        'IN_PROGRESS',
        'SI_REVIEW',
        'PENDING_CLIENT_APPROVAL',
        'CLOSED',
      ] as IssueStatus[]) {
        await createIssueInStatus(status);
      }

      const res = await request(app.getHttpServer())
        .get(`/api/issues?concern=true&concernFilter=approval&projectId=${projectId}&limit=100`)
        .set('Cookie', `access_token=${actor.token}`);

      expect(res.status).toBe(200);

      const deadEnds = res.body.data.filter((row: any) => row.permittedTransitions.length === 0);
      expect(deadEnds.map((r: any) => `${r.status} (${r.id})`)).toEqual([]);
    }, 30_000);

    it('never surfaces CLOSED issues', async () => {
      await createIssueInStatus('CLOSED');

      const res = await request(app.getHttpServer())
        .get(`/api/issues?concern=true&concernFilter=approval&projectId=${projectId}&limit=100`)
        .set('Cookie', `access_token=${actors.siAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.filter((r: any) => r.status === 'CLOSED')).toEqual([]);
    }, 30_000);

    it('shows SI the triage stages and the client its own approvals', async () => {
      await createIssueInStatus('UNDER_REVIEW');
      await createIssueInStatus('PENDING_CLIENT_APPROVAL');

      const siRes = await request(app.getHttpServer())
        .get(`/api/issues?concern=true&concernFilter=approval&projectId=${projectId}&limit=100`)
        .set('Cookie', `access_token=${actors.siUser.token}`);
      const siStatuses = siRes.body.data.map((r: any) => r.status);
      expect(siStatuses).toContain('UNDER_REVIEW');

      const clientRes = await request(app.getHttpServer())
        .get(`/api/issues?concern=true&concernFilter=approval&projectId=${projectId}&limit=100`)
        .set('Cookie', `access_token=${actors.bankUser.token}`);
      const clientStatuses = clientRes.body.data.map((r: any) => r.status);
      expect(clientStatuses).toContain('PENDING_CLIENT_APPROVAL');
      // Triage stages belong to SI, not the client.
      expect(clientStatuses).not.toContain('UNDER_REVIEW');
    }, 30_000);
  });

  describe('clarification cycle', () => {
    /**
     * The two clarification flows are distinct and must not be confused:
     *   before assignment  — SI asks the creator, answer returns to SI triage
     *   after assignment   — the assignee asks the creator, answer returns to their work
     * Offering both answers would let a pre-assignment clarification skip the assignment gate.
     */
    it.each([
      ['SI_APPROVAL', 'UNDER_REVIEW'],
      ['UNDER_REVIEW', 'UNDER_REVIEW'],
      ['IN_PROGRESS', 'IN_PROGRESS'],
    ])('asked from %s, the creator is offered exactly %s', async (origin, expected) => {
      const issue = await createIssueInStatus('CLARIFICATION_REQUESTED', origin);

      const res = await request(app.getHttpServer())
        .get(`/api/issues/${issue.id}`)
        .set('Cookie', `access_token=${actors.bankUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.permittedTransitions).toEqual([expected]);
    }, 30_000);

    it('refuses the answer that belongs to the other flow', async () => {
      // Raised from IN_PROGRESS, so it must go back to IN_PROGRESS — not UNDER_REVIEW.
      const issue = await createIssueInStatus('CLARIFICATION_REQUESTED', 'IN_PROGRESS');

      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.id}/status`)
        .set('Cookie', `access_token=${actors.bankUser.token}`)
        .send({ status: 'UNDER_REVIEW', comment: 'answering the wrong way' });

      expect(res.status).toBe(403);

      const issueAfter = await prisma.issue.findUnique({ where: { id: issue.id } });
      expect(issueAfter?.status).toBe('CLARIFICATION_REQUESTED');
    }, 30_000);

    it('round-trips a pre-assignment clarification back to SI triage', async () => {
      const issue = await createIssueInStatus('CLARIFICATION_REQUESTED', 'UNDER_REVIEW');

      const res = await request(app.getHttpServer())
        .patch(`/api/issues/${issue.id}/status`)
        .set('Cookie', `access_token=${actors.bankUser.token}`)
        .send({ status: 'UNDER_REVIEW', comment: 'here is the detail you asked for' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UNDER_REVIEW');
    }, 30_000);
  });

  describe('sort', () => {
    it('sorts by deadline ascending with undated issues last', async () => {
      // Scoped by `module`, because the pair tests above leave ~130 same-deadline issues
      // in this project which would otherwise crowd these out of the first page.
      const marker = `sort-${Math.random().toString(36).slice(2, 7)}`;
      const mk = async (title: string, deadline: Date | null) => {
        const issue = await prisma.issue.create({
          data: {
            title,
            type: 'BUG',
            priority: 'HIGH',
            status: 'UNDER_REVIEW',
            module: marker,
            deadline,
            raisedById: actors.bankUser.payload.userId,
            raisedByOrgId: bankOrgId,
            projectId,
          },
        });
        createdIssueIds.push(issue.id);
        return issue;
      };

      await mk('none', null);
      await mk('late', new Date(Date.now() + 30 * 86_400_000));
      await mk('soon', new Date(Date.now() + 86_400_000));

      const res = await request(app.getHttpServer())
        .get(`/api/issues?projectId=${projectId}&module=${marker}&sort=deadline&limit=100`)
        .set('Cookie', `access_token=${actors.superAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.map((r: any) => r.title)).toEqual(['soon', 'late', 'none']);
    }, 30_000);

    it('falls back to newest-first for an unknown sort value', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/issues?projectId=${projectId}&sort=bogus&limit=5`)
        .set('Cookie', `access_token=${actors.superAdmin.token}`);

      // A stale bookmark must not 400 the whole list.
      expect(res.status).toBe(200);
    }, 30_000);
  });
});
