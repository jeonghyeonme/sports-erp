import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostService } from './post.service';

// D36 — 게시글 원천은 DB(PostService).
@Module({ controllers: [PostsController], providers: [PostService] })
export class PostsModule {}
