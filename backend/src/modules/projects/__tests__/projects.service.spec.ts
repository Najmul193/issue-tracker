import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ProjectsService } from '../projects.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../auth/decorators/current-user.decorator';

describe('ProjectsService', () => {
  let service: ProjectsService;

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
    organizationType: 'CLIENT',
  };

  const user: JwtPayload = {
    userId: 'user-1',
    role: 'USER',
    organizationId: 'org-bank',
    organizationType: 'CLIENT',
  };

  const mockPrisma = {
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    organization: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    projectOrganization: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    projectUser: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    issue: {
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('SUPER_ADMIN can create project with BANK+SI+OEM', async () => {
      mockPrisma.organization.findMany.mockResolvedValue([
        { id: 'org-b', type: 'CLIENT' },
        { id: 'org-s', type: 'SI' },
        { id: 'org-o', type: 'OEM' },
      ]);
      mockPrisma.project.findUnique.mockResolvedValue(null);
      mockPrisma.project.create.mockResolvedValue({
        id: 'proj-1',
        name: 'Test',
        organizations: [],
      });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
      mockPrisma.projectUser.createMany.mockResolvedValue({ count: 1 });

      const result = await service.create(
        { name: 'Test', organizationIds: ['org-b', 'org-s', 'org-o'] },
        superAdmin,
      );
      expect(result.id).toBe('proj-1');
      expect(mockPrisma.projectUser.createMany).toHaveBeenCalled();
    });

    it('throws ForbiddenException for non-SUPER_ADMIN', async () => {
      await expect(service.create({ name: 'Test', organizationIds: [] }, orgAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException if missing BANK org', async () => {
      mockPrisma.organization.findMany.mockResolvedValue([
        { id: 'org-s', type: 'SI' },
        { id: 'org-o', type: 'OEM' },
      ]);

      await expect(
        service.create({ name: 'Test', organizationIds: ['org-s', 'org-o'] }, superAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException for duplicate name', async () => {
      mockPrisma.organization.findMany.mockResolvedValue([
        { id: 'org-b', type: 'CLIENT' },
        { id: 'org-s', type: 'SI' },
        { id: 'org-o', type: 'OEM' },
      ]);
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'existing', name: 'Test' });

      await expect(
        service.create({ name: 'Test', organizationIds: ['org-b', 'org-s', 'org-o'] }, superAdmin),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('SUPER_ADMIN sees all projects', async () => {
      mockPrisma.project.findMany.mockResolvedValue([{ id: 'p1' }]);
      const result = await service.findAll(superAdmin);
      expect(result).toHaveLength(1);
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('ORG_ADMIN sees projects where their org is member', async () => {
      mockPrisma.project.findMany.mockResolvedValue([{ id: 'p2' }]);
      const result = await service.findAll(orgAdmin);
      expect(result).toHaveLength(1);
    });

    it('USER sees projects they are member of', async () => {
      mockPrisma.project.findMany.mockResolvedValue([{ id: 'p3' }]);
      const result = await service.findAll(user);
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns project for member', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'p1', name: 'Test' });
      mockPrisma.projectOrganization.findUnique.mockResolvedValue({ id: 'po-1' });
      mockPrisma.projectUser.findUnique.mockResolvedValue({ id: 'pu-1' });

      const result = await service.findOne('p1', user);
      expect(result.id).toBe('p1');
    });

    it('throws NotFoundException for non-existent project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', superAdmin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('SUPER_ADMIN can update project', async () => {
      mockPrisma.project.findUnique
        .mockResolvedValueOnce({ id: 'p1', name: 'Old' })
        .mockResolvedValueOnce(null);
      mockPrisma.project.update.mockResolvedValue({ id: 'p1', name: 'New' });

      const result = await service.update('p1', { name: 'New' }, superAdmin);
      expect(result.name).toBe('New');
    });

    it('throws ForbiddenException for non-SUPER_ADMIN', async () => {
      await expect(service.update('p1', { name: 'New' }, orgAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('SUPER_ADMIN can delete project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'p1' });
      mockPrisma.issue.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.project.delete.mockResolvedValue({});

      const result = await service.remove('p1', superAdmin);
      expect(result.message).toContain('deleted');
      expect(mockPrisma.issue.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'p1' },
          data: { projectId: null, assignedToUserId: null, assignedToOrgId: null },
        }),
      );
    });

    it('throws ForbiddenException for non-SUPER_ADMIN', async () => {
      await expect(service.remove('p1', orgAdmin)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addOrganization', () => {
    it('SUPER_ADMIN can add org to project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'p1' });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-new',
        name: 'New Org',
        type: 'SI',
      });
      mockPrisma.projectOrganization.findUnique.mockResolvedValue(null);
      mockPrisma.projectOrganization.create.mockResolvedValue({ id: 'po-1' });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
      mockPrisma.projectUser.createMany.mockResolvedValue({ count: 1 });

      const result = await service.addOrganization('p1', 'org-new', superAdmin);
      expect(result).toBeDefined();
      expect(mockPrisma.projectUser.createMany).toHaveBeenCalled();
    });

    it('throws ConflictException if org already in project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'p1' });
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org-existing' });
      mockPrisma.projectOrganization.findUnique.mockResolvedValue({ id: 'po-1' });

      await expect(service.addOrganization('p1', 'org-existing', superAdmin)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('removeOrganization', () => {
    it('SUPER_ADMIN can remove org from project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'p1' });
      mockPrisma.projectOrganization.findUnique.mockResolvedValue({ id: 'po-1' });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
      mockPrisma.projectUser.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.projectOrganization.delete.mockResolvedValue({});
      mockPrisma.issue.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.removeOrganization('p1', 'org-1', superAdmin);
      expect(result).toBeDefined();
    });

    it('throws NotFoundException if org not in project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'p1' });
      mockPrisma.projectOrganization.findUnique.mockResolvedValue(null);

      await expect(service.removeOrganization('p1', 'org-x', superAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
