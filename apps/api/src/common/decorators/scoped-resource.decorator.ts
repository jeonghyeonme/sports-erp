import { SetMetadata } from '@nestjs/common';
import { Role } from '../../fixtures/mock-data.types';
import { ScopedKind } from '../guards/scope-owners';

export const SCOPED_RESOURCE_KEY = 'scopedResource';
export const BRANCH_SCOPE_EXEMPT_KEY = 'branchScopeExempt';

export interface ScopedResourceOptions {
  /** 리소스 id를 읽을 곳 — 셋 중 하나. 아무것도 안 주면 경로 파라미터 `id`. */
  param?: string;
  query?: string;
  body?: string;
  /** 거부 응답 코드를 도메인 고유 코드로 유지해야 할 때(화면 오류 해결 문구·기존 테스트가 이 코드를 본다). */
  code?: string;
  /** 이 역할은 검사하지 않는다 — 핸들러가 그 역할의 id를 "본인"으로 고정해 요청 값을 무시하는 라우트. */
  skipFor?: Role[];
}

export interface ScopedResourceMeta {
  kind: ScopedKind;
  source: 'param' | 'query' | 'body';
  key: string;
  code?: string;
  skipFor?: Role[];
}

/**
 * D46 — 이 라우트가 다루는 리소스를 선언하면 전역 BranchScopeGuard가 소유 지점(·본인)을 확인한다.
 * 사용 예: `@ScopedResource('member')`(경로 :id), `@ScopedResource('staff', { query: 'staffId' })`.
 * 쿼리·본문에 id가 없으면 검사하지 않는다(핸들러가 "본인" 기본값을 쓰는 라우트).
 */
export const ScopedResource = (kind: ScopedKind, options: ScopedResourceOptions = {}) => {
  const [source, key]: [ScopedResourceMeta['source'], string] = options.query
    ? ['query', options.query]
    : options.body
      ? ['body', options.body]
      : ['param', options.param ?? 'id'];
  return SetMetadata<string, ScopedResourceMeta>(SCOPED_RESOURCE_KEY, {
    kind,
    source,
    key,
    code: options.code,
    skipFor: options.skipFor,
  });
};

/** D46 — 경로 파라미터가 있지만 지점 소유 검사가 다른 곳에 있는 라우트. 이유를 남긴다(라우트 표 검사가 본다). */
export const BranchScopeExempt = (reason: string) => SetMetadata(BRANCH_SCOPE_EXEMPT_KEY, reason);
