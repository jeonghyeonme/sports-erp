import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetService } from './asset.service';

// D35 — 자산 원천은 DB(AssetService).
@Module({ controllers: [AssetsController], providers: [AssetService] })
export class AssetsModule {}
