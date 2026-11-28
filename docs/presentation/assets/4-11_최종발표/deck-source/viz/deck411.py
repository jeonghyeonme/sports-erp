# 4-11 최종 발표 덱 생성기 — 13주차 생성기(4-10 deck410.py)와 같은 색·글꼴·머리말·카드·프레임(4-0 §4).
# 사용: python3 viz/deck411.py deck-out   → deck-out/project/{deck.json, deck.css, slides/*.html}
# 부하 숫자는 13주차 data/loadtest.json을 그대로 읽는다(원천 log/239). 캡처는 쓰지 않는다(도식·숫자로).
# x-icon 이름은 Slides가 아는 것만(format.md 목록). 게시본은 사용자가 편집기에서 고친다 — 다시 올리기 전에 그 장을 읽는다.
import json, os, sys, datetime

OUT = sys.argv[1] if len(sys.argv) > 1 else 'deck-out'
HERE = os.path.dirname(os.path.abspath(__file__))
DOTS = open(os.path.join(OUT, 'dots.svg'), encoding='utf-8').read().strip()
LT = json.load(open(os.path.join(HERE, '..', '..', '..', '4-10_13주차발표', 'deck-source', 'data', 'loadtest.json'), encoding='utf-8'))

INK, SUB, NAVY, AMBER, GREEN, LINE, LINE2, BG, CARDBG, SOFT = '#14191C', '#4B5563', '#1E3A5F', '#9A5A0C', '#187650', '#E1E4E1', '#CBD0CD', '#F4F5F3', '#FFFFFF', '#EBEEEC'
BODYF = "'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"
HEADF = "'Gothic A1', 'Noto Sans KR', 'Malgun Gothic', sans-serif"
MONOF = "'JetBrains Mono', 'Noto Sans KR', Consolas, monospace"
SHADOW = 'box-shadow:0 1px 2px rgba(20,25,28,0.05), 0 14px 32px -18px rgba(20,25,28,0.28)'
CARD = f'display:flex; flex-direction:column; gap:14px; background:{CARDBG}; border:1px solid {LINE}; border-radius:14px; padding:36px; {SHADOW}'


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def label(t):
    return f'<p style="font-family:{MONOF}; font-size:24px; font-weight:600; letter-spacing:3px; color:{NAVY}">{t}</p>'


def h2(t):
    return f'<h2 style="font-family:{HEADF}; font-size:60px; font-weight:700; line-height:1.15; letter-spacing:-1px; color:{INK}">{t}</h2>'


def h3(t, size=34, color=INK):
    return f'<h3 style="font-family:{HEADF}; font-size:{size}px; font-weight:700; line-height:1.25; color:{color}">{t}</h3>'


def p(t, size=28, color=SUB, extra=''):
    return f'<p style="font-size:{size}px; font-weight:400; line-height:1.45; color:{color}{"; " + extra if extra else ""}">{t}</p>'


def mono(t, size=24, color=NAVY, extra=''):
    return f'<p style="font-family:{MONOF}; font-size:{size}px; font-weight:600; letter-spacing:2px; color:{color}{"; " + extra if extra else ""}">{t}</p>'


def pill(t, fg, bg, border=None):
    b = f'; border:1px solid {border}' if border else ''
    return f'<p style="font-family:{MONOF}; font-size:24px; font-weight:600; color:{fg}; background:{bg}; border-radius:999px; padding:4px 18px; white-space:nowrap{b}">{t}</p>'


def foot(t):
    return f'<p style="position:absolute; left:96px; bottom:40px; width:1728px; font-size:24px; color:{SUB}">{t}</p>'


def notes(t):
    return f'<aside>{esc(t)}</aside>'


def content(sid, lab, title, body, note, footer='', lead=''):
    # lead = 발표자 없이 읽어도 무엇을 왜 했는지 알 수 있게 하는 맥락 한두 줄(사용자 요청 2026-11-09, log/215)
    lead_html = f'<p style="font-size:30px; line-height:1.45; color:{SUB}; width:1728px">{lead}</p>' if lead else ''
    return (f'<section id="{sid}" data-transition="fade" style="background:{BG}; color:{INK}; font-family:{BODYF}; padding:72px 96px 120px; display:flex; flex-direction:column; gap:16px">'
            f'{label(lab)}{h2(title)}{lead_html}<div style="flex:1; display:flex; flex-direction:column; justify-content:center; gap:32px">{body}</div>'
            f'{foot(footer) if footer else ""}{notes(note)}</section>')


def divider(sid, part, title, sub, note):
    return (f'<section id="{sid}" data-transition="fade" style="background:{NAVY}; color:{BG}; font-family:{BODYF}; padding:128px 176px; display:flex; flex-direction:column; gap:24px">'
            f'<div style="flex:1"></div><p style="font-family:{MONOF}; font-size:28px; font-weight:600; letter-spacing:4px; color:#B9C7D8">{part}</p>'
            f'<h1 style="font-family:{HEADF}; font-size:120px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:{BG}">{title}</h1>'
            f'<p style="font-size:44px; font-weight:500; color:#D7E0EA">{sub}</p><div style="flex:1"></div>{notes(note)}</section>')


def shot(sid, lab, title, img, alt, url, points, note):
    pts = ''.join(
        f'<div style="display:flex; gap:16px; align-items:flex-start"><p style="font-family:{MONOF}; font-size:28px; font-weight:700; color:{NAVY}">{i:02d}</p>'
        f'<p style="font-size:28px; line-height:1.4; color:{INK}">{t}</p></div>' for i, t in enumerate(points, 1))
    frame = (f'<div style="width:1180px; display:flex; flex-direction:column; background:{CARDBG}; border:1px solid {LINE2}; border-radius:14px; {SHADOW}; overflow:hidden">'
             f'<div style="display:flex; gap:10px; align-items:center; padding:12px 20px; background:{SOFT}; border-bottom:1px solid {LINE}">'
             + ''.join(f'<div style="width:14px; height:14px; background:{c}; border-radius:256px"></div>' for c in ('#d9534f', '#e0a43a', '#4caf6a'))
             + f'<p style="font-family:{MONOF}; font-size:24px; white-space:nowrap; color:{SUB}; padding:0 0 0 16px">{url}</p></div>'
             f'<img src="{img}" alt="{alt}" style="width:1180px; height:619px; object-fit:contain; background:{CARDBG}"></div>')
    body = f'<div style="display:flex; gap:40px; align-items:center">{frame}<div style="flex:1; display:flex; flex-direction:column; gap:32px">{pts}</div></div>'
    return content(sid, lab, title, body, note)


def cards_row(cards):
    return '<div style="display:flex; gap:20px; align-items:stretch">' + ''.join(f'<div style="{CARD}; flex:1">{c}</div>' for c in cards) + '</div>'


def bar_row(name, before, after, maxv=10, unit=56):
    return (f'<div style="display:flex; flex-direction:column; gap:10px">'
            f'<p style="font-size:28px; font-weight:600; color:{INK}">{name}</p>'
            f'<div style="display:flex; align-items:center; gap:16px"><div style="width:{before * unit}px; height:26px; background:{LINE2}; border-radius:6px"></div>'
            f'<p style="font-family:{MONOF}; font-size:24px; color:{SUB}">처음 {before}단계</p></div>'
            f'<div style="display:flex; align-items:center; gap:16px"><div style="width:{after * unit}px; height:26px; background:{NAVY}; border-radius:6px"></div>'
            f'<p style="font-family:{MONOF}; font-size:24px; font-weight:700; color:{NAVY}">지금 {after}단계</p></div></div>')


def flow(steps, arrow_color=LINE2, active=None):
    out = []
    for i, (top, title, desc) in enumerate(steps):
        if i:
            out.append(f'<div style="display:flex; align-items:center"><x-shape kind="arrow-right" style="background:{arrow_color}; width:44px; height:28px"></x-shape></div>')
        hi = active is not None and i in active
        out.append(f'<div style="flex:1; display:flex; flex-direction:column; gap:10px; padding:28px; background:{"#E7ECF1" if hi else CARDBG}; border:2px solid {NAVY if hi else LINE2}; border-radius:14px">'
                   f'{mono(top, color=NAVY if hi else SUB)}{h3(title, 32)}{p(desc, 26) if desc else ""}</div>')
    return '<div style="display:flex; gap:14px; align-items:stretch">' + ''.join(out) + '</div>'




def bar(label_, weight, pct, note_=''):
    # 진행률 막대 — 묶음 이름 · 가중치 · 완료율(채운 길이) · 기여 점수
    w = 820
    fill = GREEN if pct >= 100 else (NAVY if pct >= 60 else AMBER)
    return (f'<div style="display:flex; align-items:center; gap:24px">'
            f'<p style="font-family:{HEADF}; font-size:32px; font-weight:700; color:{INK}; width:280px; flex-shrink:0; white-space:nowrap">{label_}</p>'
            f'<p style="font-family:{MONOF}; font-size:24px; color:{SUB}; width:120px; flex-shrink:0; white-space:nowrap">가중 {weight}%</p>'
            f'<div style="width:{w}px; height:36px; background:{SOFT}; border-radius:8px; display:flex; flex-shrink:0">'
            f'<div style="width:{int(w * pct / 100)}px; height:36px; background:{fill}; border-radius:8px"></div></div>'
            f'<p style="font-family:{MONOF}; font-size:28px; font-weight:700; color:{fill}; width:150px; flex-shrink:0; white-space:nowrap">{pct}%</p>'
            f'<p style="font-size:26px; color:{SUB}; white-space:nowrap">{note_}</p></div>')


def frame(img, alt, url, w, h):
    return (f'<div style="width:{w}px; display:flex; flex-direction:column; background:{CARDBG}; border:1px solid {LINE2}; border-radius:14px; {SHADOW}; overflow:hidden">'
            f'<div style="display:flex; gap:10px; align-items:center; padding:12px 20px; background:{SOFT}; border-bottom:1px solid {LINE}">'
            + ''.join(f'<div style="width:14px; height:14px; background:{c}; border-radius:256px"></div>' for c in ('#d9534f', '#e0a43a', '#4caf6a'))
            + f'<p style="font-family:{MONOF}; font-size:24px; white-space:nowrap; color:{SUB}; padding:0 0 0 16px">{url}</p></div>'
            f'<img src="{img}" alt="{alt}" style="width:{w}px; height:{h}px; object-fit:contain; background:{CARDBG}"></div>')




def phone(img, alt, h=600):
    # 회원 모바일 웹 캡처(Pixel 7, 1082×2202) — 휴대폰 테두리
    w = round(h * 1082 / 2202)
    return (f'<div style="padding:10px; background:#1F2A33; border-radius:36px; {SHADOW}; display:flex">'
            f'<img src="{img}" alt="{alt}" style="width:{w}px; height:{h}px; object-fit:cover; border-radius:26px; background:{CARDBG}"></div>')


def mono_card(t, tone):
    fg, bg, bd = (AMBER, '#FBF3E8', '#E8CFA6') if tone == 'bad' else (GREEN, '#EAF5EF', '#A9D3BC')
    return (f'<div style="background:{bg}; border:1px solid {bd}; border-radius:12px; padding:22px 26px">'
            f'<p style="font-family:{MONOF}; font-size:26px; line-height:1.5; color:{fg}">{t}</p></div>')


def big(num, unit, cap, color=NAVY):
    return (f'<div style="{CARD}; flex:1; align-items:flex-start">'
            f'<p style="font-family:{HEADF}; font-size:96px; font-weight:900; line-height:1; color:{color}">{num}<span style="font-size:40px; font-weight:700"> {unit}</span></p>'
            f'{p(cap, 28, INK)}</div>')




cur = LT['runs']['current']
S = []

def box(top, title, desc, hi=False, w=None):
    width = f'width:{w}px; ' if w else 'flex:1; '
    return (f'<div style="{width}display:flex; flex-direction:column; gap:10px; padding:26px 28px; background:{"#E7ECF1" if hi else CARDBG}; '
            f'border:2px solid {NAVY if hi else LINE2}; border-radius:14px">{mono(top, color=NAVY if hi else SUB)}{h3(title, 34)}{p(desc, 26)}</div>')

ARROW = f'<div style="display:flex; align-items:center"><x-shape kind="arrow-right" style="background:{LINE2}; width:44px; height:28px"></x-shape></div>'

# 1 표지
S.append(('cover', f'<section id="cover" data-transition="fade" style="background:{BG}; color:{INK}; font-family:{BODYF}; padding:128px 176px; display:flex; flex-direction:column; gap:20px">{DOTS}'
          f'<div style="flex:1"></div><div style="display:flex"><p style="font-family:{MONOF}; font-size:24px; letter-spacing:2px; color:{NAVY}; background:#E7ECF1; border:1px solid {LINE}; border-radius:999px; padding:8px 24px">SPOISM ERP · FINAL</p></div>'
          f'<h1 style="font-family:{HEADF}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:{INK}">스포이즘 ERP</h1>'
          f'<p style="font-size:52px; font-weight:500; color:{SUB}">최종 발표</p><p style="font-size:32px; color:{SUB}">아파트 · 오피스텔 커뮤니티 시설 위탁운영사의 본사 · 지점 · 회원 관리 시스템</p><div style="height:36px"></div>'
          f'<p style="font-family:{MONOF}; font-size:28px; color:{SUB}"><b>발표자</b>&#160; 박정현 &#160;&#160;·&#160;&#160; <b>시연</b>&#160; 운영 서버에서 직접</p>'
          f'<div style="flex:1"></div>{notes("최종 발표 20분 — 설명 약 8분(2~7장), 시연 7분(8장에서 브라우저로), 결과·마무리 약 3분(9~12장), 여유 2분. 프로젝트를 처음 보는 사람 기준으로 말한다.")}</section>'))

# 2 사업 구조
S.append(('business', content('business', '사업 구조', '지점은 매장이 아니라 계약 현장이다',
    '<div style="display:flex; gap:14px; align-items:stretch">'
    + box('본사', '스포이즘', '위탁운영 계약 · 인력 채용', True) + ARROW
    + box('계약', '위탁 현장(지점)', 'OO아파트 커뮤니티 시설 · 기간 · 상태') + ARROW
    + box('파견', '직원', '본사가 채용해 현장에 보냄') + ARROW
    + box('이용', '회원(입주민)', '예약 · 결제 · 시설 이용') + '</div>'
    + f'<div style="display:flex; align-items:center; gap:18px; padding:24px 30px; background:{NAVY}; border-radius:14px">'
    f'<x-icon name="Chart" style="color:#FFFFFF; width:40px; height:40px"></x-icon>'
    f'<p style="font-size:32px; font-weight:700; color:#FFFFFF">운영 기록(회원 수 · 매출 · 프로그램 실적)이 다시 본사로 — 계약 갱신 판단의 근거</p></div>',
    '스포이즘은 헬스장 체인이 아니라 아파트·오피스텔 커뮤니티 시설 위탁운영사다. 지점(Branch)은 소유 매장이 아니라 "OO아파트와 맺은 위탁운영 계약 현장"이고, 계약 상대방·기간·상태(정상·갱신 임박·만료·종료)를 갖는다. 직원은 지점이 아니라 본사가 채용해 현장에 파견한다. 계약이 운영의 전제이고(계약이 끝난 현장은 새 활동이 막힌다), 운영 데이터가 다시 계약 갱신·영업의 근거로 돈다 — 이 순환을 시스템 하나로 묶는 것이 이 프로젝트다.',
    '원천: 제안요청서(RFP) · docs/architecture/entities.md §2',
    lead='스포이즘은 헬스장 체인이 아니라 아파트 · 오피스텔 커뮤니티 시설을 위탁받아 운영하는 회사다.')))

# 3 RFP 핵심
S.append(('rfp-core', content('rfp-core', 'RFP가 요구한 핵심', '두 가지를 구조로 지켰다', cards_row([
    f'{mono("요구 1")}{h3("지점은 자기 지점만", 44)}{p("지점 관리자는 자기 현장 데이터만 조회 · 수정한다. 다른 지점 회원 · 예약 · 직원은 보이지도 바뀌지도 않아야 한다", 28, INK)}',
    f'{mono("요구 2", color=AMBER)}{h3("불안정은 곧 계약 해지", 44)}{p("시스템이 불안정하면 입주민 민원 → 아파트가 계약 해지. 안정성은 품질이 아니라 본사 매출(계약 개수) 문제다", 28, INK)}']),
    'RFP가 명시한 리스크: "시스템 불안정 → 민원 → 계약 해지". 그래서 이 프로젝트는 두 요구를 기능 하나가 아니라 구조로 지켰다 — 격리는 서버 한 곳에서 강제하고, 계약 상태는 쓰기 시점에 판정하며, 운영 서버의 부하 한계를 직접 쟀다. 이어지는 세 장이 그 구조다. 이 시스템은 신규 수주 입찰(PT) 영업 도구이기도 하다(차별화전략).',
    '원천: 제안요청서 · docs/reference/차별화전략.md',
    lead='제안요청서에서 가장 무겁게 읽은 두 요구 — 이 둘을 기능이 아니라 구조로 지켰다.')))

# 4 시스템
stack = ('<div style="display:flex; gap:14px; align-items:stretch">'
         + box('화면', '관리자 웹 · 회원 웹', '본사 · 지점 · 직원용 / 회원 모바일 웹(앱처럼 설치)') + ARROW
         + box('앞단', 'Cloudflare Worker', '화면 파일 · 요청 전달 · 로그인 횟수 제한') + ARROW
         + box('서버', 'AWS Lambda(서울)', 'NestJS · 동시 실행 상한 10 · 넘치면 즉시 거절', True) + ARROW
         + box('DB', 'Supabase Postgres', '테이블 36 · 정합성 규칙은 DB에도') + '</div>')
chips = '<div style="display:flex; gap:16px">' + ''.join(
    f'<div style="flex:1; padding:22px 28px; background:{CARDBG}; border:1px solid {LINE}; border-radius:12px">{mono(a, color=SUB)}'
    f'<p style="font-family:{HEADF}; font-size:56px; font-weight:900; color:{NAVY}">{b}</p></div>'
    for a, b in [('업무 도메인', '9'), ('API', '약 120'), ('DB 테이블', '36'), ('역할', '4')]) + '</div>'
S.append(('system', content('system', '시스템', '한 장으로 본 시스템', stack + chips,
    '화면은 둘 — 본사·지점·직원이 쓰는 관리자 웹과 회원이 휴대폰으로 쓰는 회원 웹(PWA, 네이티브 앱은 만들지 않음 D40·D77). 앞단 Cloudflare Worker가 화면 파일을 주고 API 요청을 넘기며 로그인 시도 횟수를 제한한다. 서버는 AWS Lambda(서울, NestJS) — 동시 실행 상한 10, 넘친 요청은 기다리게 하지 않고 즉시 거절(D37). DB는 Supabase Postgres, 업무 규칙 일부(정원 · 지점 일치 등)는 DB 제약·트리거로도 지킨다. 도메인 9개: 권한 · 인사 · 근태 · 게시판 · 회원 · 예약및결제 · 강사프로그램 · 혼잡도 · 자원문서. 역할 4개: 본사 · 지점 관리자 · 직원 · 회원.',
    '결정 기록 D37(Lambda) · D40·D77(회원 웹) · 아키텍처 설계서',
    lead='화면 둘, 앞단 하나, 서버 하나, DB 하나 — 운영 비용을 거의 들이지 않는 구성이다.')))

# 5 격리
S.append(('isolation', content('isolation', '요구 1 · 지점 격리', '격리는 한 곳에서, 빠뜨리면 테스트가 실패', '<div style="display:flex; gap:14px; align-items:stretch">'
    + box('한 곳', '전역 가드', '모든 요청이 지나는 한 곳에서 지점을 확인 — 화면마다 따로 막지 않는다', True) + ARROW
    + box('누락 방지', '선언 검사 테스트', '새 기능이 지점 확인 선언을 빠뜨리면 자동 테스트가 실패') + ARROW
    + box('공격', '다른 지점 시도 표', '다른 지점 ID로 조회 · 수정을 시도해 거절되는지 기능마다 확인') + '</div>'
    + f'<div style="display:flex; align-items:center; gap:16px; padding:20px 28px; background:{SOFT}; border-radius:12px"><x-icon name="Play" style="color:{NAVY}; width:30px; height:30px"></x-icon>'
    f'{p("시연에서 직접 — 서초점 관리자는 강남점 회원을 검색해도 찾지 못한다", 28, INK)}</div>',
    '처음엔 컨트롤러마다 지점 검사를 손으로 썼고, 빠뜨린 곳이 실제로 나왔다. 그래서 검사를 전역 가드(BranchScopeGuard) 한 곳으로 모으고(D46), 리소스를 받는 라우트는 선언(@ScopedResource)만 붙이게 했다. 선언을 빠뜨리면 branch-scope-coverage 테스트가 실패하고, branch-isolation 테스트는 다른 지점 ID로 공격하는 표를 기능마다 돈다. 결과: 지점 관리자가 다른 지점 데이터에 닿으면 403/404.',
    '결정 기록 D46 · 테스트 branch-isolation · branch-scope-coverage',
    lead='지점 관리자가 다른 지점 데이터를 보면 안 된다 — 사람이 매번 챙기지 않아도 되게 만들었다.')))

# 6 계약
st = ''.join(f'<div style="flex:1; display:flex; flex-direction:column; gap:12px; padding:24px 26px; background:{CARDBG}; border:1px solid {LINE}; border-top:6px solid {c}; border-radius:12px">'
             f'{h3(n, 36)}{p(d, 26, INK)}</div>'
             for n, d, c in [('정상', '모든 업무', GREEN), ('갱신 임박', '모든 업무 · 갱신 준비', AMBER), ('만료', '모든 업무 · 재계약 협의', AMBER), ('종료', '새 활동 막힘 · 과거 기록만', '#B42318')])
S.append(('contract', content('contract', '요구 2 · 계약 상태', '계약이 끝나면 새 활동이 막힌다',
    f'<div style="display:flex; gap:16px">{st}</div>'
    + cards_row([f'{mono("종료 현장에서 막히는 것", color="#B42318")}{p("신규 회원 등록 · 예약 · 게시글 작성 · 직원 채용 · 파견 발령", 28, INK)}',
                 f'{mono("엇갈림 방지")}{p("종료를 확정하는 순간과 새 등록이 겹쳐도 하나만 성공 — 쓰기 시점에 지점 상태를 잠그고 판정", 28, INK)}']),
    '지점의 계약 정보는 계약 회차(갱신마다 새 회차, 계약서 파일과 함께)에 있고, 상태는 정상 · 갱신 임박 · 만료 · 종료 넷이다. 갱신 임박과 만료는 막지 않는다(현장은 계속 운영 중). 종료는 해지 합의서가 있어야 확정되고(D69), 확정되면 그 지점의 진행 중 파견을 같은 트랜잭션에서 끝낸다. 새 등록 · 예약 · 작성 · 채용 · 파견은 쓰기 트랜잭션 안에서 지점 행을 잠그고 상태를 읽어 판정한다 — 종료 확정과 동시에 와도 엇갈리지 않는다(D70). 과거 조회는 그대로 된다. 계약 쓰기는 모두 변경 이력에 남는다(D68).',
    '결정 기록 D68 · D69 · D70 · 테스트 계약 종료 차단',
    lead='계약이 운영의 전제다. 계약 상태에 따라 현장에서 할 수 있는 일이 정해진다.')))

# 7 부하
S.append(('load', content('load', '요구 2 · 안정성', '넘치면 빨리 거절하고 곧 돌아온다',
    '<div style="display:flex; gap:20px; align-items:stretch">'
    + big('0', '건', '평소 부하 거절 — 초당 50건 × 5분 = 15,000건, 두 번 돌려 두 번 다', GREEN)
    + big(f"약 {cur['s3OkRps']}", '건/초', '초당 300건이 몰려도 처리할 만큼은 0.07초 안에 처리')
    + big('0.013', '초', '넘친 요청은 기다리게 두지 않고 바로 “잠시 후 다시”', AMBER) + '</div>'
    + f'<div style="display:flex; align-items:center; gap:20px; padding:24px 30px; background:{NAVY}; border-radius:14px">'
    f'<p style="font-size:32px; font-weight:700; color:#FFFFFF">서버 오류 · 시간 초과 0 — 과부하가 끝나면 평소 속도로 돌아온다</p></div>',
    '2026-11-22 운영 서버(AWS 서울)에 직접 부하 — 로그인 몰림 → 평소 부하(초당 50건 5분) → 과부하(초당 300건 1분) → 회복, 11분 30초, 통과 기준 12개 모두 통과. 평소 부하 응답 p95 약 69ms, 과부하에서 실제 처리 약 99건/초(동시 실행 상한 10), 넘친 요청은 0.013초 안에 거절(D37 설계). 회복: 과부하가 끝난 뒤 30초 구간 서버 오류 0, 그 뒤 2분 평소 기준 그대로(초 단위로는 재지 않았다). 응답 시간은 측정 PC ↔ 서울 리전 네트워크 포함. 10월 측정의 평소 부하 거절 47건은 이번에 재현되지 않았지만 원인은 모른다.',
    '운영 서버 측정 2026-11-22 · k6 · 통과 기준 12개 · 결정 기록 D37 · D50',
    lead='불안정이 곧 계약 해지라서, 운영 서버에 일부러 부하를 걸어 한계를 쟀다.')))

# 8 시연
steps = [('1', '본사', '계약 현장 한눈에', '계약 상태 · 운영 실적'),
         ('2', '회원', '앱으로 예약 · 결제', '오늘 회차 예약'),
         ('3', '지점', '바로 받아 체크인', '혼잡도 입력 · 격리 확인'),
         ('4', '본사', '운영 기록 → 계약', '갱신 리포트')]
demo = '<div style="display:flex; gap:14px; align-items:stretch">' + ARROW.join(
    f'<div style="flex:1; display:flex; flex-direction:column; gap:12px; padding:30px 28px; background:{CARDBG}; border:2px solid {NAVY if i in (0, 3) else LINE2}; border-radius:14px">'
    f'<p style="font-family:{HEADF}; font-size:72px; font-weight:900; line-height:1; color:{NAVY}">{n}</p>{mono(who)}{h3(t, 34)}{p(d, 26)}</div>'
    for i, (n, who, t, d) in enumerate(steps)) + '</div>'
S.append(('demo', content('demo', '시연', '계약에서 운영으로, 다시 계약으로', demo
    + f'<div style="display:flex; align-items:center; gap:16px; padding:20px 28px; background:{SOFT}; border-radius:12px"><x-icon name="Globe" style="color:{NAVY}; width:30px; height:30px"></x-icon>'
    f'{p("운영 서버에서 직접 — 본사 · 지점 관리자 · 회원 세 계정으로 한 바퀴", 28, INK)}</div>',
    '여기서 브라우저로 넘어간다(Alt+Tab). 창 A 본사(정하늘) · 창 B 서초점 관리자(김민수) · 창 C 회원 웹(이수진, 오른쪽 좁은 창). 1 본사 대시보드 계약 상태 카드·운영 실적 → 2 회원 예약하기 → 서초점 오늘 회차 → 결제 → 내 예약 → 3 지점 처리 대기 → 예약 관리(오늘) → 이수진 체크인 → 혼잡도 현장 인원 입력 → 상단 회원 찾기 "오영희"(강남점) → 없음, 본사 창에서 같은 검색 → 나옴 → 4 본사 마포점(갱신 임박) → 갱신 리포트. 시간이 남으면 노원점(종료) — 갱신·파일 올리기 막힘. 돌아와서: "방금 본 것이 첫 장의 순환입니다." 세부는 구성안 4-11 시연 흐름.',
    '시연 7분 · 창 A 본사 · 창 B 서초점 관리자 · 창 C 회원',
    lead='앞에서 말한 순환을 운영 서버에서 한 바퀴 돈다.')))

# 9 RFP
area = ''.join(f'<div style="flex:1; display:flex; flex-direction:column; gap:10px; padding:26px 28px; background:{CARDBG}; border:1px solid {LINE}; border-radius:12px">'
               f'{mono(a, color=SUB)}<p style="font-family:{HEADF}; font-size:56px; font-weight:900; color:{GREEN}">100%</p></div>'
               for a in ('기능 · 성능', '시스템 · 데이터 · 보안', '과업 · 산출물'))
S.append(('rfp', content('rfp', '결과 · RFP', 'RFP 충족률 100%',
    f'<p style="font-family:{HEADF}; font-size:200px; font-weight:900; line-height:1; color:{NAVY}">100%</p>'
    f'<div style="display:flex; gap:16px">{area}</div>',
    '말로 붙일 것(분모 설명): RFP 72조항 중 발주기관·계약·대면 행위처럼 이 프로젝트에 대상이 없는 10개(해당 없음)와, 근거 자료가 없어 하지 않기로 한 분석 3개(유사 기업 시스템 분석·도입 기대효과 분석·유사기업 매뉴얼 분석 — 의도적 제외)를 분모에서 뺀 59개 중 59개(D82). 72조항 전부를 분모로 하면 82%. 조정 7개는 근거 결정이 있는 방식 변경(모의 결제·혼잡도 수동 입력·PG 연계 문서 확인 등). 판정 원천 docs/reference/요구사항추적표.md §3, 조항별 근거는 RFP 이행 증빙(산출물).',
    '판정 원천 docs/reference/요구사항추적표.md §3 · 조항별 근거는 RFP 이행 증빙 · 결정 기록 D82',
    lead='제안요청서 조항마다 무엇으로 충족했는지 판정했다.')))

# 10 진행률
S.append(('progress', content('progress', '결과 · 진행률', '최종 제출까지 91%',
    f'<div style="display:flex; flex-direction:column; gap:22px">'
    + bar('기능 구현', 40, 100, 'RFP 충족')
    + bar('검증 · 품질', 15, 100, '자동 테스트 · 부하')
    + bar('산출물', 20, 100, '8종 지금 기준')
    + bar('발표 · 제출', 15, 67, '제출 남음')
    + bar('운영 · 마무리', 10, 60, 'main 병합 남음')
    + '</div>',
    '진행률 기준(D80) — 묶음 5개(기능 40 · 검증 15 · 산출물 20 · 발표·제출 15 · 운영·마무리 10)의 가중 평균. 발표 직전 값으로 다시 센다(14주차 덱·이 발표가 끝나면 발표·제출이 오른다). 남은 것: 최종 발표 덱(이 발표), 최종 제출 폴더, 원격 작업 브랜치 정리, dev → main 병합(완성본). 기능 100%의 분모 설명은 앞 장 노트.',
    '결정 기록 D80 · 항목마다 끝냄 1 · 일부 0.5 · 안 함 0으로 세어 가중 평균 · docs/reference/진행률.md',
    lead='제출까지 남은 일을 다섯 묶음으로 나눠 셌다. 남은 것은 제출과 마무리다.')))

# 11 산출물
deliv = [('요구사항 정의서', 'Excel · RFP 조항별 판정'), ('데이터 정의서', 'Excel · 테이블 36'),
         ('기업 분석 및 제안서', 'Word'), ('아키텍처 설계서', 'Word · 결정 이력'),
         ('사용자 매뉴얼', 'Word · 화면 캡처'), ('교육 자료', 'PDF · 역할별 빠른 시작'),
         ('진행 보고서 5부', 'Word · 단계별'), ('RFP 이행 증빙', 'PDF · 조항별 화면')]
grid = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px">' + ''.join(
    f'<div style="display:flex; align-items:center; gap:20px; padding:20px 26px; background:{CARDBG}; border:1px solid {LINE}; border-radius:12px">'
    f'<x-icon name="Check" style="color:{GREEN}; width:30px; height:30px"></x-icon>'
    f'<p style="font-family:{HEADF}; font-size:32px; font-weight:700; color:{INK}; width:330px">{t}</p><p style="font-size:26px; color:{SUB}">{d}</p></div>'
    for t, d in deliv) + '</div>'
S.append(('deliverables', content('deliverables', '결과 · 산출물', '제출 산출물 8종', grid,
    'RFP가 요구한 산출물 여덟 종류. 손으로 고치지 않고 코드·문서에 있는 원천(API 경로, DB 스키마, 요구사항 추적표, 화면 도움말)에서 생성기로 만든다(scripts/deliverables/, 한 사실은 한 곳에만 D38) — 기능이 바뀌면 다시 만들면 되고, 생성기가 설명이 빠진 API·테이블을 잡아 준다. 마지막 재생성은 제출 직전에 한 번 더.',
    '생성기 scripts/deliverables/ · 원천에서 생성(D38)',
    lead='산출물은 원천(코드 · 문서)에서 생성기로 만든다 — 기능이 바뀌면 다시 뽑는다.')))

# 12 마무리
S.append(('closing', f'<section id="closing" data-transition="fade" style="background:{BG}; color:{INK}; font-family:{BODYF}; padding:128px 176px; display:flex; flex-direction:column; gap:24px">{DOTS}'
          f'<div style="flex:1"></div><h1 style="font-family:{HEADF}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:{INK}">감사합니다</h1>'
          f'<p style="font-size:44px; font-weight:500; color:{SUB}">질문 받겠습니다</p><div style="flex:1"></div>'
          f'{notes("맺음(말로): 위탁운영사의 계약 → 운영 → 운영 기록 → 계약 순환을 시스템 하나로 묶었고, 지점 격리와 계약 상태를 구조로 지켰으며, 운영 서버에 부하를 걸어 안정성을 확인했습니다. 질문 대비: 실운영은 하지 않았다(D67) · 테스트 범위(api 681건·화면 35건, 그 밖은 수동) · 10월 거절 47건 원인 미확인 · AI 활용(구현 Claude · 리뷰 Codex · 결정 기록).")}</section>'))

os.makedirs(os.path.join(OUT, 'project', 'slides'), exist_ok=True)
for sid, html in S:
    assert html.count('<section') == 1 and f'id="{sid}"' in html, sid
    with open(os.path.join(OUT, 'project', 'slides', f'{sid}.html'), 'w', encoding='utf-8') as f:
        f.write(html)
with open(os.path.join(OUT, 'project', 'deck.css'), 'w', encoding='utf-8') as f:
    f.write('/* 최종 발표 덱 — 슬라이드는 인라인 스타일(4-0 §4, 12·13주차와 같은 언어). */\nsection { box-sizing: border-box; }\n')
order = [sid for sid, _ in S]
deck = {
    'v': 5,
    'createdOnFiles': {'v': 1, 'at': os.environ.get('DECK_CREATED_AT') or datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')},
    'lists': 'css',
    'format': {'v': 1, 'shared': ['project/deck.css']},
    'title': '스포이즘 ERP 최종 발표',
    'order': order,
    'sections': {
        'intro': {'description': '표지, 사업 구조 — 지점은 계약 현장', 'start': 'cover'},
        'design': {'description': 'RFP 핵심 두 요구와 그것을 지킨 구조 — 시스템, 지점 격리, 계약 상태, 부하', 'start': 'rfp-core'},
        'demo': {'description': '시연 — 본사 → 회원 → 지점 → 본사', 'start': 'demo'},
        'result': {'description': '결과 — RFP 충족률, 진행률, 산출물, 마무리', 'start': 'rfp'},
    },
    'faces': {
        'gothic-a1': {'family': 'Gothic A1', 'href': 'https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;500;700;800;900&display=swap'},
        'noto-sans-kr': {'family': 'Noto Sans KR', 'href': 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap'},
        'jetbrains-mono': {'family': 'JetBrains Mono', 'href': 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap'},
    },
    'designSystems': [],
}
with open(os.path.join(OUT, 'project', 'deck.json'), 'w', encoding='utf-8') as f:
    json.dump(deck, f, ensure_ascii=False, indent=2)
print(len(order), 'slides')
