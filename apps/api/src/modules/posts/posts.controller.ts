import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { AppException } from '../../common/exceptions/app.exception';
import { BranchScopeExempt } from '../../common/decorators/scoped-resource.decorator';
import { ok } from '../../common/http/api-response';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostService } from './post.service';

// 게시판 A-5·A-7 — 전체 HQ 공지 + 본인 소속 지점의 BRANCH_TO_MEMBER 게시글만 노출.
// 작성: SUPER_ADMIN→HQ_TO_BRANCH, BRANCH_ADMIN→BRANCH_TO_MEMBER(본인 지점 강제). 수정/삭제는 작성자 본인만(삭제는 SUPER_ADMIN도 가능).
// D36 — 원천은 DB(PostService). D46 — 게시글은 "HQ 공지는 전 지점 공개"라 지점 소유 검사가 아니라
// PostService의 가시성 규칙(findVisible·viewDetail)이 범위를 본다.
const POST_VISIBILITY = 'PostService.findVisible·viewDetail의 가시성 규칙(게시판 A-7)이 범위를 본다';
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostService) {}

  // ADR-BRD-02 — page/limit로 잘라 돌려준다. 기본 limit=20, meta.total/page/pageSize를 함께 내린다.
  // ADR-BRD-03 — sort=latest면 최신 글부터. 그 밖의 값·생략은 기존 순서(오래된 글부터)라 admin-web은 그대로다.
  @Get()
  async list(
    @CurrentUser() user: RequestUser,
    @Query('scope') scope?: string,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
    @Query('sort') sort?: string,
  ) {
    const page = Math.max(1, Math.trunc(Number(pageQuery)) || 1);
    const pageSize = Math.max(1, Math.trunc(Number(limitQuery)) || 20);
    const { items, total } = await this.posts.list(user, { scope, page, pageSize, latestFirst: sort === 'latest' });
    return ok(items, { page, pageSize, total });
  }

  @Get(':id')
  @BranchScopeExempt(POST_VISIBILITY)
  async detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return ok(await this.posts.viewDetail(id, user));
  }

  @Post()
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
    return ok(await this.posts.update(id, dto));
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
