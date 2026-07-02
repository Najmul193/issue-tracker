import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailService } from './email.service';
import { DeadlineMonitorService } from './deadline-monitor.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    NotificationsService,
    EmailService,
    DeadlineMonitorService,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}
