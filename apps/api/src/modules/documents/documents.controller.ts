import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchScopeExempt, ScopedResource } from '../../common/decorators/scoped-resource.decorator';
import { ok } from '../../common/http/api-response';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentService } from './document.service';

// 자원문서관리 A-5·A-7 — SUPER_ADMIN 전체, BRANCH_ADMIN은 본인 지점+전사 문서. STAFF 본인 인사서류 조회는 범위 제외.
// D34 — 원천은 DB(DocumentService). D46 — 지점 범위(branchId·:id 소유·본문 relatedStaffId)는 전역 BranchScopeGuard가 본다.
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  async list(
    @CurrentUser() user: RequestUser,
    @Query('branchId') branchId?: string,
    @Query('category') category?: string,
  ) {
    if (user.role === 'BRANCH_ADMIN' && !user.branchId) return ok([]);
    // BRANCH_ADMIN은 본인 지점 + 전사 문서(scopeBranchId). 가드가 branchId 쿼리도 본인 지점으로 고정한다 —
    // 지점 필터를 걸면 전사 문서가 빠지므로 BRANCH_ADMIN에게는 branchId 필터를 넘기지 않는다(이관 전 동작 유지).
    const scopeBranchId = user.role === 'BRANCH_ADMIN' ? user.branchId : undefined;
    return ok(await this.documents.list({ scopeBranchId, branchId: scopeBranchId ? undefined : branchId, category }));
  }

  // 정적 경로라 `:id`보다 먼저 선언해야 한다.
  @Get('retention-alerts')
  @Roles('SUPER_ADMIN')
  async retentionAlerts() {
    return ok(await this.documents.retentionAlerts(30));
  }

  // 권한 없는 문서는 존재 여부를 숨기지 않고 403(자원문서관리 A-9 체크리스트). 전사 문서는 모든 지점에 공개.
  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @ScopedResource('document')
  async detail(@Param('id') id: string) {
    return ok(await this.documents.findById(id));
  }

  @Post()
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @ScopedResource('staff', { body: 'relatedStaffId', code: 'DOCUMENT_SCOPE_VIOLATION' })
  async create(@Body() dto: CreateDocumentDto, @CurrentUser() user: RequestUser) {
    const branchId = user.role === 'BRANCH_ADMIN' ? user.branchId : dto.branchId;
    return ok(await this.documents.create(user.accountId, { ...dto, branchId }));
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @BranchScopeExempt('SUPER_ADMIN 전용 — 지점 범위가 없다')
  async remove(@Param('id') id: string) {
    await this.documents.softDelete(id);
    return ok({ id });
  }
}
