import { randomUUID } from 'crypto';
import { AppException } from '../../common/exceptions/app.exception';
import type { StorageService } from '../storage/storage.service';
import { ALLOWED_TYPES, ATTACHMENT_MAX_BYTES } from './dto/attachment.dto';

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

// ── 저장소에 직접 올리는 파일(D57 방식) — 계약 파일(D69)·문서 파일(D69 2차, log/206)이 같이 쓴다 ──
// 1) api가 경로를 정해 1회용 업로드 URL을 준다 → 2) 브라우저가 올린다 → 3) 붙일 때 저장소에서 크기·형식을 다시 본다.
// 경로는 `<prefix>/<uuid>.<확장자>`만 받는다 — 다른 용도로 올린 파일(예: 계약 파일 경로)을 붙이지 못하게.

/** 저장소에서 다시 확인한 파일 — 붙일 때 그대로 행이 된다. */
export interface VerifiedStoredFile {
  path: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

const UUID_PATH = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.[a-z0-9]+';

export async function requestStoredUpload(
  storage: Pick<StorageService, 'createUploadUrl'>,
  prefix: string,
  input: { fileName: string; fileType: string; fileSize: number },
) {
  const ext = extensionOf(input.fileName);
  checkType(ext, input.fileType);
  if (input.fileSize > ATTACHMENT_MAX_BYTES) throw tooLarge();
  const path = `${prefix}/${randomUUID()}.${ext}`;
  return { path, uploadUrl: await storage.createUploadUrl(path), maxBytes: ATTACHMENT_MAX_BYTES };
}

/** 1단계에서 받은 경로에 파일이 실제로 올라왔는지, 크기·형식이 맞는지 저장소에서 다시 본다. 트랜잭션 밖에서 부른다. */
export async function verifyStoredFile(
  storage: Pick<StorageService, 'info'>,
  prefix: string,
  input: { path: string; fileName: string },
): Promise<VerifiedStoredFile> {
  if (!new RegExp(`^${prefix}/${UUID_PATH}$`).test(input.path)) {
    throw new AppException('ATTACHMENT_PATH_INVALID', '올린 파일 경로가 맞지 않습니다. 다시 올려 주세요.', 400);
  }
  const ext = extensionOf(input.path);
  if (extensionOf(input.fileName) !== ext) throw badType();
  const info = await storage.info(input.path);
  if (!info) throw new AppException('ATTACHMENT_NOT_UPLOADED', '파일이 아직 올라가지 않았습니다. 다시 올려 주세요.', 409);
  if (info.size > ATTACHMENT_MAX_BYTES) throw tooLarge();
  const fileType = (info.contentType ?? '').split(';')[0].trim();
  checkType(ext, fileType);
  return { path: input.path, fileName: input.fileName.trim(), fileType: fileType || 'application/octet-stream', fileSize: info.size };
}
