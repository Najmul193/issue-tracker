import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';

@Module({
  providers: [
    {
      provide: StorageService,
      useClass: process.env.S3_BUCKET ? S3StorageService : LocalStorageService,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
