import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchScopeExempt, ScopedResource } from '../../common/decorators/scoped-resource.decorator';
import { ok } from '../../common/http/api-response';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DOCUMENT_SORT_KEYS, DocumentService } from './document.service';
import { pageMeta, parsePage, parseSort } from '../../common/http/pagination';
import { AppException } from '../../common/exceptions/app.exception';
import { RequestUploadDto } from '../posts/dto/attachment.dto';
import { Permission } from '../../common/permissions/permission.decorator';

// 자원문서관리 A-5·A-7 — SUPER_ADMIN 전체, BRANCH_ADMIN은 본인 지점+전사 문서. STAFF 본인 인사서류 조회는 범위 제외.
// D34 — 원천은 DB(DocumentService). D46 — 지점 범위(branchId·:id 소유·본문 relatedStaffId)는 전역 BranchScopeGuard가 본다.
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentService) {}

  // ADR-RES-04 — relatedStaffId(직원 인사서류, 인사기록 한 화면)는 그 직원의 현재 파견 지점으로 범위를 본다.
  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @ScopedResource('staff', { query: 'relatedStaffId' })
  // ADR-AUTH-09 — CSV(?export=true)는 출력 권한을 함께 본다
  @Permission('document', 'READ', { exportable: true })
  async list(
    @CurrentUser() user: RequestUser,
    @Query('branchId') branchId?: string,
    @Query('category') category?: string,
    @Query('relatedStaffId') relatedStaffId?: string,
    @Query('q') q?: string,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
    @Query('sort') sortQuery?: string,
    @Query('dir') dirQuery?: string,
  ) {
    // D43 — 쌓이는 목록이라 서버 쪽 나누기(D74 2차·D69 2차, log/206). 검색·정렬도 서버가.
    const page = parsePage(pageQuery, limitQuery);
    if (user.role === 'BRANCH_ADMIN' && !user.branchId) return ok([], pageMeta(page, 0));
    // BRANCH_ADMIN은 본인 지점 + 전사 문서(scopeBranchId). 가드가 branchId 쿼리도 본인 지점으로 고정한다 —
    // 지점 필터를 걸면 전사 문서가 빠지므로 BRANCH_ADMIN에게는 branchId 필터를 넘기지 않는다(이관 전 동작 유지).
    const scopeBranchId = user.role === 'BRANCH_ADMIN' ? user.branchId : undefined;
    const sort = parseSort(sortQuery, dirQuery, DOCUMENT_SORT_KEYS);
    const { items, total } = await this.documents.list(
      { scopeBranchId, branchId: scopeBranchId ? undefined : branchId, category, relatedStaffId, q },
      page,
      sort,
    );
    return ok(items, pageMeta(page, total));
  }

  // D69 2차(log/206) — 문서 파일 업로드 URL. 등록과 같은 권한(문서 입력). 경로는 지점과 무관(등록 때 지점을 본다).
  @Post('upload-url')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @BranchScopeExempt('업로드 URL은 지점 데이터가 아니다 — 지점·대상 직원은 등록(POST /documents)에서 본다')
  @Permission('document', 'CREATE')
  async requestUpload(@Body() dto: RequestUploadDto) {
    return ok(await this.documents.requestUpload(dto));
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
  @Permission('document', 'READ')
  async detail(@Param('id') id: string) {
    return ok(await this.documents.findById(id));
  }

  // D69 2차(log/206) — 문서 열기: 올린 파일은 60초 다운로드 URL, 옛 주소 문서는 그 주소. 열 때마다 열람 기록.
  @Get(':id/open')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @ScopedResource('document')
  @Permission('document', 'READ')
  async open(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return ok(await this.documents.open(id, user));
  }

  @Post()
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @ScopedResource('staff', { body: 'relatedStaffId', code: 'DOCUMENT_SCOPE_VIOLATION' })
  @Permission('document', 'CREATE')
  async create(@Body() dto: CreateDocumentDto, @CurrentUser() user: RequestUser) {
    const branchId = user.role === 'BRANCH_ADMIN' ? user.branchId : dto.branchId;
    // D69 2차 — 올린 파일 또는 옛 방식 주소 중 정확히 하나.
    const { file: fileRef, ...rest } = dto;
    if (!fileRef === !rest.fileUrl) {
      throw new AppException('DOCUMENT_FILE_REQUIRED', '문서 파일을 하나 올려 주세요.', 400);
    }
    // 저장소 확인은 트랜잭션 밖에서(외부 호출을 쓰기 트랜잭션에 넣지 않는다 — D70).
    const file = fileRef ? await this.documents.verifyFile(fileRef) : undefined;
    return ok(await this.documents.create(user.accountId, { ...rest, branchId, file }));
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @BranchScopeExempt('SUPER_ADMIN 전용 — 지점 범위가 없다')
  async remove(@Param('id') id: string) {
    await this.documents.softDelete(id);
    return ok({ id });
  }
}
