import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(
    @Body() dto: { name: string; email: string; password: string; phone?: string; role: string; organizationId: string },
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.create(dto, actor);
  }

  @Get()
  findAll(@CurrentUser() actor: JwtPayload) {
    return this.usersService.findAll(actor);
  }

  @Get('assignable')
  findAssignable(@CurrentUser() actor: JwtPayload) {
    return this.usersService.findAssignable(actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: { name?: string; phone?: string; status?: string },
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.update(id, dto, actor);
  }
}