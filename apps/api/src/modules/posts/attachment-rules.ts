import { AppException } from '../../common/exceptions/app.exception';
import { ALLOWED_TYPES } from './dto/attachment.dto';

// 첨부 형식·크기 검사(D57) — 게시판 첨부와 계약 파일(D69)이 같이 쓴다.
// 서비스에 두면 branch.service → contract-file.service → post-attachment.service → post.service → branch.service
// 순환 import가 생겨 Nest 주입이 undefined가 되므로 서비스 의존이 없는 이 파일에 둔다.

export function extensionOf(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

export function checkType(ext: string, fileType: string) {
  const allowed = ALLOWED_TYPES[ext];
  if (!allowed || !allowed.includes(fileType.toLowerCase())) throw badType();
}

export function badType() {
  return new AppException(
    'ATTACHMENT_TYPE_NOT_ALLOWED',
    'PDF·이미지(png·jpg·webp)·오피스(docx·xlsx·pptx)·한글(hwp) 파일만 올릴 수 있습니다.',
    400,
  );
}

export function tooLarge() {
  return new AppException('ATTACHMENT_TOO_LARGE', '파일 하나는 10MB까지 올릴 수 있습니다.', 400);
}
