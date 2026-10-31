import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * D69 — 계약 파일을 테스트에서 올리는 도우미. 메모리 저장소(로컬·테스트)라 업로드 URL은 api의 /dev-storage로 향한다.
 * 1) 업로드 URL을 받고 2) 그 URL에 파일을 PUT 한 뒤, 갱신·지점 등록·파일 올리기 요청에 실을 {path, fileName}을 돌려준다.
 */
export async function uploadContractFile(
  app: INestApplication,
  auth: string,
  file: { fileName?: string; type?: string; bytes?: number } = {},
): Promise<{ path: string; fileName: string }> {
  const { fileName = 'contract.pdf', type = 'application/pdf', bytes = 1024 } = file;
  const url = await request(app.getHttpServer())
    .post('/api/v1/branches/contract-files/upload-url')
    .set('Authorization', auth)
    .send({ fileName, fileType: type, fileSize: bytes });
  if (url.status !== 201) throw new Error(`업로드 URL 발급 실패 ${url.status} ${JSON.stringify(url.body)}`);
  await request(app.getHttpServer()).put(`/api/v1/${url.body.data.uploadUrl}`).set('Content-Type', type).send(Buffer.alloc(bytes, 1));
  return { path: url.body.data.path, fileName };
}

/** 종료 확정의 전제(D69 결정 5) — 진행 중 회차에 해지 합의서를 올린다. 본사 토큰이어야 한다. */
export async function attachTerminationAgreement(app: INestApplication, hqAuth: string, branchId: string): Promise<void> {
  const file = await uploadContractFile(app, hqAuth, { fileName: '해지합의서.pdf' });
  const res = await request(app.getHttpServer())
    .post(`/api/v1/branches/${branchId}/contract/files`)
    .set('Authorization', hqAuth)
    .send({ kind: 'TERMINATION_AGREEMENT', ...file });
  if (res.status !== 201) throw new Error(`해지 합의서 올리기 실패 ${res.status} ${JSON.stringify(res.body)}`);
}
