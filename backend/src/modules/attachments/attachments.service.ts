import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { Prisma } from '@prisma/client';
import { Readable } from 'stream';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]);

const DISGUISED_FAMILY: Record<string, string[]> = {
  'application/x-cfb': ['application/msword', 'application/vnd.ms-excel'],
};

function mimeMatch(declared: string, detected: string | undefined): boolean {
  if (!ALLOWED_MIME_TYPES.has(declared)) {
    return false;
  }
  if (!detected) {
    return declared === 'text/csv';
  }
  if (detected === declared) {
    return true;
  }
  if (detected === 'application/zip' && declared.startsWith('application/vnd.openxmlformats-officedocument')) {
    return true;
  }
  const family = DISGUISED_FAMILY[detected];
  if (family && family.includes(declared)) {
    return true;
  }
  return false;
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly authService: AuthService,
  ) {}

  private detectMimeFromBuffer(buffer: Buffer): string | undefined {
    if (!buffer || buffer.length < 4) return undefined;
    const header = buffer.subarray(0, 8).toString('hex').toLowerCase();

    // PDF: %PDF
    if (header.startsWith('25504446')) return 'application/pdf';
    // PNG: ‰PNG
    if (header.startsWith('89504e47')) return 'image/png';
    // JPEG: starts with FFD8FF
    if (header.startsWith('ffd8ff')) return 'image/jpeg';
    // ZIP (for OOXML: .docx, .xlsx)
    if (header.startsWith('504b0304')) return 'application/zip';
    // CFB (for legacy .doc, .xls)
    if (header.startsWith('d0cf11e0')) return 'application/x-cfb';

    // CSV: often starts with plain text, check first bytes
    if (buffer.length >= 4) {
      const first = buffer.subarray(0, 4).toString('utf8');
      if (/^[a-zA-Z0-9",\-]/.test(first)) return 'text/csv';
    }

    return undefined;
  }

  private validateFiles(files: Express.Multer.File[]): void {
    const errors: string[] = [];
    const maxSizeMb = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '15', 10);
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    for (const file of files) {
      if (file.size > maxSizeBytes) {
        errors.push(
          `"${file.originalname}" exceeds the maximum size of ${maxSizeMb}MB`,
        );
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `File validation failed: ${errors.join('; ')}`,
      );
    }
  }

  private async validateMimeTypes(
    files: Express.Multer.File[],
  ): Promise<void> {
    const errors: string[] = [];

    for (const file of files) {
      const declared = file.mimetype;
      const detected = this.detectMimeFromBuffer(file.buffer);

      if (!mimeMatch(declared, detected)) {
        const detectedStr =
          detected || 'unknown (no magic bytes detected)';
        errors.push(
          `"${file.originalname}": declared type "${declared}" does not match detected type "${detectedStr}"`,
        );
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `File validation failed: ${errors.join('; ')}`,
      );
    }
  }

  async uploadToIssue(
    issueId: string,
    files: Express.Multer.File[],
    actor: JwtPayload,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    if (files.length > 5) {
      throw new BadRequestException(
        'Maximum 5 files per request',
      );
    }

    // Part E: No visibility restriction — any authenticated user can attach files to any issue
    // Just verify the issue exists
    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException('Issue not found');

    this.validateFiles(files);
    await this.validateMimeTypes(files);

    const attachments = [];

    for (const file of files) {
      const storagePath = await this.storage.save(
        file.originalname,
        file.buffer,
      );

      const safe = await this.storage.scanFile(storagePath);
      if (!safe) {
        await this.storage.delete(storagePath);
        throw new BadRequestException(
          `File "${file.originalname}" failed security scan`,
        );
      }

      const attachment = await this.prisma.attachment.create({
        data: {
          issueId,
          uploadedById: actor.userId,
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          storagePath,
        },
      });

      await this.prisma.activityLog.create({
        data: {
          issueId,
          userId: actor.userId,
          action: 'ATTACHMENT_ADDED',
          newValue: file.originalname,
        },
      });

      const { storagePath: _, ...safeAttachment } = attachment;
      attachments.push(safeAttachment);
    }

    return attachments;
  }

  async uploadToComment(
    commentId: string,
    files: Express.Multer.File[],
    issueId: string,
    actor: JwtPayload,
  ) {
    if (!files || files.length === 0) return [];

    if (files.length > 5) {
      throw new BadRequestException(
        'Maximum 5 files per request',
      );
    }

    this.validateFiles(files);
    await this.validateMimeTypes(files);

    const attachments = [];

    for (const file of files) {
      const storagePath = await this.storage.save(
        file.originalname,
        file.buffer,
      );

      const safe = await this.storage.scanFile(storagePath);
      if (!safe) {
        await this.storage.delete(storagePath);
        throw new BadRequestException(
          `File "${file.originalname}" failed security scan`,
        );
      }

      const attachment = await this.prisma.attachment.create({
        data: {
          issueId,
          commentId,
          uploadedById: actor.userId,
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          storagePath,
        },
      });

      await this.prisma.activityLog.create({
        data: {
          issueId,
          userId: actor.userId,
          action: 'ATTACHMENT_ADDED',
          newValue: file.originalname,
        },
      });

      const { storagePath: _, ...safeAttachment } = attachment;
      attachments.push(safeAttachment);
    }

    return attachments;
  }

  async getAttachmentMeta(id: string, _actor: JwtPayload) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: { issue: true, comment: true },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Part E: No visibility restriction — any authenticated user can download attachments
    return attachment;
  }

  async getDownloadStream(
    id: string,
    actor: JwtPayload,
  ): Promise<{ stream: Readable; fileName: string; fileType: string; fileSize: number }> {
    const attachment = await this.getAttachmentMeta(id, actor);
    const stream = await this.storage.getStream(
      attachment.storagePath,
    );
    return {
      stream,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
    };
  }
}