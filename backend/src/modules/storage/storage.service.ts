import { Readable } from 'stream';

export abstract class StorageService {
  abstract save(filename: string, buffer: Buffer): Promise<string>;
  abstract getStream(storagePath: string): Promise<Readable>;
  abstract delete(storagePath: string): Promise<void>;
  abstract scanFile(storagePath: string): Promise<boolean>;
}
