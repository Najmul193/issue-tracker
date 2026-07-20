import { Controller, Get, Post, Delete, Param, Body, Query, ForbiddenException } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { AddManagerDto } from './dto/add-manager.dto';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll(
    @CurrentUser() actor: JwtPayload,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.departmentsService.findAll(actor, organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.departmentsService.findOne(id, actor);
  }

  @Post()
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() actor: JwtPayload) {
    return this.departmentsService.create(dto, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.departmentsService.remove(id, actor);
  }

  @Get(':id/managers')
  getManagers(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.departmentsService.getManagers(id, actor);
  }

  @Post(':id/managers')
  addManager(
    @Param('id') id: string,
    @Body() dto: AddManagerDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.departmentsService.addManager(id, dto, actor);
  }

  @Delete(':id/managers/:userId')
  removeManager(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.departmentsService.removeManager(id, userId, actor);
  }
}
