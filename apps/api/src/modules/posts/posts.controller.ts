import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { MockDataService } from '../../mock-data/mock-data.service';
import { ok } from '../../common/http/api-response';

// 04문서 §7 — 전체 HQ 공지 + 본인 소속 지점의 BRANCH_TO_MEMBER 게시글만 노출
@Controller('posts')
export class PostsController {
  constructor(private readonly mockData: MockDataService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query('scope') scope?: string) {
    let posts = this.mockData.posts;
    if (scope) posts = posts.filter((p) => p.scope === scope);
    if (user.role !== 'SUPER_ADMIN') {
      posts = posts.filter((p) => !p.branchId || p.branchId === user.branchId);
    }
    return ok(posts);
  }
}
