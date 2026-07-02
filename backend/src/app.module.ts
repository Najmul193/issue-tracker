import { Module } from '@nestjs/common';
import { PrismaModule } from './modules/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { IssuesModule } from './modules/issues/issues.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    IssuesModule,
    OrganizationsModule,
    AttachmentsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
