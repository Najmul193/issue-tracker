import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/decorators/current-user.decorator';

@Controller()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  // ----- Notifications -----

  @Get('notifications')
  findAll(
    @CurrentUser() actor: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unread') unread?: string,
  ) {
    return this.notificationsService.findAllForUser(actor, {
      page,
      limit,
      unread,
    });
  }

  @Get('notifications/unread-count')
  getUnreadCount(@CurrentUser() actor: JwtPayload) {
    return this.notificationsService.getUnreadCount(actor);
  }

  @Patch('notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    const result = await this.notificationsService.markAsRead(id, actor);
    if (!result) {
      return {
        success: false,
        message: 'Notification not found or access denied',
      };
    }
    return result;
  }

  @Patch('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@CurrentUser() actor: JwtPayload) {
    return this.notificationsService.markAllAsRead(actor);
  }

  // ----- Dashboard -----

  @Get('dashboard/summary')
  getDashboardSummary(@CurrentUser() actor: JwtPayload) {
    return this.notificationsService.getDashboardSummary(actor);
  }
}