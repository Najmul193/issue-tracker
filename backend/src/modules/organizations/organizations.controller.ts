import { Controller, Get, Delete, Param } from '@nestjs/common';
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

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.organizationsService.remove(id, actor);
  }
}
