import {
  Controller,
  Get,
  Param,
  StreamableFile,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AttachmentsService } from './attachments.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/decorators/current-user.decorator';

const MAX_UPLOAD_SIZE_MB =
  parseInt(process.env.MAX_UPLOAD_SIZE_MB || '15', 10);

@Controller('attachments')
export class AttachmentsController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
  ) {}

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
}
