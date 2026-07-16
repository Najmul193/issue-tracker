import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationsService } from '../organizations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../auth/decorators/current-user.decorator';

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  const superAdmin: JwtPayload = {
    userId: 'sa-1',
    role: 'SUPER_ADMIN',
    organizationId: 'org-sa',
    organizationType: 'SUPER_ADMIN',
  };

  const orgAdmin: JwtPayload = {
    userId: 'admin-1',
    role: 'ORG_ADMIN',
    organizationId: 'org-bank',
    organizationType: 'BANK',
  };

  const mockPrisma = {
    organization: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    projectOrganization: { deleteMany: jest.fn() },
    projectUser: { deleteMany: jest.fn() },
    issue: {
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
    notification: { deleteMany: jest.fn() },
    activityLog: { deleteMany: jest.fn() },
    comment: { deleteMany: jest.fn() },
    attachment: { deleteMany: jest.fn() },
    issueAssignee: { deleteMany: jest.fn() },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns organizations with non-deleted users', async () => {
      const orgs = [{ id: 'org-1', name: 'Bank', type: 'BANK' }];
      mockPrisma.organization.findMany.mockResolvedValue(orgs);

      const result = await service.findAll();
      expect(result).toEqual(orgs);
      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith({
        where: { users: { some: { email: { not: { startsWith: 'deleted-' } } } } },
        select: { id: true, name: true, type: true },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findDeleted', () => {
    it('returns organizations where all users are deleted', async () => {
      const orgs = [{ id: 'org-2', name: 'Old Org', type: 'SI', _count: { users: 2 } }];
      mockPrisma.organization.findMany.mockResolvedValue(orgs);

      const result = await service.findDeleted();
      expect(result).toEqual(orgs);
    });
  });

  describe('remove', () => {
    it('SUPER_ADMIN can soft-delete an organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org-1', name: 'Test', type: 'BANK' });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);

      const result = await service.remove('org-1', superAdmin);
      expect(result.message).toContain('deleted successfully');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('throws ForbiddenException for non-SUPER_ADMIN', async () => {
      await expect(service.remove('org-1', orgAdmin)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for non-existent org', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      await expect(service.remove('nonexistent', superAdmin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('permanentRemove', () => {
    it('SUPER_ADMIN can permanently delete an organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org-1', name: 'Test', type: 'BANK' });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);

      const result = await service.permanentRemove('org-1', superAdmin);
      expect(result.message).toContain('permanently deleted');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('throws ForbiddenException for non-SUPER_ADMIN', async () => {
      await expect(service.permanentRemove('org-1', orgAdmin)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for non-existent org', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      await expect(service.permanentRemove('nonexistent', superAdmin)).rejects.toThrow(NotFoundException);
    });
  });
});
