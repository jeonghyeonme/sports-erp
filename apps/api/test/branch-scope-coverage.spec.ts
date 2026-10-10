import { INestApplication } from '@nestjs/common';
import { PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { ModulesContainer } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator';
import { ROLES_KEY } from '../src/common/decorators/roles.decorator';
import {
  BRANCH_SCOPE_EXEMPT_KEY,
  SCOPED_RESOURCE_KEY,
  ScopedResourceMeta,
} from '../src/common/decorators/scoped-resource.decorator';
import { createApp } from './helpers/app';

/**
 * D46 — 지점 격리 검사가 전역 BranchScopeGuard 한 곳으로 모였으니, 남은 위험은 "새 라우트가 선언을 빠뜨리는 것"이다.
 * 실제 앱의 라우트 표를 훑어, 리소스 id를 받는 라우트가 모두 @ScopedResource(또는 이유를 단 @BranchScopeExempt)를
 * 갖는지 확인한다. 이게 실패하면 새 라우트에 선언을 붙이고 branch-isolation.spec.ts 공격 표에도 추가한다.
 *
 * 리소스 id로 보는 것: 경로 파라미터 전부, 쿼리 staffId·memberId(다른 사람 데이터를 고르는 값).
 * 면제: @Public, SUPER_ADMIN 전용 라우트(지점 범위가 없다), 경로 파라미터가 branchId뿐인 라우트(가드 1단계가 본다).
 */
const ID_QUERIES = ['staffId', 'memberId'];

interface Route {
  name: string;
  path: string;
  params: string[];
  idQueries: string[];
  scoped?: ScopedResourceMeta;
  exempt?: string;
  isPublic: boolean;
  superOnly: boolean;
}

describe('지점 범위 선언 누락 검사(D46)', () => {
  let app: INestApplication;
  let routes: Route[];

  beforeAll(async () => {
    app = await createApp();
    routes = [];
    for (const mod of app.get(ModulesContainer).values()) {
      for (const wrapper of mod.controllers.values()) {
        const ctrl = wrapper.metatype as new (...args: never[]) => object;
        if (!ctrl) continue;
        const base = String(Reflect.getMetadata(PATH_METADATA, ctrl) ?? '');
        const classRoles: string[] | undefined = Reflect.getMetadata(ROLES_KEY, ctrl);
        for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
          const handler = (ctrl.prototype as Record<string, unknown>)[name];
          if (name === 'constructor' || typeof handler !== 'function') continue;
          const sub: string | undefined = Reflect.getMetadata(PATH_METADATA, handler);
          if (sub === undefined) continue; // 라우트가 아닌 메서드
          const path = `/${base}/${sub}`.replace(/\/+/g, '/');
          const args: Record<string, { data?: unknown }> = Reflect.getMetadata(ROUTE_ARGS_METADATA, ctrl, name) ?? {};
          const idQueries = Object.entries(args)
            .filter(([k, v]) => k.startsWith(`${RouteParamtypes.QUERY}:`) && ID_QUERIES.includes(String(v.data)))
            .map(([, v]) => String(v.data));
          const roles: string[] | undefined = Reflect.getMetadata(ROLES_KEY, handler) ?? classRoles;
          routes.push({
            name: `${ctrl.name}.${name} ${path}`,
            path,
            params: [...path.matchAll(/:(\w+)/g)].map((m) => m[1]),
            idQueries,
            scoped: Reflect.getMetadata(SCOPED_RESOURCE_KEY, handler),
            exempt: Reflect.getMetadata(BRANCH_SCOPE_EXEMPT_KEY, handler),
            isPublic: Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true,
            superOnly: roles?.length === 1 && roles[0] === 'SUPER_ADMIN',
          });
        }
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('라우트 표를 읽었다(대조군 — 0건이면 아래 검사가 공허하게 통과한다)', () => {
    expect(routes.length).toBeGreaterThan(50);
    expect(routes.filter((r) => r.scoped).length).toBeGreaterThan(20);
  });

  it('리소스 id를 받는 라우트는 모두 범위를 선언했다', () => {
    const missing = routes
      .filter((r) => !r.isPublic && !r.superOnly && !r.exempt && !r.scoped)
      .filter((r) => r.params.some((p) => p !== 'branchId') || r.idQueries.length > 0)
      .map((r) => r.name);
    expect(missing).toEqual([]);
  });

  it('선언이 가리키는 파라미터·쿼리가 실제 라우트에 있다(오타로 검사가 꺼지지 않게)', () => {
    const broken = routes
      .filter((r) => r.scoped)
      .filter(({ scoped, params, idQueries }) =>
        scoped!.source === 'param' ? !params.includes(scoped!.key) : scoped!.source === 'query' ? !idQueries.includes(scoped!.key) : false,
      )
      .map((r) => `${r.name} → ${r.scoped!.source}.${r.scoped!.key}`);
    expect(broken).toEqual([]);
  });

  it('면제에는 이유가 있다', () => {
    expect(routes.filter((r) => r.exempt !== undefined && r.exempt.trim().length < 5).map((r) => r.name)).toEqual([]);
  });
});
