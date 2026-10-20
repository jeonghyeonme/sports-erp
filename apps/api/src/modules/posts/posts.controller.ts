import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { AppException } from '../../common/exceptions/app.exception';
import { BranchScopeExempt, ScopedResource } from '../../common/decorators/scoped-resource.decorator';
import { ok } from '../../common/http/api-response';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostService } from './post.service';
import { PostAttachmentService } from './post-attachment.service';
import { ConfirmAttachmentDto, RequestUploadDto } from './dto/attachment.dto';

// 게시판 A-5·A-7 — 전체 HQ 공지 + 본인 소속 지점의 BRANCH_TO_MEMBER 게시글만 노출.
// 작성: SUPER_ADMIN→HQ_TO_BRANCH, BRANCH_ADMIN→BRANCH_TO_MEMBER(본인 지점 강제). 수정/삭제는 작성자 본인만(삭제는 SUPER_ADMIN도 가능).
// D36 — 원천은 DB(PostService). D46 — 게시글은 "HQ 공지는 전 지점 공개"라 지점 소유 검사가 아니라
// PostService의 가시성 규칙(findVisible·viewDetail)이 범위를 본다.
const POST_VISIBILITY = 'PostService.findVisible·viewDetail의 가시성 규칙(게시판 A-7)이 범위를 본다';
@Controller('posts')
export class PostsController {
  constructor(
    private readonly posts: PostService,
    private readonly attachments: PostAttachmentService,
  ) {}

  // ADR-BRD-02 — page/limit로 잘라 돌려준다. 기본 limit=20, meta.total/page/pageSize를 함께 내린다.
  // ADR-BRD-03 — sort=latest면 최신 글부터. 그 밖의 값·생략은 기존 순서(오래된 글부터)라 admin-web은 그대로다.
  @Get()
  async list(
    @CurrentUser() user: RequestUser,
    @Query('scope') scope?: string,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
    @Query('sort') sort?: string,
    @Query('category') category?: string,
    @Query('facilityId') facilityId?: string,
  ) {
    const page = Math.max(1, Math.trunc(Number(pageQuery)) || 1);
    const pageSize = Math.max(1, Math.trunc(Number(limitQuery)) || 20);
    // RFP 게시판 "본사→현장 직원관리 탭(교육 매뉴얼·자료)" — category=TRAINING_MATERIAL로 교육자료만(log/114).
    const { items, total } = await this.posts.list(user, {
      scope,
      category,
      facilityId,
      page,
      pageSize,
      latestFirst: sort === 'latest',
    });
    return ok(items, { page, pageSize, total });
  }

  @Get(':id')
  @BranchScopeExempt(POST_VISIBILITY)
  async detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const post = await this.posts.viewDetail(id, user);
    // 게시판 ADR-BRD-04 — 첨부 목록(이름·형식·크기)을 상세에 함께 싣는다. 파일 자체는 다운로드 URL로 받는다.
    return ok({ ...post, attachments: await this.attachments.list(id) });
  }

  // ── 첨부(게시판 ADR-BRD-04, 저장소 D57) ────────────────────
  @Post(':id/attachments/upload-url')
  @BranchScopeExempt(POST_VISIBILITY)
  async requestUpload(@Param('id') id: string, @Body() dto: RequestUploadDto, @CurrentUser() user: RequestUser) {
    return ok(await this.attachments.requestUpload(id, user, dto));
  }

  @Post(':id/attachments')
  @BranchScopeExempt(POST_VISIBILITY)
  async confirmAttachment(@Param('id') id: string, @Body() dto: ConfirmAttachmentDto, @CurrentUser() user: RequestUser) {
    return ok(await this.attachments.confirm(id, user, dto));
  }

  @Get(':id/attachments/:attachmentId/download')
  @BranchScopeExempt(POST_VISIBILITY)
  async download(@Param('id') id: string, @Param('attachmentId') attachmentId: string, @CurrentUser() user: RequestUser) {
    return ok(await this.attachments.downloadUrl(id, attachmentId, user));
  }

  @Delete(':id/attachments/:attachmentId')
  @BranchScopeExempt(POST_VISIBILITY)
  async removeAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string, @CurrentUser() user: RequestUser) {
    return ok(await this.attachments.remove(id, attachmentId, user));
  }

  @Post()
  @ScopedResource('facility', { body: 'facilityId' })
  async create(@Body() dto: CreatePostDto, @CurrentUser() user: RequestUser) {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'BRANCH_ADMIN') {
      throw new AppException('POST_FORBIDDEN_ROLE', '게시글 작성 권한이 없습니다.', 403);
    }
    return ok(await this.posts.create({ accountId: user.accountId, role: user.role, branchId: user.branchId }, dto));
  }

  @Patch(':id')
  @BranchScopeExempt(POST_VISIBILITY)
  async update(@Param('id') id: string, @Body() dto: UpdatePostDto, @CurrentUser() user: RequestUser) {
    const post = await this.posts.findVisible(id, user);
    if (post.authorId !== user.accountId) {
      throw new AppException('POST_SCOPE_VIOLATION', '본인이 작성한 게시글만 수정할 수 있습니다.', 403);
    }
    return ok(await this.posts.update(post, dto));
  }

  @Delete(':id')
  @BranchScopeExempt(POST_VISIBILITY)
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const post = await this.posts.findVisible(id, user);
    if (post.authorId !== user.accountId && user.role !== 'SUPER_ADMIN') {
      throw new AppException('POST_SCOPE_VIOLATION', '본인이 작성한 게시글만 삭제할 수 있습니다.', 403);
    }
    await this.posts.softDelete(id);
    return ok({ id });
  }
}
