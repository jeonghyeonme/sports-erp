import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentService } from './document.service';

// D34 — 문서 원천은 DB(DocumentService).
@Module({ controllers: [DocumentsController], providers: [DocumentService] })
export class DocumentsModule {}
