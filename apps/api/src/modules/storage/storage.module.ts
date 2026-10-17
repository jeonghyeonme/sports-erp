import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { DevStorageController } from './dev-storage.controller';

// D57 — 첨부 파일 저장소(서명 URL). 게시판 첨부가 쓴다.
@Global()
@Module({ controllers: [DevStorageController], providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
