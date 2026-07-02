import { Module } from '@nestjs/common';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';
import { StateMachine } from './state-machine';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AuthModule, UsersModule, AttachmentsModule, StorageModule],
  controllers: [IssuesController],
  providers: [IssuesService, StateMachine],
  exports: [IssuesService, StateMachine],
})
export class IssuesModule {}
