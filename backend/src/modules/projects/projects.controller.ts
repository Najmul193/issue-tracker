import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddOrgDto } from './dto/add-org.dto';
import { AddUserDto } from './dto/add-user.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/decorators/current-user.decorator';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProjectDto, @CurrentUser() actor: JwtPayload) {
    return this.projectsService.create(dto, actor);
  }

  @Get()
  findAll(@CurrentUser() actor: JwtPayload) {
    return this.projectsService.findAll(actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.projectsService.findOne(id, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.projectsService.update(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.projectsService.remove(id, actor);
  }

  @Get(':id/organizations')
  getOrganizations(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.projectsService.getOrganizations(id, actor);
  }

  @Post(':id/organizations')
  addOrganization(
    @Param('id') id: string,
    @Body() dto: AddOrgDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.projectsService.addOrganization(id, dto.organizationId, actor);
  }

  @Delete(':id/organizations/:orgId')
  removeOrganization(
    @Param('id') id: string,
    @Param('orgId') orgId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.projectsService.removeOrganization(id, orgId, actor);
  }

  @Get(':id/users')
  getUsers(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.projectsService.getUsers(id, actor);
  }

  @Post(':id/users')
  addUser(
    @Param('id') id: string,
    @Body() dto: AddUserDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.projectsService.addUser(id, dto.userId, actor);
  }

  @Delete(':id/users/:userId')
  removeUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.projectsService.removeUser(id, userId, actor);
  }
}
