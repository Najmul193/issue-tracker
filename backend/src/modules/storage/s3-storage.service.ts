import { Injectable } from '@nestjs/common';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { StorageService } from './storage.service';

@Injectable()
export class S3StorageService implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || '';
    if (!this.bucket) {
      throw new Error('S3_BUCKET environment variable is required');
    }
    this.prefix = process.env.S3_PREFIX || 'uploads';
    this.client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      },
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    });
  }

  async save(originalName: string, buffer: Buffer): Promise<string> {
    const ext = path.extname(originalName) || '';
    const uuid = randomUUID();
    const key = `${this.prefix}/${uuid}${ext}`;
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
      },
    });
    await upload.done();
    return key;
  }

  async getStream(storagePath: string): Promise<Readable> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    });
    const response = await this.client.send(command);
    return response.Body as Readable;
  }

  async delete(storagePath: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      });
      await this.client.send(command);
    } catch {
      // silently ignore if file already gone
    }
  }

  async scanFile(_storagePath: string): Promise<boolean> {
    return true;
  }
}
