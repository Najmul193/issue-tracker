import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../notifications/email.service';
import { ProjectsService } from '../../projects/projects.service';
import { JwtPayload } from '../decorators/current-user.decorator';

describe('AuthService', () => {
  let service: AuthService;

  const superAdmin: JwtPayload = {
    userId: 'super-1',
    role: 'SUPER_ADMIN',
    organizationId: 'org-super',
    organizationType: 'SUPER_ADMIN',
  };

  const orgAdmin: JwtPayload = {
    userId: 'admin-1',
    role: 'ORG_ADMIN',
    organizationId: 'org-bank',
    organizationType: 'BANK',
  };

  const siOrgAdmin: JwtPayload = {
    userId: 'si-admin-1',
    role: 'ORG_ADMIN',
    organizationId: 'org-si',
    organizationType: 'SI',
  };

  const regularUser: JwtPayload = {
    userId: 'user-1',
    role: 'USER',
    organizationId: 'org-bank',
    organizationType: 'BANK',
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(() => 'mock-token'),
  };

  const mockPrismaService = {};
  const mockEmailService = {};

  const mockProjectsService = {
    getVisibleProjectFilter: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ProjectsService, useValue: mockProjectsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canAssign', () => {
    it('SUPER_ADMIN cannot assign to any user in any org', () => {
      expect(() =>
        service.canAssign(superAdmin, 'some-user', 'some-org'),
      ).toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN cannot assign without target', () => {
      expect(() => service.canAssign(superAdmin, null, null)).toThrow(ForbiddenException);
    });

    it('ORG_ADMIN cannot assign to a user within their own org if unassigned/raised by them', () => {
      expect(() =>
        service.canAssign(orgAdmin, 'user-in-bank', 'org-bank', 'org-bank', 'USER', false, null, 'org-bank'),
      ).toThrow(ForbiddenException);
    });

    it('ORG_ADMIN can route to a user in a different org', () => {
      expect(() =>
        service.canAssign(orgAdmin, 'user-in-si', 'org-si', 'org-si', 'USER', false, null, 'org-bank', 'SI', 'SI'),
      ).not.toThrow();
    });

    it('ORG_ADMIN can assign org-level handoff (targetOrgId only) to different org', () => {
      expect(() =>
        service.canAssign(orgAdmin, null, 'org-si', undefined, undefined, false, null, 'org-bank', undefined, 'SI'),
      ).not.toThrow();
    });

    it('ORG_ADMIN can assign internally when issue is already in their org', () => {
      expect(() =>
        service.canAssign(orgAdmin, 'user-in-bank', 'org-bank', 'org-bank', 'USER', false, 'org-bank', 'org-si'),
      ).not.toThrow();
    });

    it('ORG_ADMIN cannot route externally when issue is in their org queue', () => {
      expect(() =>
        service.canAssign(orgAdmin, null, 'org-si', undefined, undefined, false, 'org-bank', 'org-si', undefined, 'SI'),
      ).toThrow(ForbiddenException);
    });

    it('USER who is current assignee can reroute to ORG_ADMIN in own org', () => {
      expect(() =>
        service.canAssign(regularUser, 'admin-1', 'org-bank', 'org-bank', 'ORG_ADMIN', true, 'org-bank', 'org-si'),
      ).not.toThrow();
    });

    it('USER who is current assignee cannot reroute to non-admin', () => {
      expect(() =>
        service.canAssign(regularUser, 'other-user', 'org-bank', 'org-bank', 'USER', true, 'org-bank', 'org-si'),
      ).toThrow(ForbiddenException);
    });

    it('USER who is current assignee cannot reroute to different org', () => {
      expect(() =>
        service.canAssign(regularUser, 'si-user', 'org-si', 'org-si', 'ORG_ADMIN', true, 'org-bank', 'org-si'),
      ).toThrow(ForbiddenException);
    });

    it('USER from raiser org can reroute to a different org', () => {
      expect(() =>
        service.canAssign(regularUser, null, 'org-si', undefined, undefined, false, null, 'org-bank', undefined, 'SI'),
      ).not.toThrow();
    });

    it('USER not from raiser org and not assignee cannot reroute', () => {
      expect(() =>
        service.canAssign(regularUser, null, 'org-si', undefined, undefined, false, null, 'org-oem', undefined, 'SI'),
      ).toThrow(ForbiddenException);
    });

    it('cannot assign to a SUPER_ADMIN user', () => {
      expect(() =>
        service.canAssign(orgAdmin, 'sa-user', 'org-super', 'org-super', 'SUPER_ADMIN', false, null, 'org-bank'),
      ).toThrow(ForbiddenException);
    });
  });

  describe('getVisibleIssuesFilter', () => {
    it('delegates to projectsService.getVisibleProjectFilter', async () => {
      const mockFilter = { project: { id: { in: ['proj-1'] } } };
      mockProjectsService.getVisibleProjectFilter.mockResolvedValue(mockFilter);

      const filter = await service.getVisibleIssuesFilter(superAdmin);
      expect(filter).toEqual(mockFilter);
      expect(mockProjectsService.getVisibleProjectFilter).toHaveBeenCalledWith(superAdmin);
    });

    it('SUPER_ADMIN sees everything (empty filter)', async () => {
      mockProjectsService.getVisibleProjectFilter.mockResolvedValue({});
      const filter = await service.getVisibleIssuesFilter(superAdmin);
      expect(filter).toEqual({});
    });

    it('returns whatever projectsService resolves', async () => {
      const projectFilter = { project: { projectUser: { some: { userId: 'user-1' } } } };
      mockProjectsService.getVisibleProjectFilter.mockResolvedValue(projectFilter);

      const filter = await service.getVisibleIssuesFilter(regularUser);
      expect(filter).toEqual(projectFilter);
    });
  });

  describe('canActOnIssue', () => {
    const bankIssue = {
      raisedByOrgId: 'org-bank',
      assignedToOrgId: null,
      assignedToUserId: null,
    };

    const unrelatedIssue = {
      raisedByOrgId: 'org-si',
      assignedToOrgId: 'org-si',
      assignedToUserId: null,
    };

    const userAssignedIssue = {
      raisedByOrgId: 'org-bank',
      assignedToOrgId: 'org-si',
      assignedToUserId: 'user-1',
    };

    const orgAdminAssignedIssue = {
      raisedByOrgId: 'org-si',
      assignedToOrgId: 'org-bank',
      assignedToUserId: 'admin-1',
    };

    it('SUPER_ADMIN can act on any issue', () => {
      expect(service.canActOnIssue(superAdmin, bankIssue)).toBe(true);
    });

    it('SUPER_ADMIN can act on unrelated issue', () => {
      expect(service.canActOnIssue(superAdmin, unrelatedIssue)).toBe(true);
    });

    it('ORG_ADMIN can act on their own org issue (as raiser)', () => {
      expect(service.canActOnIssue(orgAdmin, bankIssue)).toBe(true);
    });

    it('ORG_ADMIN can act on issue assigned to their org', () => {
      expect(service.canActOnIssue(orgAdmin, orgAdminAssignedIssue)).toBe(true);
    });

    it('ORG_ADMIN cannot act on an unrelated org issue', () => {
      expect(service.canActOnIssue(orgAdmin, unrelatedIssue)).toBe(false);
    });

    it('USER can act on their own assigned issue', () => {
      expect(service.canActOnIssue(regularUser, userAssignedIssue)).toBe(true);
    });

    it('USER cannot act on an unrelated issue', () => {
      expect(service.canActOnIssue(regularUser, unrelatedIssue)).toBe(false);
    });

    it('USER from assigned org can act on issue assigned to their org', () => {
      const userInSiOrg: JwtPayload = { ...regularUser, userId: 'si-user-1', organizationId: 'org-si', organizationType: 'SI' };
      expect(service.canActOnIssue(userInSiOrg, userAssignedIssue)).toBe(true);
    });
  });
});
