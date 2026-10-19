import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppException } from '../../common/exceptions/app.exception';
import { isDeployedRuntime } from '../../common/config/secrets';

/**
 * 첨부 파일 저장소(D57) — 브라우저가 저장소로 직접 올리고 받는다. api(Lambda)는 요청 본문 한도(6MB)가 있어
 * 파일을 거치지 않고, 권한·지점 검사 뒤 짧게 유효한 서명 URL만 발급한다.
 *
 * 드라이버:
 * - supabase: SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY가 있으면. 버킷은 SUPABASE_STORAGE_BUCKET(기본 attachments, 비공개).
 * - memory: 로컬·테스트(배포 환경이 아니고 Supabase 값이 없을 때). 업로드·다운로드는 api의 /dev-storage 경로로 받는다.
 * - 배포 환경에서 Supabase 값이 없으면 첨부 기능만 503 STORAGE_NOT_CONFIGURED(앱 부팅은 막지 않는다).
 */
export interface StoredObjectInfo {
  size: number;
  contentType?: string;
}

interface StorageDriver {
  createUploadUrl(path: string): Promise<string>;
  createDownloadUrl(path: string, downloadName: string, expiresInSec: number): Promise<string>;
  info(path: string): Promise<StoredObjectInfo | null>;
  remove(paths: string[]): Promise<void>;
}

// ── Supabase Storage(REST) ─────────────────────────────────

class SupabaseDriver implements StorageDriver {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceKey: string,
    private readonly bucket: string,
  ) {}

  private headers(json = true): Record<string, string> {
    return {
      Authorization: `Bearer ${this.serviceKey}`,
      apikey: this.serviceKey,
      ...(json ? { 'Content-Type': 'application/json' } : {}),
    };
  }

  private objectUrl(kind: string, path: string): string {
    return `${this.baseUrl}/storage/v1/object/${kind}/${this.bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
  }

  async createUploadUrl(path: string): Promise<string> {
    // 본문 '{}'가 필요하다 — JSON content-type에 빈 본문이면 Supabase Storage가 400으로 거부한다(storage-js도 {}를 보낸다, log/131).
    const res = await fetch(this.objectUrl('upload/sign', path), { method: 'POST', headers: this.headers(), body: '{}' });
    if (!res.ok) throw storageFailed(`upload/sign ${res.status}`);
    const body = (await res.json()) as { url: string };
    return `${this.baseUrl}/storage/v1${body.url}`;
  }

  async createDownloadUrl(path: string, downloadName: string, expiresInSec: number): Promise<string> {
    const res = await fetch(this.objectUrl('sign', path), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ expiresIn: expiresInSec }),
    });
    if (!res.ok) throw storageFailed(`sign ${res.status}`);
    const body = (await res.json()) as { signedURL: string };
    return `${this.baseUrl}/storage/v1${body.signedURL}&download=${encodeURIComponent(downloadName)}`;
  }

  async info(path: string): Promise<StoredObjectInfo | null> {
    // storage-js의 info()와 같은 경로(GET /object/info/<bucket>/<path>). 실제 Supabase로는 검증하지 않았다(log/121).
    const res = await fetch(this.objectUrl('info', path), { headers: this.headers(false) });
    if (res.status === 400 || res.status === 404) return null;
    if (!res.ok) throw storageFailed(`info ${res.status}`);
    const body = (await res.json()) as { size?: number; content_type?: string; metadata?: { size?: number; mimetype?: string } };
    const size = body.size ?? body.metadata?.size;
    if (typeof size !== 'number') return null;
    return { size, contentType: body.content_type ?? body.metadata?.mimetype };
  }

  async remove(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const res = await fetch(`${this.baseUrl}/storage/v1/object/${this.bucket}`, {
      method: 'DELETE',
      headers: this.headers(),
      body: JSON.stringify({ prefixes: paths }),
    });
    if (!res.ok) throw storageFailed(`remove ${res.status}`);
  }
}

// ── 메모리(로컬·테스트) ─────────────────────────────────────

export class MemoryDriver implements StorageDriver {
  readonly objects = new Map<string, { data: Buffer; contentType?: string }>();
  private readonly uploadTokens = new Map<string, string>();
  private readonly downloadTokens = new Map<string, { path: string; name: string }>();

  async createUploadUrl(path: string): Promise<string> {
    const token = randomUUID();
    this.uploadTokens.set(token, path);
    return `dev-storage/upload/${token}`;
  }

  async createDownloadUrl(path: string, downloadName: string): Promise<string> {
    const token = randomUUID();
    this.downloadTokens.set(token, { path, name: downloadName });
    return `dev-storage/download/${token}`;
  }

  async info(path: string): Promise<StoredObjectInfo | null> {
    const o = this.objects.get(path);
    return o ? { size: o.data.length, contentType: o.contentType } : null;
  }

  async remove(paths: string[]): Promise<void> {
    paths.forEach((p) => this.objects.delete(p));
  }

  // 업로드 토큰은 한 번만 쓴다(서명 URL처럼).
  acceptUpload(token: string, data: Buffer, contentType?: string): boolean {
    const path = this.uploadTokens.get(token);
    if (!path) return false;
    this.uploadTokens.delete(token);
    this.objects.set(path, { data, contentType });
    return true;
  }

  takeDownload(token: string): { data: Buffer; contentType?: string; name: string } | null {
    const d = this.downloadTokens.get(token);
    const o = d && this.objects.get(d.path);
    return d && o ? { ...o, name: d.name } : null;
  }
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger('StorageService');
  private readonly driver: StorageDriver | null;
  readonly memory: MemoryDriver | null;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      this.driver = new SupabaseDriver(url.replace(/\/$/, ''), key, process.env.SUPABASE_STORAGE_BUCKET || 'attachments');
      this.memory = null;
    } else if (!isDeployedRuntime()) {
      this.memory = new MemoryDriver();
      this.driver = this.memory;
    } else {
      this.driver = null;
      this.memory = null;
    }
  }

  private get d(): StorageDriver {
    if (!this.driver) {
      throw new AppException('STORAGE_NOT_CONFIGURED', '파일 저장소가 아직 설정되지 않았습니다. 본사 관리자에게 알려 주세요.', 503);
    }
    return this.driver;
  }

  createUploadUrl(path: string) {
    return this.d.createUploadUrl(path);
  }

  createDownloadUrl(path: string, downloadName: string, expiresInSec = 60) {
    return this.d.createDownloadUrl(path, downloadName, expiresInSec);
  }

  info(path: string) {
    return this.d.info(path);
  }

  // 지우기는 DB 행을 지운 뒤 한 번 시도한다 — 실패해도 요청은 성공으로 두고 기록만 남긴다(고아 파일은 용량만 쓴다).
  async removeQuietly(paths: string[]): Promise<void> {
    try {
      await this.d.remove(paths);
    } catch (e) {
      this.logger.warn(`첨부 파일 삭제 실패(${paths.join(', ')}): ${(e as Error).message}`);
    }
  }
}

function storageFailed(detail: string) {
  return new AppException('STORAGE_ERROR', `파일 저장소 요청이 실패했습니다(${detail}). 잠시 뒤 다시 시도하세요.`, 502);
}
