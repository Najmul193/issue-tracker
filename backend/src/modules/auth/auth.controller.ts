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

    const isProduction = process.env.NODE_ENV === 'production';
    const maxAge = parseInt(process.env.JWT_COOKIE_MAX_AGE || '86400000', 10);
    const sameSite = isProduction ? 'none' as const : 'lax' as const;
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      path: '/',
      maxAge,
    });

    return { message: 'Login successful', token: accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    const isProduction = process.env.NODE_ENV === 'production';
    const sameSite = isProduction ? 'none' as const : 'lax' as const;
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      path: '/',
    });
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
