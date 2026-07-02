import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
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
    @Res() res: Response,
  ) {
    const { stream, fileName, fileType, fileSize } =
      await this.attachmentsService.getDownloadStream(id, actor);

    res.setHeader('Content-Type', fileType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', fileSize);
    stream.pipe(res);
  }
}
