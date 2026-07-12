import { Module, forwardRef } from '@nestjs/common';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';
import { StateMachine } from './state-machine';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    AttachmentsModule,
    StorageModule,
    forwardRef(() => NotificationsModule),
    ProjectsModule,
  ],
  controllers: [IssuesController],
  providers: [IssuesService, StateMachine],
  exports: [IssuesService, StateMachine],
})
export class IssuesModule {}
