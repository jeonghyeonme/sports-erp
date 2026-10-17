import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostService } from './post.service';
import { PostAttachmentService } from './post-attachment.service';

// D36 — 게시글 원천은 DB(PostService). 첨부는 게시판 ADR-BRD-04·D57.
@Module({ controllers: [PostsController], providers: [PostService, PostAttachmentService] })
export class PostsModule {}
