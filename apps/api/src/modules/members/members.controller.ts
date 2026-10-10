import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ScopedResource } from '../../common/decorators/scoped-resource.decorator';
import { MemberService } from './member.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ok } from '../../common/http/api-response';
import { pageMeta, parsePage } from '../../common/http/pagination';
import { maskPhones } from '../../common/privacy/mask-phone';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { CreatePTSessionDto } from './dto/create-pt-session.dto';
import { UsePTSessionDto } from './dto/use-pt-session.dto';
import { LinkMemberDto } from './dto/link-member.dto';
import { RegisterMemberDto } from './dto/register-member.dto';
import { AuthService } from '../auth/auth.service';

// 회원관리 A-7 — STAFF는 회원 관리 API 접근 불가(403). MEMBER는 본인 레코드만 GET/PATCH 가능.
// D32 — 원천은 DB(MemberService). D46 — 범위 검사(BRANCH_ADMIN 본인 지점 / MEMBER 본인 / SUPER_ADMIN 전체)는
// 전역 BranchScopeGuard가 @ScopedResource('member')로 한다. 회원관리 A-7상 쓰기 범위는 조회 범위와 같다.
@Controller('members')
export class MembersController {
  constructor(
    private readonly memberService: MemberService,
    private readonly authService: AuthService,
  ) {}

  // ADR-MEM-01 — 오프라인 등록 회원이 회원번호+전화번호로 본인을 증명하고 앱 계정을 새로 연동한다.
  // 인증이 없는 공개 라우트라 컨트롤러 어디보다도 먼저 둔다(다른 :id 라우트와 매칭 순서가 안 겹치도록).
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('link')
  async link(@Body() dto: LinkMemberDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const accountId = await this.memberService.link({
      memberNo: dto.memberNo,
      phone: dto.phone,
      email: dto.email,
      passwordHash,
    });
    return ok(await this.authService.issueSessionFor(accountId));
  }

  // ADR-MEM-02 — 앱 회원가입. Account+Member를 동시에 만들고 바로 로그인시킨다(회원관리 §0 사용자 스토리).
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  async register(@Body() dto: RegisterMemberDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { member, accountId, warnings } = await this.memberService.register({
      branchId: dto.branchId,
      name: dto.name,
      email: dto.email,
      passwordHash,
      phone: dto.phone,
      birthDate: dto.birthDate,
      gender: dto.gender,
      guardianConsent: dto.guardianConsent,
    });
    return ok(
      { ...(await this.authService.issueSessionFor(accountId)), member },
      warnings.length ? { warnings } : undefined,
    );
  }

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  async list(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('assignedStaffId') assignedStaffId?: string,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
  ) {
    // D43 — offset 페이지네이션(page·limit, 상한 100). 지점 범위는 BranchScopeGuard가 branchId로 강제한다.
    const page = parsePage(pageQuery, limitQuery);
    const { items, total } = await this.memberService.list({ branchId, status, q, assignedStaffId }, page);
    // ADR-MEM-04 — 목록은 역할과 무관하게 전화번호를 마스킹한다. 검색(q)은 서버에서 원문으로 맞춘다.
    return ok(maskPhones(items), pageMeta(page, total));
  }

  // ADR-MEM-03 — 상세 진입 시 무거운 조인 대신 요약 카운트만 포함, 탭 클릭 시 아래 개별 API로 지연 로드.
  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'MEMBER')
  @ScopedResource('member')
  async detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const member = await this.memberService.view(id);
    // D47 — 상세는 전화번호 원문을 준다(ADR-MEM-04)라 관리자 열람을 남긴다. 요청당 INSERT 1회(D42).
    await this.memberService.recordPhoneView(user, member);
    return ok({ ...member, ...(await this.memberService.summary(id)) });
  }

  @Post()
  @Roles('BRANCH_ADMIN')
  async create(@Body() dto: CreateMemberDto, @CurrentUser() user: RequestUser) {
    if (!user.branchId) {
      throw new AppException('BRANCH_REQUIRED', '소속 지점이 없는 계정입니다.', 403);
    }
    const { member, warnings } = await this.memberService.create(user.branchId, dto);
    return ok(member, warnings.length ? { warnings } : undefined);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'MEMBER')
  @ScopedResource('member')
  async update(@Param('id') id: string, @Body() dto: UpdateMemberDto, @CurrentUser() user: RequestUser) {
    if (user.role === 'MEMBER' && (dto.assignedStaffId !== undefined || dto.memo !== undefined)) {
      throw new AppException(
        'MEMBER_FIELD_FORBIDDEN',
        '담당 직원/메모는 지점 관리자만 수정할 수 있습니다.',
        403,
      );
    }
    return ok(await this.memberService.update(id, dto));
  }

  @Patch(':id/status')
  @Roles('BRANCH_ADMIN')
  @ScopedResource('member')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateMemberStatusDto) {
    return ok(await this.memberService.updateStatus(id, dto.status));
  }

  // ADR-MEM-03 — 수강내역 탭. 예약(Reservation)과 별개로 "이 회원이 이 프로그램을 듣고 있다"는 등록 사실.
  @Get(':id/enrollments')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'MEMBER')
  @ScopedResource('member')
  async listEnrollments(@Param('id') id: string) {
    return ok(await this.memberService.listEnrollments(id));
  }

  @Post(':id/enrollments')
  @Roles('BRANCH_ADMIN')
  @ScopedResource('member')
  async createEnrollment(@Param('id') id: string, @Body() dto: CreateEnrollmentDto) {
    return ok(await this.memberService.createEnrollment(id, dto));
  }

  // ADR-MEM-03 — PT 잔여세션 탭. PT_PACKAGE 결제 연동은 범위 제외라 관리자가 구매를 직접 등록한다.
  @Get(':id/pt-sessions')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'MEMBER')
  @ScopedResource('member')
  async listPTSessions(@Param('id') id: string) {
    return ok(await this.memberService.listPTSessions(id));
  }

  @Post(':id/pt-sessions')
  @Roles('BRANCH_ADMIN')
  @ScopedResource('member')
  async createPTSession(@Param('id') id: string, @Body() dto: CreatePTSessionDto) {
    return ok(await this.memberService.createPTSession(id, dto));
  }

  @Post(':id/pt-sessions/:sessionId/use')
  @Roles('BRANCH_ADMIN')
  @ScopedResource('member')
  async usePTSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: UsePTSessionDto,
  ) {
    const session = await this.memberService.findPTSession(sessionId);
    if (!session || session.memberId !== id) {
      throw new AppException('PT_SESSION_NOT_FOUND', 'PT 세션을 찾을 수 없습니다.', 404);
    }
    return ok(await this.memberService.usePTSession(sessionId, dto.note));
  }
}
