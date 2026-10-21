import { Module } from '@nestjs/common';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';

// D61 — 처리 대기함.
@Module({ controllers: [InboxController], providers: [InboxService] })
export class InboxModule {}
