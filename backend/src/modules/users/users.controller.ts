import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
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
    @Body() dto: { name: string; email: string; password: string; phone?: string; role: string; organizationId?: string; newOrganizationName?: string; newOrganizationType?: string },
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.create(dto, actor);
  }

  @Get()
  findAll(@CurrentUser() actor: JwtPayload) {
    return this.usersService.findAll(actor);
  }

  @Get('deleted')
  findDeleted(@CurrentUser() actor: JwtPayload) {
    if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenException('SUPER_ADMIN only');
    return this.usersService.findDeleted();
  }

  @Get('assignable')
  findAssignable(
    @CurrentUser() actor: JwtPayload,
    @Query('issueId') issueId?: string,
  ) {
    return this.usersService.findAssignable(actor, issueId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: { name?: string; phone?: string; status?: string },
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.update(id, dto, actor);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.remove(id, actor);
  }

  @Delete(':id/permanent')
  permanentRemove(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenException('SUPER_ADMIN only');
    return this.usersService.permanentRemove(id, actor);
  }
}