import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { AppException } from '../../common/exceptions/app.exception';
import { ok } from '../../common/http/api-response';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentService } from './document.service';

// 자원문서관리 A-5·A-7 — SUPER_ADMIN 전체, BRANCH_ADMIN은 본인 지점+전사 문서. STAFF 본인 인사서류 조회는 범위 제외.
// D34 — 원천은 DB(DocumentService).
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
    const scopeBranchId = user.role === 'BRANCH_ADMIN' ? user.branchId : undefined;
    return ok(await this.documents.list({ scopeBranchId, branchId, category }));
  }

  // 정적 경로라 `:id`보다 먼저 선언해야 한다.
  @Get('retention-alerts')
  @Roles('SUPER_ADMIN')
  async retentionAlerts() {
    return ok(await this.documents.retentionAlerts(30));
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  async detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const document = await this.documents.findById(id);
    // 권한 없는 문서는 존재 여부를 숨기지 않고 403(자원문서관리 A-9 체크리스트).
    if (user.role === 'BRANCH_ADMIN' && document.branchId && document.branchId !== user.branchId) {
      throw new AppException('DOCUMENT_SCOPE_VIOLATION', '다른 지점의 문서는 조회할 수 없습니다.', 403);
    }
    return ok(document);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  async create(@Body() dto: CreateDocumentDto, @CurrentUser() user: RequestUser) {
    let branchId = dto.branchId;
    if (user.role === 'BRANCH_ADMIN') {
      branchId = user.branchId;
      if (dto.relatedStaffId) {
        const staffBranchId = await this.documents.staffBranchId(dto.relatedStaffId);
        if (staffBranchId && staffBranchId !== user.branchId) {
          throw new AppException('DOCUMENT_SCOPE_VIOLATION', '다른 지점 직원의 서류는 등록할 수 없습니다.', 403);
        }
      }
    }
    return ok(await this.documents.create(user.accountId, { ...dto, branchId }));
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  async remove(@Param('id') id: string) {
    await this.documents.softDelete(id);
    return ok({ id });
  }
}
