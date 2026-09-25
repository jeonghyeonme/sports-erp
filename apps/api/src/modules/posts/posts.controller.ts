import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { MockDataService } from '../../mock-data/mock-data.service';
import { AppException } from '../../common/exceptions/app.exception';
import { MockPost } from '../../mock-data/mock-data.types';
import { ok } from '../../common/http/api-response';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

// 04문서 §5·§7 — 전체 HQ 공지 + 본인 소속 지점의 BRANCH_TO_MEMBER 게시글만 노출.
// 작성: SUPER_ADMIN→HQ_TO_BRANCH, BRANCH_ADMIN→BRANCH_TO_MEMBER(본인 지점 강제). 수정/삭제는 작성자 본인만(삭제는 SUPER_ADMIN도 가능).
@Controller('posts')
export class PostsController {
  constructor(private readonly mockData: MockDataService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query('scope') scope?: string) {
    let posts = this.mockData.posts.filter((p) => !p.deletedAt);
    if (scope) posts = posts.filter((p) => p.scope === scope);
    posts = posts.filter((p) => this.isVisibleTo(p, user));
    return ok(posts.map((p) => this.toListItem(p)));
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const post = this.findVisibleOrThrow(id, user);
    return ok(this.toListItem(this.mockData.incrementPostView(post.id)));
  }

  @Post()
  create(@Body() dto: CreatePostDto, @CurrentUser() user: RequestUser) {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'BRANCH_ADMIN') {
      throw new AppException('POST_FORBIDDEN_ROLE', '게시글 작성 권한이 없습니다.', 403);
    }
    const post = this.mockData.createPost(
      { accountId: user.accountId, role: user.role, branchId: user.branchId },
      dto,
    );
    return ok(this.toListItem(post));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePostDto, @CurrentUser() user: RequestUser) {
    const post = this.findVisibleOrThrow(id, user);
    this.assertAuthor(post, user);
    return ok(this.toListItem(this.mockData.updatePost(id, dto)));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const post = this.findVisibleOrThrow(id, user);
    if (post.authorId !== user.accountId && user.role !== 'SUPER_ADMIN') {
      throw new AppException('POST_SCOPE_VIOLATION', '본인이 작성한 게시글만 삭제할 수 있습니다.', 403);
    }
    this.mockData.deletePost(id);
    return ok({ id });
  }

  private toListItem(post: MockPost) {
    return {
      ...post,
      authorName: this.mockData.findAccountById(post.authorId)?.name,
      branchName: post.branchId ? this.mockData.findBranchById(post.branchId)?.name : undefined,
    };
  }

  private findVisibleOrThrow(id: string, user: RequestUser): MockPost {
    const post = this.mockData.findPostById(id);
    if (!post || !this.isVisibleTo(post, user)) {
      throw new AppException('POST_NOT_FOUND', '게시글을 찾을 수 없습니다.', 404);
    }
    return post;
  }

  // ADR-BRD-01 — MEMBER는 본인 지점 BRANCH_TO_MEMBER 게시글 + visibleToMember=true인 HQ 공지만 볼 수 있다.
  private isVisibleTo(post: MockPost, user: RequestUser): boolean {
    if (user.role === 'SUPER_ADMIN') return true;
    if (post.branchId && post.branchId !== user.branchId) return false;
    if (user.role === 'MEMBER' && post.scope === 'HQ_TO_BRANCH' && !post.visibleToMember) return false;
    return true;
  }

  private assertAuthor(post: MockPost, user: RequestUser): void {
    if (post.authorId !== user.accountId) {
      throw new AppException('POST_SCOPE_VIOLATION', '본인이 작성한 게시글만 수정할 수 있습니다.', 403);
    }
  }
}
