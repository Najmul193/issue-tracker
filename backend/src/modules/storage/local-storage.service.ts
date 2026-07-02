import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { StorageService } from './storage.service';

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async save(originalName: string, buffer: Buffer): Promise<string> {
    const ext = path.extname(originalName) || '';
    const uuid = randomUUID();
    const storagePath = path.join(this.uploadDir, `${uuid}${ext}`);
    await fs.promises.writeFile(storagePath, buffer);
    return storagePath;
  }

  async getStream(storagePath: string): Promise<Readable> {
    return fs.createReadStream(storagePath);
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await fs.promises.unlink(storagePath);
    } catch {
      // silently ignore if file already gone
    }
  }

  async scanFile(_storagePath: string): Promise<boolean> {
    // Placeholder: wire ClamAV or cloud scanning API here
    return true;
  }
}
