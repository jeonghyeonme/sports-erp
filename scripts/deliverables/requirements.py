"""요구사항 정의서(엑셀) 생성 — 원천은 저장소다.

    python3 scripts/deliverables/requirements.py   → docs/deliverables/요구사항정의서.xlsx

- RFP 추적·충족 판정·미구현·범위 제외: docs/reference/요구사항추적표.md §1·§3·§2-3·§2-4
- 도메인별 원문 요구(기능·품질)·불변규칙·설계 결정·범위 제외: docs/domains/<도메인>.md
- 기능 명세: apps/api/src의 실제 컨트롤러 라우트(경로·권한) + 관리자 웹·회원 웹이 실제로 부르는 경로(화면 유무)
  — 설명(ROUTE_DESC)만 사람이 쓴다. 라우트가 추가되면 설명이 비어 경고가 뜬다.
- 자동 테스트: apps/api/test/*.spec.ts 파일명
"""
import re
import subprocess
from datetime import date
from pathlib import Path

from openpyxl import Workbook

import xlsx_style as X

ROOT = Path(__file__).resolve().parents[2]
DOMAINS = ROOT / 'docs/domains'
TRACE = ROOT / 'docs/reference/요구사항추적표.md'
API = ROOT / 'apps/api/src'
WEBS = {'관리자 웹': ROOT / 'apps/admin-web/src', '회원 웹': ROOT / 'apps/member-web/src'}
TESTS = ROOT / 'apps/api/test'
OUT = ROOT / 'docs/deliverables/요구사항정의서.xlsx'

# 도메인 — (시트 이름, 문서 파일, ID 접두어, 컨트롤러 경로 접두어)
DOMAIN_LIST = [
    ('권한관리', '권한관리.md', 'AUTH', ['/auth', '/permissions']),
    ('인사정보관리', '인사정보관리.md', 'STF', ['/staff', '/staff-change-requests']),
    ('근태관리', '근태관리.md', 'ATT', ['/attendance', '/leave-requests', '/leave-balance', '/work-logs']),
    ('게시판', '게시판.md', 'BRD', ['/posts']),
    ('회원관리', '회원관리.md', 'MEM', ['/members']),
    ('예약및결제', '예약및결제.md', 'RSV', ['/reservations', '/payments']),
    ('강사프로그램게시', '강사프로그램게시.md', 'PRG', ['/programs', '/instructors', '/branches/:branchId/programs']),
    ('혼잡도관리', '혼잡도관리.md', 'FAC', ['/facilities']),
    ('자원문서관리', '자원문서관리.md', 'RES', ['/assets', '/documents']),
]
COMMON_PREFIX = ['/branches', '/audit-logs', '/support-requests', '/health']  # 도메인에 안 묶이는 것 — /audit-logs는 공통(사용자 결정 2026-10-14)
LOCAL_ONLY = ['/dev-storage']  # 로컬·테스트 메모리 저장소 경로(D57) — 배포에 없는 기능이라 명세에서 뺀다

ROUTE_DESC = {
    'POST /auth/login': '이메일·비밀번호 로그인 — 액세스·리프레시 토큰 발급, 비활성 계정 차단',
    'POST /auth/refresh': '리프레시 토큰으로 재발급(1회용 교체)',
    'POST /auth/logout': '로그아웃 — 리프레시 토큰 폐기',
    'GET /auth/me': '내 계정 정보',
    'GET /inbox': '처리 대기함 — 역할별 지금 처리할 일 건수(D61)',
    'PATCH /auth/password': '비밀번호 변경 — 현재 비밀번호 확인, 변경 시 리프레시 토큰 전부 폐기, 데모 계정 403(ADR-AUTH-05)',
    'GET /permissions/staff': '직원 계정과 역할 목록(본사)',
    'PATCH /permissions/staff/:staffId/role': '직원 역할 전환(지점 관리자 ↔ 직원, 본사)',
    'GET /permissions/catalog': '세부 권한 기능·동작 목록과 역할별 상한(본사, D60)',
    'GET /permissions/roles': '역할 기본 권한 표 — 지점 관리자·직원(본사, D60)',
    'PUT /permissions/roles/:role': '역할 기본 권한 한 칸 변경(본사, 변경 이력, D60)',
    'GET /permissions/staff/:staffId/overrides': '직원 개인 권한 — 역할 기본값·개인 예외·적용 값(본사, D60)',
    'PUT /permissions/staff/:staffId/overrides': '직원 개인 권한 한 칸 변경(기본/허용/차단, 본사, 변경 이력, D60)',
    'GET /staff': '직원 목록(본사 전체, 지점 관리자는 자기 지점) — 전화번호 마스킹, ?unassigned=true는 재배치 대기(ADR-STF-08)',
    'GET /staff/me': '내 직원 정보',
    'GET /staff/:id': '직원 상세 — 관리자가 열면 열람 기록(PHONE_VIEWED, D47)',
    'POST /staff': '직원 채용 — 계정·직원·첫 파견을 함께 생성(본사만)',
    'PATCH /staff/:id': '직원 정보 수정',
    'POST /staff-change-requests': '인사 변경 신청(직원 본인 — 연락처 등, ADR-STF-09)',
    'GET /staff-change-requests/mine': '내 인사 변경 신청 목록',
    'GET /staff-change-requests': '인사 변경 신청 목록(지점 관리자는 자기 지점, 본사는 조회)',
    'DELETE /staff-change-requests/:id': '인사 변경 신청 취소(대기 중일 때 본인)',
    'PATCH /staff-change-requests/:id/approve': '인사 변경 승인 — 직원 정보에 반영, 변경 이력 기록(지점 관리자 1단계 승인)',
    'PATCH /staff-change-requests/:id/reject': '인사 변경 반려(사유)',
    'PATCH /staff/:id/resign': '퇴사 처리 — 계정 비활성화, 파견 종료, 담당 회원 해제, 인사서류 보존기한 재계산(지점 관리자. 계약 종료 지점 직원은 본사도 — ADR-STF-08)',
    'POST /staff/:id/assignments': '파견 발령(재배치) — 옛 지점 담당 회원 해제, 계약 종료 지점으로는 409(본사만)',
    'GET /staff/:id/assignments': '파견 이력',
    'POST /attendance/check-in': '출근 체크 — 하루 1회, 지각 자동 판정',
    'POST /attendance/check-out': '퇴근 체크',
    'GET /attendance': '근태 기록 조회(범위별)',
    'GET /attendance/summary': '지점 월별 근태 요약',
    'PUT /attendance/:staffId/:date': '관리자 근태 정정·누락일 등록 — 사유 필수, 변경 이력 기록(ADR-ATT-04)',
    'GET /attendance/absence-preview': '결근 예정 미리보기(저장 안 함)',
    'POST /attendance/absence-confirm': '결근 확정(지점 관리자의 명시적 확정)',
    'POST /leave-requests': '휴가 신청',
    'GET /leave-requests': '휴가 신청 목록',
    'PATCH /leave-requests/:id/approve': '휴가 승인 — 승인 시점에 연차 차감',
    'PATCH /leave-requests/:id/reject': '휴가 반려',
    'GET /leave-balance/:staffId': '연차 잔여 조회',
    'POST /work-logs': '업무일지 작성(하루 1건)',
    'GET /work-logs': '업무일지 조회',
    'GET /posts': '게시글 목록 — 범위별 권한, 회원 공개 필터, 페이지네이션',
    'GET /posts/:id': '게시글 상세 — 조회수 증가',
    'POST /posts': '게시글 작성 — 계약 종료 지점 차단',
    'PATCH /posts/:id': '게시글 수정(작성자)',
    'DELETE /posts/:id': '게시글 삭제(소프트, 작성자 또는 본사)',
    'POST /posts/:id/attachments/upload-url': '첨부 업로드 URL 발급(작성자) — 형식·크기·개수 검사, 1회용 서명 URL(ADR-BRD-04·D57)',
    'POST /posts/:id/attachments': '첨부 붙이기 — 저장소의 실제 크기·형식 재확인, 글당 5개',
    'GET /posts/:id/attachments/:attachmentId/download': '첨부 내려받기 URL(글을 볼 수 있는 사람, 60초)',
    'DELETE /posts/:id/attachments/:attachmentId': '첨부 삭제(작성자 또는 본사)',
    'POST /members/register': '회원 자체 가입(공개) — 회원 웹 /signup(지점 선택은 공개 지점 목록, ADR-MEM-05)',
    'POST /members/link': '오프라인 회원 ↔ 온라인 계정 연동(공개, 회원번호+전화번호 동시 일치, 시도 제한) — 회원 웹 /link',
    'GET /members': '회원 목록(지점 범위) — 페이지네이션(D43), 전화번호 마스킹(ADR-MEM-04)',
    'GET /members/:id': '회원 상세 + 요약(수강·PT·예약) — 관리자가 열면 열람 기록(PHONE_VIEWED, D47)',
    'POST /members': '회원 등록 — 미성년 보호자 동의 확인, 계약 종료 지점 차단',
    'PATCH /members/:id': '회원 정보 수정',
    'PATCH /members/:id/status': '회원 상태 전환(활성·휴면·탈퇴)',
    'GET /members/:id/enrollments': '수강 내역',
    'POST /members/:id/enrollments': '수강 등록',
    'GET /members/:id/pt-sessions': 'PT 세션권 목록',
    'POST /members/:id/pt-sessions': 'PT 세션권 등록',
    'POST /members/:id/pt-sessions/:sessionId/use': 'PT 1회 차감',
    'POST /reservations': '회차 예약 — 회차 잠금, 지점·계약·지난 회차(409)·중복·정원 확인',
    'GET /reservations': '예약 목록(범위별, 페이지네이션 D43)',
    'PATCH /reservations/:id/cancel': '예약 취소 — 마감 전이면 환불',
    'PATCH /reservations/:id/check-in': '현장 체크인(완료 처리)',
    'POST /payments/:reservationId/mock-pay': '모의 결제 승인 → 예약 확정(대기일 때 한 번만)',
    'GET /payments': '결제 내역(매출, 기간 필터·페이지네이션)',
    'GET /programs': '프로그램 목록',
    'POST /programs': '프로그램 등록',
    'PATCH /programs/:id': '프로그램 수정',
    'PATCH /programs/:id/status': '프로그램 상태 전이(준비중·진행중·휴강·종료) — 영향받는 예약 반환',
    'DELETE /programs/:id': '프로그램 종료(소프트)',
    'GET /programs/:id/slots': '회차 목록·잔여 좌석',
    'POST /programs/:id/slots': '회차 등록',
    'GET /instructors': '강사 목록',
    'POST /instructors': '강사 등록',
    'PATCH /instructors/:id': '강사 수정',
    'DELETE /instructors/:id': '강사 비활성화',
    'GET /branches/:branchId/programs/summary': '지점별 프로그램 상태 요약',
    'GET /facilities': '시설 목록 + 현재 혼잡도',
    'POST /facilities': '시설 등록',
    'PATCH /facilities/:id': '시설 수정·비활성화',
    'POST /facilities/:id/congestion/manual': '혼잡도 수동 보정(인원 입력 → 5단계 자동 계산)',
    'GET /assets': '자산·비품 목록(페이지네이션 D43)',
    'POST /assets': '자산 등록 — 자산코드 자동 채번, 계약 종료 지점 차단',
    'PATCH /assets/:id': '자산 정보 수정',
    'PATCH /assets/:id/status': '자산 상태 전이(사용·수리·폐기 등)',
    'GET /documents': '문서 목록',
    'GET /documents/retention-alerts': '보존기한 임박 문서(본사)',
    'GET /documents/:id': '문서 상세',
    'POST /documents': '문서 등록 — 계약서 보존기한 필수, 계약 종료 지점 차단',
    'DELETE /documents/:id': '문서 삭제(소프트, 본사)',
    'GET /branches': '지점 목록(계약 정보 포함)',
    'GET /branches/public': '공개 지점 목록(이름·지역만, 계약 종료 지점 제외) — 회원 웹 가입용(ADR-MEM-05)',
    'GET /branches/:branchId/performance': '지점 운영 실적 — 최근 3개월 매출·예약·완료·신규 회원(KST 월 기준)',
    'PATCH /branches/:branchId/contract-status': '계약 상태 변경(본사) — TERMINATED 전이 시 진행 중 파견 종료·재배치 대기 반환(ADR-STF-07)',
    'GET /audit-logs': '변경 이력 조회(본사) — 역할 전환·퇴사·파견 발령·파견 종료·전화번호 열람(D44·D47)',
    'POST /support-requests': '업무지원 요청 등록(지점 관리자 → 본사, D56)',
    'GET /support-requests': '업무지원 요청 목록(지점은 자기 지점, 본사는 전체)',
    'GET /support-requests/:id': '업무지원 요청 상세',
    'PATCH /support-requests/:id/status': '업무지원 요청 처리 상태 변경(본사)',
    'GET /health': '헬스체크(DB 미경유)',
}
ROLE_KO = {'SUPER_ADMIN': '본사', 'BRANCH_ADMIN': '지점', 'STAFF': '직원', 'MEMBER': '회원'}


def read(p):
    return Path(p).read_text(encoding='utf-8')


def md_table(lines):
    rows = []
    for l in lines:
        l = l.strip()
        if not l.startswith('|') or re.match(r'^\|[-\s|:]+\|$', l):
            continue
        rows.append([c.strip() for c in l.strip('|').split('|')])
    return rows


def clean(t):
    t = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', t)       # 링크
    t = re.sub(r'\*\*|`|~~', '', t)                        # 강조·코드·취소선
    return t.strip()


def section_lines(text, start_pat, end_pat):
    out, on = [], False
    for l in text.split('\n'):
        if re.match(start_pat, l):
            on = True
            continue
        if on and re.match(end_pat, l):
            break
        if on:
            out.append(l)
    return out


# ── 코드 실측 ──────────────────────────────────────────────────────────────
def api_routes():
    routes = []
    for f in sorted(API.rglob('*.controller.ts')):
        s = read(f)
        pre = re.search(r"@Controller\('?([^)']*)'?\)", s).group(1)
        cls = re.search(r"((?:@[^\n]*\n)*)export class", s)
        croles = re.findall(r"@Roles\(([^)]*)\)", cls.group(1)) if cls else []
        lines = s.split('\n')
        for i, l in enumerate(lines):
            m = re.match(r"\s*@(Get|Post|Patch|Put|Delete)\((?:'([^']*)')?\)", l)
            if not m:
                continue
            # 메서드 위아래 데코레이터 묶음
            block, j = [l], i - 1
            while j >= 0 and lines[j].strip().startswith('@'):
                block.append(lines[j]); j -= 1
            j = i + 1
            while j < len(lines) and lines[j].strip().startswith('@'):
                block.append(lines[j]); j += 1
            b = '\n'.join(block)
            roles = re.findall(r"@Roles\(([^)]*)\)", b) or croles
            path = '/' + '/'.join(x for x in [pre, m.group(2) or ''] if x)
            if any(path.startswith(x) for x in LOCAL_ONLY):
                continue
            if '@Public' in b:
                who = '공개'
            elif roles:
                who = ', '.join(ROLE_KO.get(r.strip(" '"), r) for r in roles[0].split(','))
            else:
                who = '로그인 사용자'
            routes.append((m.group(1).upper(), path, who))
    return routes


def web_paths(web_root):
    """한 웹 앱이 부르는 API 경로. 쓰기(POST/PATCH/DELETE)는 api.<method>(경로) 호출로, 조회(GET)는
    경로 문자열이 코드에 나오면(useApiList 같은 조회 헬퍼가 경로를 인자로 받는다) 화면이 있다고 본다.
    회원 웹의 화면 경로(/notices 등)는 API 경로와 겹치지 않아 오탐이 없다."""
    s = '\n'.join(read(p) for p in list(web_root.rglob('*.tsx')) + list(web_root.rglob('*.ts')))
    norm = lambda x: re.sub(r'\$\{[^}]+\}', ':p', x).split('?')[0].rstrip('/') or '/'
    out = set()
    for m in re.finditer(r"api\.(get|post|patch|put|delete)(?:<[^(]*>)?\(\s*[`']([^`']+)[`']", s):
        out.add((m.group(1).upper(), norm(m.group(2))))
    for m in re.finditer(r"[`'](/[a-z][^`'\s]*)[`']", s):
        out.add(('GET', norm(m.group(1))))
    return out


def has_screen(method, path, web):
    """web = {앱 이름: 경로 집합}. 이 라우트를 부르는 앱 이름 목록을 돌려준다.
    웹 쪽 변수(:p)는 라우트의 고정 세그먼트와도 맞출 수 있지만, 그 앞에 라우트 변수가 있을 때만이다
    (`/leave-requests/${id}/${action}` → /leave-requests/:id/approve). 앞에 변수가 없으면 맞추지 않는다 —
    `/branches/${id}`가 /branches/public으로 잡히던 오탐."""
    seg = path.strip('/').split('/')

    def seg_ok(i, a, b):
        return a == b or b.startswith(':') or (a == ':p' and any(x.startswith(':') for x in seg[:i]))

    apps = []
    for app, paths in web.items():
        for wm, wp in paths:
            if wm != method:
                continue
            ws_ = wp.strip('/').split('/')
            if len(ws_) == len(seg) and all(seg_ok(i, a, b) for i, (a, b) in enumerate(zip(ws_, seg))):
                apps.append(app)
                break
    return apps


def tests():
    # API 통합 테스트(test/) + 단위 테스트(src/**/*.spec.ts)
    return sorted(p.stem.replace('.spec', '') for p in list(TESTS.glob('*.spec.ts')) + list((ROOT / 'apps/api/src').rglob('*.spec.ts')))


# ── 문서 파싱 ──────────────────────────────────────────────────────────────
def parse_domain(fname):
    t = read(DOMAINS / fname)
    sec1 = section_lines(t, r'^## 1\.', r'^## 2\.')
    reqs, inv, kind = [], [], None
    for l in sec1:
        if l.startswith('### '):
            kind = l[4:].split(' ')[0]
            continue
        if kind in ('기능', '품질'):
            r = md_table([l])
            if r and r[0][0] != 'ID':
                reqs.append([r[0][0], kind, clean(r[0][1])])
        elif kind == '제약' and l.startswith('- '):
            reqs.append(['', '제약', clean(l[2:])])
        elif kind == '불변규칙':
            m = re.match(r'^\d+\.\s+(.*)', l)
            if m:
                inv.append(clean(m.group(1)))
    card = section_lines(t, r'^## 요약 카드', r'^## 0\.')
    adr = [[clean(c) for c in r[:3]] for r in md_table(card) if r and r[0].startswith('ADR-')]
    test_line = next((clean(l.split('**테스트**:', 1)[1]) for l in card if '**테스트**' in l), '')
    gaps = [clean(l.split(':', 1)[1]) for l in card if re.match(r'^- \*\*(미구현|범위 제외)', l)]
    stories = [clean(l[2:]) for l in section_lines(t, r'^## 0\.', r'^## 1\.') if l.startswith('- ')]
    return {'reqs': reqs, 'inv': inv, 'adr': adr, 'tests': test_line, 'gaps': gaps, 'stories': stories}


def parse_trace():
    t = read(TRACE)
    s11 = md_table(section_lines(t, r'^### 1-1\.', r'^### 1-2\.'))[1:]
    s12 = md_table(section_lines(t, r'^### 1-2\.', r'^### 1-3\.'))[1:]
    s13 = md_table(section_lines(t, r'^### 1-3\.', r'^---'))[1:]
    s23 = md_table(section_lines(t, r'^### 2-3\.', r'^### 2-4\.'))[1:]
    s24 = md_table(section_lines(t, r'^### 2-4\.', r'^---'))[1:]
    api_only = next((clean(l.split('**:', 1)[1]) for l in section_lines(t, r'^### 2-3\.', r'^### 2-4\.') if l.startswith('**API는 있고')), '')
    design_only = next((clean(l.split('**:', 1)[1]) for l in section_lines(t, r'^### 2-3\.', r'^### 2-4\.') if l.startswith('**설계는 있지만')), '')
    judge = md_table(section_lines(t, r'^## 3\.', r'^## 4\.'))
    judge_sum = [r for r in judge if r[0] in ('기능·성능(p.5)', '시스템~제약(p.6)', '과업·산출물·개념도', '**전체**')]
    judge_rows = [r for r in judge if re.match(r'^[A-Z]\d', r[0])]
    member_app = next((clean(l) for l in section_lines(t, r'^### 2-4\.', r'^---') if l.startswith('**대상 지점·회원 앱 형태')), '')
    return s11, s12, s13, s23, s24, api_only, design_only, member_app, judge_sum, judge_rows


def gap_status(row):
    # 요구사항추적표 §2-3의 '지금 상태'가 '부분'으로 시작하면 부분, 아니면 미구현
    return '부분' if clean(row[2]).startswith('부분') else '미구현'


# ── 작성 ──────────────────────────────────────────────────────────────────
def main():
    routes = api_routes()
    web = {app: web_paths(root) for app, root in WEBS.items()}
    commit = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    s11, s12, s13, s23, s24, api_only, design_only, member_app, judge_sum, judge_rows = parse_trace()
    missing_desc = [f'{m} {p}' for m, p, _ in routes if f'{m} {p}' not in ROUTE_DESC]
    all_rows = []  # 총괄

    wb = Workbook()
    ws = wb.active
    ws.title = '표지'

    # 도메인 시트
    used = set()
    domain_sheets = []
    for name, fname, code, prefixes in DOMAIN_LIST:
        d = parse_domain(fname)
        sh = wb.create_sheet(name)
        domain_sheets.append(name)
        r = X.title(sh, f'{name} — 요구사항', f'원천: docs/domains/{fname} · 기능 명세는 코드 실측({date.today().isoformat()} 저장소 기준)')
        if d['stories']:
            r = X.section(sh, r, '사용자 스토리', 6)
            for st in d['stories']:
                sh.cell(row=r, column=1, value='•').font = X.font()
                c = sh.cell(row=r, column=2, value=st); c.font = X.font()
                sh.merge_cells(start_row=r, start_column=2, end_row=r, end_column=6)
                r += 1
            r += 1
        # 원문 요구
        r = X.section(sh, r, '원문 요구(RFP 기반 재분류)', 6)
        r = X.header(sh, r, ['요구사항 ID', '구분', '내용', '', '', ''])
        data = []
        for k, (rid, kind, text) in enumerate(d['reqs'], 1):
            rid = rid or f'{code}-C{k:02d}'
            data.append([rid, kind, text, '', '', ''])
            all_rows.append([rid, name, f'원문 {kind}', text, '-', '-', ''])
        r = X.rows(sh, r, data)
        for rr in range(r - len(data), r):
            sh.merge_cells(start_row=rr, start_column=3, end_row=rr, end_column=6)
        r += 1
        # 불변규칙
        r = X.section(sh, r, '불변규칙(협의 불가)', 6)
        r = X.header(sh, r, ['요구사항 ID', '규칙', '', '', '', '검증'])
        data = []
        for k, t in enumerate(d['inv'], 1):
            rid = f'{code}-INV-{k:02d}'
            data.append([rid, t, '', '', '', '자동 테스트' if d['tests'] else '검증되지 않음'])
            all_rows.append([rid, name, '불변규칙', t, '구현', '-', d['tests']])
        r = X.rows(sh, r, data)
        for rr in range(r - len(data), r):
            sh.merge_cells(start_row=rr, start_column=2, end_row=rr, end_column=5)
        sh.cell(row=r, column=1, value='관련 테스트').font = X.font(True)
        c = sh.cell(row=r, column=2, value=d['tests'] or '없음'); c.font = X.font()
        sh.merge_cells(start_row=r, start_column=2, end_row=r, end_column=6)
        r += 2
        # 기능 명세
        r = X.section(sh, r, '기능 명세(실제 API 기준)', 6)
        r = X.header(sh, r, ['요구사항 ID', '기능', 'Method', 'Endpoint(/api/v1)', '권한', '상태'])
        data = []
        mine = [x for x in routes if any(x[1] == p or x[1].startswith(p + '/') for p in prefixes)]
        mine.sort(key=lambda x: (next(i for i, p in enumerate(prefixes) if x[1] == p or x[1].startswith(p + '/')), x[1], x[0]))
        for k, (m, p, who) in enumerate(mine, 1):
            used.add((m, p))
            rid = f'{code}-FN-{k:02d}'
            desc = ROUTE_DESC.get(f'{m} {p}', '(설명 없음)')
            screens = has_screen(m, p, web)
            if p in ('/auth/refresh', '/auth/logout', '/auth/me'):
                st = '구현(API, 화면 불필요)'
            elif screens:
                st = f'구현(API+화면: {"·".join(screens)})'
            elif p.startswith('/auth/') and p != '/auth/login':
                st = '구현(API, 화면 불필요)' if p in ('/auth/refresh', '/auth/logout', '/auth/me') else 'API만(화면 없음)'
            else:
                st = 'API만(화면 없음)'
            data.append([rid, desc, m, p, who, st])
            all_rows.append([rid, name, '기능', desc, '구현', '불필요' if '불필요' in st else ('있음' if st.startswith('구현(API+화면') else '없음'), f'{m} {p}'])
        r = X.rows(sh, r, data, status_col=5)
        r += 1
        # 설계 결정
        r = X.section(sh, r, '설계 결정(ADR)', 6)
        r = X.header(sh, r, ['ADR', '결정', '', '', '', '상태'])
        data = [[a[0], a[1], '', '', '', a[2]] for a in d['adr']]
        r = X.rows(sh, r, data, status_col=5)
        for rr in range(r - len(data), r):
            sh.merge_cells(start_row=rr, start_column=2, end_row=rr, end_column=5)
        if d['gaps']:
            r += 1
            r = X.section(sh, r, '미구현·범위 제외(도메인 문서 기준)', 6)
            for g in d['gaps']:
                c = sh.cell(row=r, column=1, value=g); c.font = X.font()
                c.alignment = X.Alignment(wrap_text=True, vertical='top')
                sh.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
                sh.row_dimensions[r].height = 30
                r += 1
        X.widths(sh, [16, 46, 9, 40, 22, 26])
        sh.sheet_view.showGridLines = False

    # 공통 라우트
    common = [x for x in routes if (x[0], x[1]) not in used]
    for k, (m, p, who) in enumerate(common, 1):
        all_rows.append([f'COM-FN-{k:02d}', '공통', '기능', ROUTE_DESC.get(f'{m} {p}', '(설명 없음)'), '구현',
                         '불필요' if p == '/health' else ('있음' if has_screen(m, p, web) else '없음'), f'{m} {p}'])

    # 미구현을 총괄에 추가
    for k, row in enumerate(s23, 1):
        all_rows.append([f'GAP-{k:02d}', 'RFP 공통', '미구현', f'{clean(row[1])} — {clean(row[2])}', gap_status(row), '-', clean(row[0])])

    # 총괄
    sh = wb.create_sheet('요구사항 총괄', 1)
    r = X.title(sh, '요구사항 총괄', '헤더 필터로 도메인·구분·상태별로 볼 수 있다. 위 집계는 아래 표를 세는 수식이다')
    stat_row = r
    labels = [('기능(API) 수', '기능', None), ('  └ 화면 있음', '기능', '있음'), ('  └ 화면 없음(API만)', '기능', '없음'),
              ('불변규칙 수', '불변규칙', None), ('RFP 미구현·부분 항목', '미구현', None)]
    r = X.header(sh, r, ['집계', '건수'])
    first_data_row = r + len(labels) + 2
    last_guess = first_data_row + len(all_rows)
    for lab, kind, scr in labels:
        sh.cell(row=r, column=1, value=lab).font = X.font(True)
        if scr:
            f = f'=COUNTIFS($C${first_data_row}:$C${last_guess},"{kind}",$F${first_data_row}:$F${last_guess},"{scr}")'
        else:
            f = f'=COUNTIF($C${first_data_row}:$C${last_guess},"{kind}")'
        c = sh.cell(row=r, column=2, value=f); c.font = X.font(); c.border = X.BORDER
        r += 1
    r += 1
    r = X.header(sh, r, ['요구사항 ID', '도메인', '구분', '내용', '상태', '화면', '근거·검증'])
    assert r == first_data_row, (r, first_data_row)
    r = X.rows(sh, r, all_rows, status_col=4, band_key=1)
    sh.auto_filter.ref = f'A{first_data_row-1}:G{r-1}'
    sh.freeze_panes = sh.cell(row=first_data_row, column=1)
    X.widths(sh, [16, 16, 12, 70, 10, 8, 50])
    sh.sheet_view.showGridLines = False

    # RFP 추적
    sh = wb.create_sheet('RFP 추적', 2)
    r = X.title(sh, 'RFP 추적표', '제안요청서(2022.06) 원문 요구 → 도메인 → 조정 내용과 근거. 원천: docs/reference/요구사항추적표.md §1')
    r = X.section(sh, r, '기능·성능 요구(원문 순번, 9번은 원문 결번)', 6)
    r = X.header(sh, r, ['#', '구분', '요구사항명', '원문 요약', '도메인', '조정 요약', '결정 근거'])
    r = X.rows(sh, r, [[clean(c) for c in (row[:3] + [row[3], row[4], row[5], row[6]])] for row in s11])
    r += 1
    r = X.section(sh, r, '시스템·데이터·인터페이스·보안·사업지원·제약 요구', 6)
    r = X.header(sh, r, ['#', '구분', '요구사항명', '원문 요약', '대응·조정'])
    r = X.rows(sh, r, [[clean(c) for c in row[:5]] for row in s12])
    r += 1
    r = X.section(sh, r, '과업1·과업2·산출물', 6)
    r = X.header(sh, r, ['원본 항목', '위치', '대응 문서', '비고'])
    r = X.rows(sh, r, [[clean(c) for c in row[:4]] for row in s13])
    X.widths(sh, [10, 12, 22, 50, 24, 60, 16])
    sh.sheet_view.showGridLines = False

    # RFP 충족 판정
    sh = wb.create_sheet('RFP 충족 판정', 3)
    r = X.title(sh, 'RFP 조항별 충족 판정', '원문 글머리(•) 하나를 한 조항으로 판정. 원천: docs/reference/요구사항추적표.md §3')
    r = X.section(sh, r, '집계 — 충족률은 (구현+조정) / (전체−해당 없음), 뒤 값은 부분까지 포함', 7)
    r = X.header(sh, r, ['범위', '조항', '구현', '조정', '부분', '미구현', '해당 없음', '충족률'])
    r = X.rows(sh, r, [[clean(c) for c in row[:8]] for row in judge_sum])
    r += 1
    r = X.kv(sh, r, [
        ('구현', '조항이 말한 것을 그대로 했다'),
        ('조정', '결과는 냈지만 방식을 바꿨고 근거 결정이 있다'),
        ('부분', '일부만 했다 — 빠진 부분은 미구현 시트'),
        ('미구현', '하지 않았다(의도적 제외 포함 — 비고에 사유)'),
        ('해당 없음', '발주기관·계약·대면 행위처럼 대상이 없다 — 분모에서 뺀다'),
    ])
    r += 1
    r = X.header(sh, r, ['ID', 'RFP', '조항(원문)', '판정', '근거·비고'])
    first = r
    r = X.rows(sh, r, [[clean(c) for c in row[:5]] for row in judge_rows], status_col=3)
    sh.auto_filter.ref = f'A{first-1}:E{r-1}'
    X.widths(sh, [10, 18, 52, 12, 70, 10, 10, 18])
    sh.sheet_view.showGridLines = False

    # 미구현
    sh = wb.create_sheet('미구현')
    r = X.title(sh, '미구현·부분 — RFP가 요구하는데 아직 없거나 일부만 있는 것', '의도적 범위 제외(다음 시트)와 구분한다. 원천: 요구사항추적표 §2-3(코드 실측)')
    r = X.header(sh, r, ['ID', 'RFP', '항목', '지금 상태(실측)', '상태'])
    r = X.rows(sh, r, [[f'GAP-{k:02d}', clean(row[0]), clean(row[1]), clean(row[2]), gap_status(row)] for k, row in enumerate(s23, 1)], status_col=4)
    r += 1
    r = X.section(sh, r, 'API는 있고 화면이 없는 것', 5)
    c = sh.cell(row=r, column=1, value=api_only); c.font = X.font(); c.alignment = X.Alignment(wrap_text=True, vertical='top')
    sh.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5); sh.row_dimensions[r].height = 36
    r += 2
    r = X.section(sh, r, '설계는 있지만 미구현인 도메인 규칙', 5)
    c = sh.cell(row=r, column=1, value=design_only); c.font = X.font(); c.alignment = X.Alignment(wrap_text=True, vertical='top')
    sh.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5); sh.row_dimensions[r].height = 36
    X.widths(sh, [10, 26, 30, 70, 10])
    sh.sheet_view.showGridLines = False

    # 범위 제외
    sh = wb.create_sheet('범위 제외')
    r = X.title(sh, '범위 제외 — 의도적으로 만들지 않은 것', '원천: 요구사항추적표 §2-4, 각 도메인 문서 부록 A-8')
    r = X.header(sh, r, ['도메인', '범위 제외 항목', '향후 확장'])
    r = X.rows(sh, r, [[clean(c) for c in row[:3]] for row in s24], status_col=None)
    r += 1
    r = X.section(sh, r, '대상 지점·회원 앱 형태', 3)
    # 제출본에는 결정 경위(D37 대체)를 빼고 지금 결정만 싣는다 — 경위는 요구사항추적표·D40에 있다.
    c = sh.cell(row=r, column=1, value=re.sub(r' — 2026-09-30 D37의 회원 앱 제외를 대체', '', member_app))
    c.font = X.font(); c.alignment = X.Alignment(wrap_text=True, vertical='top')
    sh.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3); sh.row_dimensions[r].height = 90
    X.widths(sh, [18, 80, 50])
    sh.sheet_view.showGridLines = False

    # 표지
    ws = wb['표지']
    r = X.title(ws, '스포이즘 ERP — 요구사항 정의서', '요구사항 총괄 · RFP 추적 · RFP 충족 판정 · 도메인별 요구사항 · 미구현 · 범위 제외')
    n_fn = sum(1 for x in all_rows if x[2] == '기능')
    r = X.kv(ws, r, [
        ('프로젝트', '스포이즘 ERP — 아파트·오피스텔 커뮤니티 시설 위탁운영 관리 시스템'),
        ('문서', '요구사항 정의서'),
        ('작성일', date.today().isoformat()),
        ('기준', f'{date.today().isoformat()} 저장소(dev 브랜치) — 도메인 문서·요구사항추적표·실제 API 라우트에서 자동 생성'),
        ('규모', f'도메인 {len(DOMAIN_LIST)}개 · 기능(API) {n_fn}개 · 불변규칙 {sum(1 for x in all_rows if x[2]=="불변규칙")}개 · '
               f'RFP 미구현·부분 {len(s23)}건 · 자동 테스트 파일 {len(tests())}개'),
        ('RFP 충족', next((f'조항 {clean(x[1])}개 중 해당 없음 {clean(x[6])}개를 뺀 충족률 {clean(x[7])}(구현+조정 / 부분 포함)' for x in judge_sum if '전체' in x[0]), '-')),
        ('범위', '관리자 웹(본사·지점 관리자·직원) + 회원 모바일 웹(/m/, 2026-10-09 배포) + REST API. 대상 지점은 수도권 83곳(지방 15곳 제외)'),
    ])
    r += 1
    r = X.section(ws, r, '요구사항 ID 규칙', 2)
    r = X.kv(ws, r, [
        ('F·Q + 번호', 'RFP 원문을 재분류한 기능(F)·품질(Q) 요구 — 도메인 문서 §1의 ID 그대로'),
        ('<도메인>-INV-nn', '불변규칙 — 어떤 경우에도 깨지면 안 되는 규칙'),
        ('<도메인>-FN-nn', '기능 명세 — 실제 API 하나에 하나'),
        ('GAP-nn', 'RFP가 요구하는데 아직 없거나 일부만 있는 항목'),
        ('F·N·T·P·C + 번호', 'RFP 조항 — 기능·성능(F, 원문 순번-글머리), 시스템~제약(N), 과업(T), 산출물(P), 개념도(C)'),
        ('도메인 약어', ', '.join(f'{c}={n}' for n, _, c, _ in DOMAIN_LIST) + ', COM=공통'),
    ])
    r += 1
    r = X.section(ws, r, '상태 표기', 2)
    r = X.kv(ws, r, [
        ('구현(API+화면)', 'API와 그것을 부르는 화면이 있다 — 괄호에 관리자 웹·회원 웹 중 어느 쪽인지 적는다'),
        ('API만', 'API는 있고 화면이 없다(사유를 괄호에 적음)'),
        ('미구현', 'RFP 요구인데 아직 없다'),
        ('범위 제외', '근거를 두고 의도적으로 만들지 않았다'),
        ('구현·조정·부분·해당 없음', 'RFP 충족 판정 시트의 판정(기준은 그 시트 위)'),
        ('검증', '자동 테스트는 API(jest)만 있다. 관리자 웹·회원 웹은 lint·빌드(타입체크)까지만 검증된다'),
    ])
    X.widths(ws, [20, 110])
    ws.sheet_view.showGridLines = False

    OUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUT)
    print(f'{OUT.relative_to(ROOT)} — 라우트 {len(routes)}(공통 {len(common)}), 총괄 {len(all_rows)}행, 시트 {wb.sheetnames}')
    if missing_desc:
        print('경고: 설명 없는 라우트', missing_desc)


if __name__ == '__main__':
    main()
