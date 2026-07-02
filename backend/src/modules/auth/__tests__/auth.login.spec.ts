import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service';

jest.mock('bcryptjs');

describe('AuthService — login', () => {
  let service: AuthService;

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashedpassword',
    phone: null,
    organizationId: 'org-1',
    role: 'ORG_ADMIN',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    organization: { id: 'org-1', name: 'Test Org', type: 'BANK' },
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(() => 'generated-jwt-token'),
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
    jest.clearAllMocks();
  });

  it('should return token on valid credentials', async () => {
    mockUsersService.findByEmail.mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login('test@example.com', 'password123');

    expect(result.accessToken).toBe('generated-jwt-token');
    expect(result.payload).toEqual({
      userId: 'user-1',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
      organizationType: 'BANK',
    });
    expect(mockJwtService.sign).toHaveBeenCalledWith({
      userId: 'user-1',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
      organizationType: 'BANK',
    });
  });

  it('should throw on non-existent email', async () => {
    mockUsersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.login('nonexistent@example.com', 'password123'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw on wrong password', async () => {
    mockUsersService.findByEmail.mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login('test@example.com', 'wrongpassword'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
