import { Controller, Get, Delete, Param, ForbiddenException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/decorators/current-user.decorator';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get('deleted')
  findDeleted(@CurrentUser() actor: JwtPayload) {
    if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenException('SUPER_ADMIN only');
    return this.organizationsService.findDeleted();
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.organizationsService.remove(id, actor);
  }

  @Delete(':id/permanent')
  permanentRemove(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenException('SUPER_ADMIN only');
    return this.organizationsService.permanentRemove(id, actor);
  }
}
