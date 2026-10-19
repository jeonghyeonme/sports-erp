import { StorageService } from '../src/modules/storage/storage.service';

/**
 * Supabase 드라이버가 저장소에 보내는 요청 모양(D57, log/131). 다른 첨부 테스트는 메모리 드라이버로 돌아
 * 실제 REST 호출을 보지 않는다 — 배포에서 upload/sign이 빈 JSON 본문 때문에 400이 난 것을 여기서 막는다.
 * fetch를 가로채므로 네트워크·키 없이 돈다.
 */
describe('Supabase 저장소 드라이버 요청(D57)', () => {
  const env = { ...process.env };
  let calls: Array<{ url: string; init: RequestInit }>;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co/';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    delete process.env.SUPABASE_STORAGE_BUCKET;
    calls = [];
    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ url: '/object/upload/sign/attachments/a/b.pdf?token=t' }), { status: 200 });
    });
  });
  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });

  it('업로드 URL 요청은 JSON 본문을 함께 보내고 두 인증 헤더를 단다', async () => {
    const url = await new StorageService().createUploadUrl('posts/p1/b.pdf');

    expect(url).toBe('https://example.supabase.co/storage/v1/object/upload/sign/attachments/a/b.pdf?token=t');
    expect(calls).toHaveLength(1);
    const { url: called, init } = calls[0];
    expect(called).toBe('https://example.supabase.co/storage/v1/object/upload/sign/attachments/posts/p1/b.pdf');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{}');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer service-key',
      apikey: 'service-key',
      'Content-Type': 'application/json',
    });
  });

  it('저장소가 거부하면 502 STORAGE_ERROR', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 400 }));
    await expect(new StorageService().createUploadUrl('posts/p1/b.pdf')).rejects.toMatchObject({ status: 502 });
  });
});
