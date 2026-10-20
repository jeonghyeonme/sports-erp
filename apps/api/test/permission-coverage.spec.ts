import { INestApplication } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator';
import { ROLES_KEY } from '../src/common/decorators/roles.decorator';
import { FeatureDef, GOVERNED_ROLES, PERMISSION_CATALOG } from '../src/common/permissions/permission-catalog';
import { PERMISSION_EXEMPT_KEY, PERMISSION_KEY, PermissionMeta } from '../src/common/permissions/permission.decorator';
import { createApp } from './helpers/app';

/**
 * D60 — 세부 권한 선언 누락 검사(branch-scope-coverage와 같은 방식). 지점 관리자·직원이 닿을 수 있는 라우트는
 * 모두 @Permission(feature, action) 또는 이유를 단 @PermissionExempt를 가져야 한다. 카탈로그의 상한 칸마다
 * 그 역할이 실제로 닿는 라우트가 하나 이상 있어야 한다(쓰이지 않는 칸 = 카탈로그와 코드가 어긋남).
 */
interface Route {
  name: string;
  roles?: string[];
  isPublic: boolean;
  permission?: PermissionMeta;
  exempt?: string;
}

describe('세부 권한 선언 누락 검사(D60)', () => {
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
          if (sub === undefined) continue;
          routes.push({
            name: `${ctrl.name}.${name} /${base}/${sub}`.replace(/\/+/g, '/'),
            roles: Reflect.getMetadata(ROLES_KEY, handler) ?? classRoles,
            isPublic: Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true,
            permission: Reflect.getMetadata(PERMISSION_KEY, handler),
            exempt: Reflect.getMetadata(PERMISSION_EXEMPT_KEY, handler),
          });
        }
      }
    }
  });
  afterAll(async () => {
    await app.close();
  });

  const reachable = (r: Route, role: string) => !r.isPublic && (!r.roles || r.roles.includes(role));

  it('라우트 표를 읽었다(대조군)', () => {
    expect(routes.length).toBeGreaterThan(80);
    expect(routes.filter((r) => r.permission).length).toBeGreaterThan(50);
  });

  it('지점 관리자·직원이 닿는 라우트는 모두 세부 권한을 선언하거나 면제 이유를 단다', () => {
    const missing = routes
      .filter((r) => GOVERNED_ROLES.some((role) => reachable(r, role)))
      .filter((r) => !r.permission && !r.exempt)
      .map((r) => r.name);
    expect(missing).toEqual([]);
  });

  it('선언한 기능·동작은 카탈로그에 있는 칸이다', () => {
    const catalog = PERMISSION_CATALOG as Record<string, FeatureDef>;
    const unknown = routes
      .filter((r) => r.permission)
      .filter((r) => {
        const def = catalog[r.permission!.feature];
        const actions = [r.permission!.action, ...(r.permission!.exportable ? (['EXPORT'] as const) : [])];
        return !def || actions.some((a) => !Object.values(def.ceiling).some((list) => list?.includes(a)));
      })
      .map((r) => r.name);
    expect(unknown).toEqual([]);
  });

  it('카탈로그의 상한 칸마다 그 역할이 닿는 라우트가 있다', () => {
    const unused: string[] = [];
    for (const [feature, def] of Object.entries(PERMISSION_CATALOG as Record<string, FeatureDef>)) {
      for (const role of GOVERNED_ROLES) {
        for (const action of def.ceiling[role] ?? []) {
          const used = routes.some(
            (r) =>
              r.permission?.feature === feature &&
              (r.permission.action === action || (action === 'EXPORT' && r.permission.exportable)) &&
              reachable(r, role),
          );
          if (!used) unused.push(`${role} ${feature}:${action}`);
        }
      }
    }
    expect(unused).toEqual([]);
  });
});
