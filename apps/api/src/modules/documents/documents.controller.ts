import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { MockDataService } from '../../mock-data/mock-data.service';
import { AppException } from '../../common/exceptions/app.exception';
import { MockDocument } from '../../mock-data/mock-data.types';
import { ok } from '../../common/http/api-response';
import { CreateDocumentDto } from './dto/create-document.dto';

// 1-10문서 §5-5·§5-7 — SUPER_ADMIN 전체, BRANCH_ADMIN은 본인 지점+전사 문서. STAFF 본인 인사서류 조회는 범위 제외.
@Controller('documents')
export class DocumentsController {
  constructor(private readonly mockData: MockDataService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  list(
    @CurrentUser() user: RequestUser,
    @Query('branchId') branchId?: string,
    @Query('category') category?: string,
  ) {
    let documents = this.mockData.documents.filter((d) => !d.deletedAt);
    if (user.role === 'BRANCH_ADMIN') {
      documents = documents.filter((d) => !d.branchId || d.branchId === user.branchId);
    }
    if (branchId) documents = documents.filter((d) => d.branchId === branchId);
    if (category) documents = documents.filter((d) => d.category === category);
    return ok(documents.map((d) => this.toListItem(d)));
  }

  // 정적 경로라 `:id`보다 먼저 선언해야 한다.
  @Get('retention-alerts')
  @Roles('SUPER_ADMIN')
  retentionAlerts() {
    return ok(this.mockData.listRetentionAlerts(30).map((d) => this.toListItem(d)));
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const document = this.findDocumentOrThrow(id);
    this.assertCanView(document, user);
    return ok(this.toListItem(document));
  }

  @Post()
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  create(@Body() dto: CreateDocumentDto, @CurrentUser() user: RequestUser) {
    let branchId = dto.branchId;
    if (user.role === 'BRANCH_ADMIN') {
      branchId = user.branchId;
      if (dto.relatedStaffId) {
        const staff = this.mockData.findStaffById(dto.relatedStaffId);
        if (staff && staff.branchId !== user.branchId) {
          throw new AppException('DOCUMENT_SCOPE_VIOLATION', '다른 지점 직원의 서류는 등록할 수 없습니다.', 403);
        }
      }
    }
    return ok(this.toListItem(this.mockData.createDocument(user.accountId, { ...dto, branchId })));
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  remove(@Param('id') id: string) {
    this.mockData.deleteDocument(id);
    return ok({ id });
  }

  private toListItem(document: MockDocument) {
    return {
      ...document,
      branchName: document.branchId ? this.mockData.findBranchById(document.branchId)?.name : undefined,
      relatedStaffName: document.relatedStaffId
        ? this.mockData.findStaffById(document.relatedStaffId)?.name
        : undefined,
      uploadedByName: this.mockData.findAccountById(document.uploadedBy)?.name,
    };
  }

  private findDocumentOrThrow(id: string): MockDocument {
    const document = this.mockData.findDocumentById(id);
    if (!document) {
      throw new AppException('DOCUMENT_NOT_FOUND', '문서를 찾을 수 없습니다.', 404);
    }
    return document;
  }

  // 권한 없는 문서는 존재 여부를 숨기지 않고 403(§5-9 체크리스트).
  private assertCanView(document: MockDocument, user: RequestUser): void {
    if (user.role === 'BRANCH_ADMIN' && document.branchId && document.branchId !== user.branchId) {
      throw new AppException('DOCUMENT_SCOPE_VIOLATION', '다른 지점의 문서는 조회할 수 없습니다.', 403);
    }
  }
}
