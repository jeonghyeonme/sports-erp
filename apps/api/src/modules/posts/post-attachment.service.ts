import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppException } from '../../common/exceptions/app.exception';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ATTACHMENT_MAX_BYTES, ATTACHMENTS_PER_POST } from './dto/attachment.dto';
import { badType, checkType, extensionOf, tooLarge } from './attachment-rules';
import { PostService } from './post.service';

export interface AttachmentView {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

/**
 * 게시판 첨부(게시판 ADR-BRD-04, 저장소 D57). 브라우저가 저장소로 직접 올리고, api는 서명 URL과 검사만 한다.
 * 1) 업로드 URL: 글 작성자만, 형식·크기·개수 검사 → `posts/<글 id>/<uuid>.<확장자>` 경로의 1회용 업로드 URL
 * 2) 붙이기: 그 경로에 실제로 올라온 파일의 크기·형식을 저장소에서 다시 확인하고 행을 만든다(글 행 락 위에서 개수 검사)
 * 3) 받기: 글을 볼 수 있는 사람(게시판 가시성, ADR-BRD-01)에게 60초짜리 다운로드 URL
 * Attachment.url에는 저장소 경로를 둔다(스키마 변경 없음).
 */
@Injectable()
export class PostAttachmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostService,
    private readonly storage: StorageService,
  ) {}

  async list(postId: string): Promise<AttachmentView[]> {
    const rows = await this.prisma.attachment.findMany({ where: { postId }, orderBy: { id: 'asc' } });
    return rows.map((r) => ({ id: r.id, fileName: r.fileName, fileType: r.fileType, fileSize: r.fileSize }));
  }

  async requestUpload(postId: string, user: RequestUser, input: { fileName: string; fileType: string; fileSize: number }) {
    await this.requireAuthor(postId, user);
    const ext = extensionOf(input.fileName);
    checkType(ext, input.fileType);
    if (input.fileSize > ATTACHMENT_MAX_BYTES) throw tooLarge();
    if ((await this.prisma.attachment.count({ where: { postId } })) >= ATTACHMENTS_PER_POST) throw tooMany();
    const path = `posts/${postId}/${randomUUID()}.${ext}`;
    return { path, uploadUrl: await this.storage.createUploadUrl(path), maxBytes: ATTACHMENT_MAX_BYTES };
  }

  async confirm(postId: string, user: RequestUser, input: { path: string; fileName: string }): Promise<AttachmentView> {
    await this.requireAuthor(postId, user);
    if (!input.path.startsWith(`posts/${postId}/`)) {
      throw new AppException('ATTACHMENT_PATH_MISMATCH', '이 글에 받은 업로드 경로가 아닙니다.', 400);
    }
    const ext = extensionOf(input.path);
    if (extensionOf(input.fileName) !== ext) throw badType();
    const info = await this.storage.info(input.path);
    if (!info) throw new AppException('ATTACHMENT_NOT_UPLOADED', '파일이 아직 올라가지 않았습니다. 다시 올려 주세요.', 409);
    if (info.size > ATTACHMENT_MAX_BYTES) {
      await this.storage.removeQuietly([input.path]);
      throw tooLarge();
    }
    const fileType = (info.contentType ?? '').split(';')[0].trim();
    checkType(ext, fileType);

    const row = await this.prisma.$transaction(async (tx) => {
      // 같은 글에 동시에 붙여도 5개를 넘지 않게 글 행을 잠그고 센다.
      await tx.$queryRaw`SELECT "id" FROM "Post" WHERE "id" = ${postId} FOR UPDATE`;
      if (await tx.attachment.count({ where: { postId, url: input.path } })) {
        throw new AppException('ATTACHMENT_DUPLICATE', '이미 붙인 파일입니다.', 409);
      }
      if ((await tx.attachment.count({ where: { postId } })) >= ATTACHMENTS_PER_POST) throw tooMany();
      return tx.attachment.create({
        data: { postId, url: input.path, fileName: input.fileName.trim(), fileType: fileType || 'application/octet-stream', fileSize: info.size },
      });
    });
    return { id: row.id, fileName: row.fileName, fileType: row.fileType, fileSize: row.fileSize };
  }

  async downloadUrl(postId: string, attachmentId: string, user: RequestUser): Promise<{ url: string; expiresInSec: number }> {
    await this.posts.findVisible(postId, user); // 볼 수 없는 글이면 404(존재를 드러내지 않는다)
    const row = await this.prisma.attachment.findFirst({ where: { id: attachmentId, postId } });
    if (!row) throw notFound();
    return { url: await this.storage.createDownloadUrl(row.url, row.fileName, 60), expiresInSec: 60 };
  }

  // 작성자 본인 또는 본사(글 삭제 권한과 같다).
  async remove(postId: string, attachmentId: string, user: RequestUser): Promise<{ id: string }> {
    const post = await this.posts.findVisible(postId, user);
    if (post.authorId !== user.accountId && user.role !== 'SUPER_ADMIN') throw notAuthor();
    const row = await this.prisma.attachment.findFirst({ where: { id: attachmentId, postId } });
    if (!row) throw notFound();
    await this.prisma.attachment.delete({ where: { id: row.id } });
    await this.storage.removeQuietly([row.url]);
    return { id: row.id };
  }

  private async requireAuthor(postId: string, user: RequestUser) {
    const post = await this.posts.findVisible(postId, user);
    if (post.authorId !== user.accountId) throw notAuthor();
    return post;
  }
}

function tooMany() {
  return new AppException('ATTACHMENT_LIMIT', `글 하나에 첨부는 ${ATTACHMENTS_PER_POST}개까지입니다.`, 409);
}

function notAuthor() {
  return new AppException('POST_SCOPE_VIOLATION', '본인이 작성한 게시글의 첨부만 다룰 수 있습니다.', 403);
}

function notFound() {
  return new AppException('ATTACHMENT_NOT_FOUND', '첨부 파일을 찾을 수 없습니다.', 404);
}
