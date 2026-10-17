import { Controller, Get, Param, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AppException } from '../../common/exceptions/app.exception';
import { StorageService } from './storage.service';

// D57 — 메모리 드라이버(로컬·테스트) 전용 업로드·다운로드. 토큰이 곧 권한이다(서명 URL과 같은 역할).
// Supabase 드라이버나 배포 환경에서는 404다.
@Controller('dev-storage')
export class DevStorageController {
  constructor(private readonly storage: StorageService) {}

  @Put('upload/:token')
  @Public()
  async upload(@Param('token') token: string, @Req() req: Request) {
    const memory = this.requireMemory();
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    if (!memory.acceptUpload(token, Buffer.concat(chunks), req.headers['content-type'])) throw notFound();
    return { ok: true };
  }

  @Get('download/:token')
  @Public()
  download(@Param('token') token: string, @Res() res: Response) {
    const file = this.requireMemory().takeDownload(token);
    if (!file) throw notFound();
    res.setHeader('Content-Type', file.contentType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.send(file.data);
  }

  private requireMemory() {
    if (!this.storage.memory) throw notFound();
    return this.storage.memory;
  }
}

function notFound() {
  return new AppException('NOT_FOUND', '찾을 수 없습니다.', 404);
}
