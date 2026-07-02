import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canAssign', () => {
    // SUPER_ADMIN: can assign to any user in any org
    it('SUPER_ADMIN can assign to any user in any org', () => {
      expect(() =>
        service.canAssign(superAdmin, 'some-user', 'some-org'),
      ).not.toThrow();
    });

    it('SUPER_ADMIN can assign without target', () => {
      expect(() => service.canAssign(superAdmin, null, null)).not.toThrow();
    });

    // ORG_ADMIN: can assign to any user within their OWN org
    it('ORG_ADMIN can assign to a user within their own org', () => {
      expect(() =>
        service.canAssign(orgAdmin, 'user-in-bank', 'org-bank'),
      ).not.toThrow();
    });

    it('ORG_ADMIN cannot assign to a user in a different org', () => {
      expect(() =>
        service.canAssign(orgAdmin, 'user-in-oracle', 'org-oracle'),
      ).toThrow(ForbiddenException);
    });

    it('ORG_ADMIN can assign org-level handoff (targetOrgId only, no userId)', () => {
      expect(() =>
        service.canAssign(orgAdmin, null, 'org-oracle'),
      ).not.toThrow();
    });

    it('ORG_ADMIN can assign with only userId (no org change)', () => {
      expect(() =>
        service.canAssign(orgAdmin, 'user-in-bank', null),
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

    it('ORG_ADMIN sees raised or assigned to their org', () => {
      const filter = service.getVisibleIssuesFilter(orgAdmin);
      expect(filter).toEqual({
        OR: [
          { raisedByOrgId: 'org-bank' },
          { assignedToOrgId: 'org-bank' },
        ],
      });
    });

    it('USER sees assigned to them, org-assigned-without-user, or raised by them', () => {
      const filter = service.getVisibleIssuesFilter(regularUser);
      expect(filter).toEqual({
        OR: [
          { assignedToUserId: 'user-1' },
          { assignedToOrgId: 'org-bank', assignedToUserId: null },
          { raisedById: 'user-1' },
        ],
      });
    });
  });
});
