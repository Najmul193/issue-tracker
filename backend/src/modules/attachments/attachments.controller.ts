import { Controller, Get, Param, StreamableFile, BadRequestException } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AttachmentsService } from './attachments.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/decorators/current-user.decorator';

const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '15', 10);

const PREVIEWABLE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<StreamableFile> {
    const { stream, fileName, fileType, fileSize } =
      await this.attachmentsService.getDownloadStream(id, actor);

    return new StreamableFile(stream, {
      type: fileType,
      disposition: `attachment; filename="${fileName}"`,
      length: fileSize,
    });
  }

  @Get(':id/preview')
  async preview(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<StreamableFile> {
    const { stream, fileName, fileType, fileSize } =
      await this.attachmentsService.getDownloadStream(id, actor);

    if (!PREVIEWABLE_MIME_TYPES.has(fileType)) {
      throw new BadRequestException('This file type cannot be previewed');
    }

    return new StreamableFile(stream, {
      type: fileType,
      disposition: `inline; filename="${fileName}"`,
      length: fileSize,
    });
  }
}
