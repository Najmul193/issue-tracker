import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { AssignIssueDto } from './dto/assign-issue.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { QueryIssuesDto } from './dto/query-issues.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/decorators/current-user.decorator';

const MAX_UPLOAD_SIZE_MB =
  parseInt(process.env.MAX_UPLOAD_SIZE_MB || '15', 10);

@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateIssueDto, @CurrentUser() actor: JwtPayload) {
    return this.issuesService.create(dto, actor);
  }

  @Get()
  findAll(@Query() query: QueryIssuesDto, @CurrentUser() actor: JwtPayload) {
    return this.issuesService.findAll(query, actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.issuesService.findOne(id, actor);
  }

  @Patch(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignIssueDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.issuesService.assign(id, dto, actor);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.issuesService.updateStatus(id, dto, actor);
  }

  @Post(':id/attachments')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'files', maxCount: 5 }]),
  )
  @HttpCode(HttpStatus.CREATED)
  async uploadAttachments(
    @Param('id') id: string,
    @UploadedFiles()
    uploadedFiles: { files?: Express.Multer.File[] },
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.issuesService.addAttachments(
      id,
      uploadedFiles?.files || [],
      actor,
    );
  }

  @Post(':id/comments')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'attachments', maxCount: 5 }]),
  )
  @HttpCode(HttpStatus.CREATED)
  async addComment(
    @Param('id') id: string,
    @UploadedFiles()
    uploadedFiles: { attachments?: Express.Multer.File[] },
    @Body() dto: AddCommentDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.issuesService.addComment(
      id,
      dto,
      actor,
      uploadedFiles?.attachments,
    );
  }

  @Get(':id/activity')
  getActivity(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.issuesService.getActivity(id, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.issuesService.delete(id, actor);
  }
}
