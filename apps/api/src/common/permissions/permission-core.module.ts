import { Global, Module } from '@nestjs/common';
import { PermissionService } from './permission.service';

// D60 — 가드(AppModule)와 권한 변경 API(PermissionsModule)가 같은 캐시를 쓰도록 전역 하나.
@Global()
@Module({ providers: [PermissionService], exports: [PermissionService] })
export class PermissionCoreModule {}
