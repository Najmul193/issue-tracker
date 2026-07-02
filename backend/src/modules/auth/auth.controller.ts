import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { RolesGuard } from './guards/roles.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, payload } = await this.authService.login(
      dto.email,
      dto.password,
    );

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { message: 'Login successful' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
    return { message: 'Logged out' };
  }

  @Get('me')
  async getProfile(@CurrentUser() user: JwtPayload) {
    const profile = await this.usersService.findById(user.userId);
    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      status: profile.status,
      organizationId: profile.organizationId,
      organization: {
        id: profile.organization.id,
        name: profile.organization.name,
        type: profile.organization.type,
      },
    };
  }
}
