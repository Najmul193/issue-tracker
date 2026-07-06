import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';

const MAX_UPLOAD_SIZE_MB =
  parseInt(process.env.MAX_UPLOAD_SIZE_MB || '15', 10);

@Module({
  imports: [
    StorageModule,
    AuthModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024,
      },
    }),
  ],
  providers: [AttachmentsService],
  controllers: [AttachmentsController],
  exports: [AttachmentsService, MulterModule],
})
export class AttachmentsModule {}
