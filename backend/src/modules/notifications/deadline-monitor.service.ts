import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

@Injectable()
export class DeadlineMonitorService {
  private readonly logger = new Logger(DeadlineMonitorService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleDeadlineCheck() {
    this.logger.log('Deadline monitor running...');
    try {
      const count = await this.notificationsService.checkDeadlines();
      this.logger.log(`Deadline monitor complete. Created ${count} notifications.`);
    } catch (err) {
      this.logger.error(`Deadline monitor failed: ${(err as Error).message}`);
    }
  }
}