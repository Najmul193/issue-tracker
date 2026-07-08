import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../notifications/email.service';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canAssign', () => {
    // SUPER_ADMIN: cannot assign issues
    it('SUPER_ADMIN cannot assign to any user in any org', () => {
      expect(() =>
        service.canAssign(superAdmin, 'some-user', 'some-org'),
      ).toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN cannot assign without target', () => {
      expect(() => service.canAssign(superAdmin, null, null)).toThrow(ForbiddenException);
    });

    // ORG_ADMIN: can assign to an external org when issue is not currently assigned to their org
    it('ORG_ADMIN cannot assign to a user within their own org if unassigned/raised by them', () => {
      // The issue is raised by org-bank and unassigned, so they can only route it outside
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

    // USER: cannot assign at all
    it('USER cannot assign issues', () => {
      expect(() => service.canAssign(regularUser, null, null)).toThrow(
        ForbiddenException,
      );
    });

    it('USER cannot assign issues even with valid targets', () => {
      expect(() =>
        service.canAssign(regularUser, 'some-user', 'some-org'),
      ).toThrow(ForbiddenException);
    });
  });

  describe('getVisibleIssuesFilter', () => {
    it('SUPER_ADMIN sees everything', () => {
      const filter = service.getVisibleIssuesFilter(superAdmin);
      expect(filter).toEqual({});
    });

    it('ORG_ADMIN sees everything (Part A: open visibility)', () => {
      const filter = service.getVisibleIssuesFilter(orgAdmin);
      expect(filter).toEqual({});
    });

    it('USER sees everything (Part A: open visibility)', () => {
      const filter = service.getVisibleIssuesFilter(regularUser);
      expect(filter).toEqual({});
    });
  });

  describe('canActOnIssue', () => {
    const bankIssue = {
      raisedByOrgId: 'org-bank',
      assignedToOrgId: null,
      assignedToUserId: null,
    };
    // Unrelated issue: raised by org-si, assigned to org-si — no connection to org-bank
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

    it('SUPER_ADMIN can act on any issue', () => {
      expect(service.canActOnIssue(superAdmin, bankIssue)).toBe(true);
    });

    it('ORG_ADMIN can act on their own org issue', () => {
      expect(service.canActOnIssue(orgAdmin, bankIssue)).toBe(true);
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
  });
});