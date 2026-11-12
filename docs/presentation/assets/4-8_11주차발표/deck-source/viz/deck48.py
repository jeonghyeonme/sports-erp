# 4-8 11주차 발표 덱 생성기 — 10주차 덱(https://claude.ai/artifact/YS4CX2S87R882cwTdjPxzZ)과 같은 색·글꼴·머리말·카드·브라우저 프레임(4-0 §4).
# 사용: python3 viz/deck48.py deck-out [점격자.svg]   → deck-out/project/{deck.json, slides/*.html}
# 점 격자 SVG는 10주차 표지에서 가져온 장식이다(인자로 주지 않으면 deck-out/dots.svg를 쓴다).
import json, os, sys, datetime

OUT = sys.argv[1] if len(sys.argv) > 1 else 'deck-out'
DOTS = open(sys.argv[2] if len(sys.argv) > 2 else os.path.join(OUT, 'dots.svg'), encoding='utf-8').read().strip()

IMG = {  # 아티팩트 자산(/_blob) — screenshots/deck-*.png를 올린 주소
    'quick': '/_blob/85be0cdaf1f1a9890b4c0f967b7bebd5',
    'assets': '/_blob/04e70d55936899767a007447c038f433',
    'docs': '/_blob/e9534b79114e6f0fe271eaec27c1d668',
    'chart': '/_blob/331d086eb401dae95a8675acb1330e9f',
}

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


S = []

# 1 표지
S.append(('cover', f'<section id="cover" data-transition="fade" style="background:{BG}; color:{INK}; font-family:{BODYF}; padding:128px 176px; display:flex; flex-direction:column; gap:20px">{DOTS}'
          f'<div style="flex:1"></div><div style="display:flex"><p style="font-family:{MONOF}; font-size:24px; letter-spacing:2px; color:{NAVY}; background:#E7ECF1; border:1px solid {LINE}; border-radius:999px; padding:8px 24px">SPOISM ERP · WEEK 11</p></div>'
          f'<h1 style="font-family:{HEADF}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:{INK}">스포이즘 ERP</h1>'
          f'<p style="font-size:52px; font-weight:500; color:{SUB}">11주차 진행 발표</p><p style="font-size:32px; color:{SUB}">아파트 · 오피스텔 커뮤니티 시설 위탁운영사의 본사 · 지점 · 회원 관리 시스템</p><div style="height:36px"></div>'
          f'<p style="font-family:{MONOF}; font-size:28px; color:{SUB}"><b>발표자</b>&#160; 박정현 &#160;&#160;·&#160;&#160; <b>범위</b>&#160; 10주차 발표(11/5) 이후 ~ 2026-11-09</p>'
          f'<div style="flex:1"></div>{notes("11주차 발표. 범위는 10주차 발표(11/5, 계약 관리·동시성) 이후 작업. 라이브 데모 없이 로컬 실행 화면 캡처로 보인다. 15분 — 사용감 5분, 목록·문서·차트 각 2분, RFP와 정리 3분.")}</section>'))

# 2 순서
todo = ''.join(
    f'<div style="display:flex; align-items:center; gap:14px; padding:14px 22px; background:{CARDBG}; border:1px solid {LINE}; border-radius:12px">'
    f'<x-icon name="{ic}" style="color:{c}; width:30px; height:30px"></x-icon><p style="font-size:28px; color:{INK}">{t}</p>{pill(s, c, bg)}</div>'
    for ic, c, bg, t, s in [('Check', GREEN, '#E3F1EA', '문서 파일 관리', '02'),
                            ('Check', GREEN, '#E3F1EA', '사용감 개선', '01 · 03'),
                            ('Check', GREEN, '#E3F1EA', '회원 앱 형태 재검토', '04')])
rows = ''.join(
    f'<div style="display:flex; align-items:center; gap:28px; padding:22px 28px; background:{CARDBG}; border:1px solid {LINE}; border-radius:12px">'
    f'<p style="font-family:{MONOF}; font-size:28px; font-weight:700; color:{NAVY}; width:60px">{n}</p>'
    f'<p style="font-family:{HEADF}; font-size:36px; font-weight:700; color:{INK}; width:420px">{t}</p><p style="font-size:30px; color:{SUB}">{d}</p></div>'
    for n, t, d in [('01', '사용감', '자주 쓰는 기능에 더 적은 단계로'),
                    ('02', '문서 파일', '안전하게 올리고 여는 설계'), ('03', '운영 실적 차트', '지점 실적을 13개월 추이로'),
                    ('04', '회원 앱 형태', '지금 모바일 웹을 유지'),
                    ('05', 'RFP 충족률', '산정 방식을 바꿔 다시 셈')])
S.append(('agenda', content('agenda', '오늘 순서', '11주차에 한 일',
          f'<div style="display:flex; gap:40px; align-items:flex-start"><div style="width:620px; display:flex; flex-direction:column; gap:14px">{mono("10주차 발표에서 남긴 다음 할 일", color=SUB)}{todo}</div>'
          f'<div style="flex:1; display:flex; flex-direction:column; gap:14px">{mono("이번 발표 순서", color=SUB)}{rows}</div></div>',
          '10주차 마지막 장의 다음 할 일 세 개에서 출발한다. 문서 파일은 02(보안 설계), 사용감 개선은 01(접근 경로)·03(운영 실적 차트)으로 했다. 목록 정렬·검색·CSV를 맞춘 일(D74)은 원래 있었어야 할 기본기라 발표에서 따로 다루지 않는다 — 질문이 나오면 노트의 Q&A로. 회원 앱 형태 재검토는 04 — 지금 모바일 웹 유지로 결정(D77). 마지막에 RFP 충족률 산정 방식을 바꾼 것을 따로 설명한다.',
          '10주차 발표(11/5) 이후 작업 · 결정 기록 D72~D76',
          lead='10주차(11/5)에는 위탁 계약 관리를 발표했고, 그때 다음 할 일로 세 가지를 남겼다. 이번에는 세 가지를 모두 마친 결과다.')))

# PART 01 사용감
S.append(('p1', divider('p1', 'PART 01', '사용감', '자주 쓰는 기능의 접근 경로를 단순하게',
          '불필요한 단계를 걷어 내고, 자주 쓰는 기능에 바로 닿게 했다. 예시 하나(PT 세션 차감)와 화면 구성 규칙 하나로 보인다. 약 3분.')))

S.append(('ux-measure', content('ux-measure', '사용감 · 측정', '줄이려면 먼저 잽니다', cards_row([
    f'<p style="font-family:{HEADF}; font-size:96px; font-weight:900; line-height:1; color:{NAVY}">20</p>{h3("자주 하는 작업")}{p("지점 관리자 10 · 직원 3 · 본사 4 · 회원 3 — 매일·매주 반복하는 등록·조회·처리")}',
    f'<p style="font-family:{HEADF}; font-size:96px; font-weight:900; line-height:1; color:{NAVY}">4</p>{h3("세는 것")}{p("누름 · 입력 · 화면 이동 · 스크롤. 단계 = 누름 + 입력")}',
    f'<x-icon name="Activity" style="color:{NAVY}; width:96px; height:96px"></x-icon>{h3("다시 잴 수 있는 도구")}{p("실제 브라우저가 작업을 처음부터 끝까지 따라간다. 고칠 때마다 같은 도구로 전후 비교")}',
]) + p('가장 짧은 정상 경로 기준 — 화면을 읽고 찾는 시간, 서버 대기, 잘못 누르기는 세지 않았습니다', 26, SUB, 'text-align:center'),
    '측정 도구: 화면 자동 테스트와 같은 서버·DB 구성으로 실제 브라우저(Playwright)가 작업을 따라가고, 사용자 동작만 기록기로 센다. 관리자 웹은 데스크톱 1280×720, 회원 웹은 휴대폰 크기. 기준 시드와 시연 데이터(행이 많은 DB) 두 번 잰다 — 단계는 같고 스크롤만 다르다. 통과·실패를 보는 테스트가 아니라 측정이라 CI에는 넣지 않았다(log/198). 한계를 말로 꼭 밝힐 것: 시간은 재지 않았다.',
    '측정 도구: e2e/task-steps (log/198)')))

S.append(('ux-found', content('ux-found', '사용감 · 기준선', '기준선이 보여 준 것 세 가지', cards_row([
    f'{mono("01")}{h3("회원 찾기에만 3단계")}{p("메뉴 → 검색어 → 검색 버튼. PT 세션 차감 6단계 중 4단계가 회원 찾기와 탭 바꾸기 — PT 수업마다 반복")}',
    f'{mono("02")}{h3("늘 같은 값인데 빈 칸")}{p("PT 구매일은 거의 오늘, 누락일 출근 시각은 지점 기준 시각인데 매번 입력")}',
    f'{mono("03")}{h3("첫 화면 밖의 폼")}{p("회차 등록 폼은 주간 시간표 아래 — 스크롤 2~3번. 데이터가 많을수록 늘었다")}',
]) + f'<div style="display:flex; align-items:center; gap:16px; padding:20px 28px; background:{SOFT}; border-radius:12px"><x-icon name="Check" style="color:{GREEN}; width:30px; height:30px"></x-icon>'
    f'{p("이미 짧은 것은 손대지 않았습니다 — 처리 대기함에서 휴가 승인 2단계, 오늘 예약 체크인 2단계, 지점 실적 1단계", 28, INK)}</div>',
    '기준선 20건 중 줄일 후보 세 가지. ①이 가장 컸다: 회원 관련 작업(B02 찾기, B03 PT 등록, B04 PT 차감)이 모두 같은 앞머리를 지난다. ②는 기본값만 채우면 되는 칸. ③은 쌓이는 목록 아래에 폼이 있어서 데이터가 많아질수록 스크롤이 늘었다. 이미 짧은 작업은 건드리지 않았다 — 고칠 대상을 숫자로 골랐다는 점을 강조.')))

STEP = {
    'b1': '/_blob/de41b368d35b09d41e6861839185943e', 'b2': '/_blob/1c1d724b447f9bce93853cd7f70ad696', 'b3': '/_blob/8d89bbcc7318065c6ea3dc52533f781c',
    'b4': '/_blob/b42175fb51d7e8a3acdac2e8dae96c2f', 'b5': '/_blob/04b786837fff23a85aa7b648829ae117', 'b6': '/_blob/67746c608ec627bf491916d027b3e66c',
    'a1': '/_blob/030eefcd39c2a6fe0271869b7acb0209', 'a2': '/_blob/96bc0315e093229b27dbbfa537968073', 'a3': '/_blob/66a8f8d26eeff40f1d29e39df1d088bc',
    'slot_b': '/_blob/d1bba64adbd95d48bde074bb6878f3fb', 'slot_a1': '/_blob/0514e85d0ac695268def9f37aaee58e8', 'slot_a2': '/_blob/b3fe3f8147643ec5bdd66c98a1c4a51d',
}
ACCENT = '#C2410C'  # 캡처의 강조 테두리(#E0592A)와 같은 계열, 글자 대비용으로 조금 어둡게


def step_card(img, n, cap, w=237, h=148):
    return (f'<div style="width:{w}px; display:flex; flex-direction:column; background:{CARDBG}; border:1px solid {LINE2}; border-radius:10px; overflow:hidden">'
            f'<img src="{img}" alt="{n}단계 — {cap}" style="width:{w}px; height:{h}px; object-fit:cover; background:{CARDBG}">'
            f'<div style="display:flex; gap:8px; align-items:flex-start; padding:10px 12px; border-top:1px solid {LINE}">'
            f'<p style="font-family:{MONOF}; font-size:24px; font-weight:700; color:{ACCENT}">{n}</p><p style="font-size:24px; line-height:1.3; color:{INK}">{cap}</p></div></div>')


def step_row(tag, count, color, cards, tail=''):
    return (f'<div style="display:flex; gap:16px; align-items:stretch">'
            f'<div style="width:180px; display:flex; flex-direction:column; justify-content:center; gap:6px">{mono(tag, color=color)}'
            f'<p style="font-family:{HEADF}; font-size:56px; font-weight:900; line-height:1; color:{color}">{count}</p><p style="font-size:24px; color:{SUB}">단계</p></div>'
            + ''.join(cards) + tail + '</div>')


before = [step_card(STEP[f'b{i}'], i, c) for i, c in enumerate(['회원 메뉴', '이름 입력', '검색 버튼', '회원 줄 클릭', 'PT 탭', '세션 사용'], 1)]
after = [step_card(STEP[f'a{i}'], i, c) for i, c in enumerate(['상단 바에 입력', '결과 고르기', '세션 사용'], 1)]
after_tail = (f'<div style="flex:1; display:flex; flex-direction:column; justify-content:center; gap:10px; padding:0 0 0 24px; border-left:4px solid {NAVY}">'
              f'{h3("절반으로", 40, NAVY)}{p("어느 화면에서든 상단 바에서 회원을 바로 찾는다", 26)}</div>')
# 변경 전·후 비교 장 — 카드 폭은 변경 전 단계 수로 정해 두 줄이 같은 폭(줄 길이 = 단계 수, log/216)
B = lambda i: f'/_blob/{i}'
STEPS2 = {
    'find': (['eb5ecdf3abab929917a20b2e81c57ec7', '66fc09257232b9637f6207aad4996732', '728b9b4995b572699227c198e32c3de4', 'fd29861f05e42c2f4f4f33bc88d7dd76'],
             ['34b4c7f62b1eaf60b2dab747fcecca04', 'a30c5d125e40b50b21dcfbf766746580']),
    'ptreg': (['db65429cc5ee204fa93bf734a9b695c5', '27b422970d66eb7ca19570bcfea3f043', 'f898dd90d2583a0b263ba285dde5c5b3', '8d91856a26aac3ee7dd8af0e4cb57f58', '3b05a593f4af5e0d16603cd9e199adc5',
               '44c847690fa8451109d2826e38589b69', '0ca0719e80b55594e272ed58c75bab5d', '7563119b8d42c5adda76172406fdbcd0', 'c39d307b4168da11af51fba342d833da', '5cb221b104960d034dbad8b17e8c03ad'],
              ['66c473e8be5b153e6be34e5de9962db4', '942dd787ce511cea4732e5589ffa428b', '711f8e07f5cc7bd84a53429b3ac269f0', '2ae6c78dced9a1a37a71e20af59674d5', '025ee2de2d7170e66a698ecfa407a741', '5a080e0b57252f643d8f1a0600ee5df4']),
    'miss': (['ffbca64c2102b4421e8be894828df140', 'f9a0c165d8ad65c60aaa03209d0d7ddc', '43f429e45fe1c5073a612710709a76f0', 'ba9334e0bbe2b22f3b40d0fc29792f20', '120b2098efdf9e2fad074b7ad0f23396',
              'e525495d1c41297a65a303fa620dbfb0', 'b4867e6314fd1abc9e0c0f5db5d91755', '8e76153f06b30f94fb104f4c85511027'],
             ['71ef08ae5946a9aa069cedff4cc00438', 'a7b4c253fa93f4a0a3113320260473c0', 'ed9ee00d56aae4a1906834b51bf464e5', 'e4f18312b7030a015b5cc95008ec6ec1', '82284829e596c6515accac14dd4a64b7',
              '2f13b3138cd6938c3890dffccea16106', '59ac59c640daa8783fe0a4dab2323d80']),
}


def compare_body(task, cap_before, cap_after, tail_title, tail_text):
    imgs_b, imgs_a = STEPS2[task]
    gap = 12
    w = int((1728 - 196 - gap * (len(imgs_b) - 1)) / len(imgs_b))
    h = int(w * 0.625)
    row = lambda tag, count, color, cards, tail='': (
        f'<div style="display:flex; gap:{gap}px; align-items:stretch">'
        f'<div style="width:180px; display:flex; flex-direction:column; justify-content:center; gap:6px; padding:0 4px 0 0">{mono(tag, color=color)}'
        f'<p style="font-family:{HEADF}; font-size:56px; font-weight:900; line-height:1; color:{color}">{count}</p><p style="font-size:24px; color:{SUB}">단계</p></div>'
        + ''.join(cards) + tail + '</div>')
    cb = [step_card(B(i), n, c, w, h) for n, (i, c) in enumerate(zip(imgs_b, cap_before), 1)]
    ca = [step_card(B(i), n, c, w, h) for n, (i, c) in enumerate(zip(imgs_a, cap_after), 1)]
    tail = ''
    if 1728 - 196 - len(ca) * (w + gap) >= 300:
        tail = (f'<div style="flex:1; display:flex; flex-direction:column; justify-content:center; gap:10px; padding:0 0 0 24px; border-left:4px solid {NAVY}">'
                f'{h3(tail_title, 40, NAVY)}{p(tail_text, 26)}</div>')
    return row('변경 전', len(imgs_b), SUB, cb) + row('변경 후', len(imgs_a), NAVY, ca, tail)


GREEN_NOTE = f'<p style="font-size:26px; color:{SUB}"><span style="color:{GREEN}">초록 점선</span> = 미리 채워져 있어 입력하지 않아도 되는 칸</p>'

S.append(('ux-find', content('ux-find', '사용감 · 접근 경로', '회원 찾아 상세 열기: 4단계 → 2단계',
    compare_body('find', ['회원 메뉴', '번호 입력', '검색 버튼', '회원 줄'], ['상단 바에 입력', '결과 고르기'], '절반으로', '어느 화면에서든 맨 위에서 바로 찾는다'),
    '같은 지점 관리자(서초점 김민수)가 전화번호 뒷자리(5678)로 회원(이수진)을 찾아 상세를 여는 과정. 위 줄 변경 전 앱(log/198 기준선 커밋), 아래 줄 지금 앱. 변경 전: 회원 메뉴 → 검색어 → 검색 버튼 → 회원 줄. 변경 후: 맨 위 빠른 찾기에 입력 → 결과 고르기. 새 API 없이 기존 회원 목록 API를 써서 지점 격리·전화번호 가림·권한이 그대로다(D72). 다른 지점 회원은 결과에 나오지 않는다(화면 자동 테스트).',
    '결정 기록 D72 · 주황 테두리·번호는 캡처 때 겹친 표시',
    lead='회원을 찾으려면 회원 목록 화면으로 가서 검색해야 했다. 이제 어느 화면에서든 맨 위 회원 빠른 찾기(이름 · 회원번호 · 전화번호)로 바로 연다.')))

S.append(('ux-pt-compare', content('ux-pt-compare', '사용감 · 접근 경로', 'PT 세션 차감: 6단계 → 3단계',
    step_row('변경 전', 6, SUB, before) + step_row('변경 후', 3, NAVY, after, after_tail),
    '같은 지점 관리자(서초점 김민수)가 같은 회원(이수진)의 PT 세션 1회를 차감하는 과정을 단계마다 찍었다. 위 줄은 변경 전 앱(log/198 기준선 커밋), 아래 줄은 지금 앱 — 둘 다 시연 데이터를 새로 얹은 로컬 DB. 주황 테두리와 번호가 그 단계에서 누르거나 입력하는 곳. 카드 폭을 같게 둬서 줄 길이가 곧 단계 수다. 변경 전: 회원 메뉴 → 이름 입력 → 검색 버튼 → 회원 줄 → PT 탭 → 세션 사용. 변경 후: 상단 바 빠른 찾기에 두 글자 → 결과 고르기(남은 PT가 있어 PT 탭이 먼저 열림) → 세션 사용. PT 세션 차감은 PT 수업이 끝날 때마다 지점(프런트)이 회원의 남은 횟수를 차감하는 관리자 업무다 — 회원이 스스로 차감하는 기능이 아니다. 자주 반복돼서 예로 골랐다. 회원 찾아 상세 열기(4 → 2)는 이 앞부분과 같다. 이렇게 말할 것: "자주 쓰는 기능의 접근 경로를 단순하게 해서 6단계를 3단계로 줄였다".',
    '결정 기록 D72 · 측정 log/198·200 · 강조 테두리는 캡처 때 겹친 표시',
    lead='PT 세션 차감 — PT 수업이 끝날 때마다 지점 관리자가 회원의 남은 PT 횟수를 1회 깎는 일. 화면 맨 위에 회원 빠른 찾기를 두고, 남은 PT가 있는 회원은 상세 화면이 PT 탭부터 열리게 했다.')))

S.append(('ux-ptreg', content('ux-ptreg', '사용감 · 접근 경로', 'PT 패키지 등록: 10단계 → 6단계',
    compare_body('ptreg', ['회원 메뉴', '이름 입력', '검색', '회원 줄', 'PT 탭', '패키지 등록', '프로그램', '세션 수', '구매일', '등록'],
                 ['상단 바 입력', '결과 고르기', '패키지 등록', '프로그램', '세션 수', '등록'], '', '') + GREEN_NOTE,
    '회원이 현장(프런트)에서 PT 패키지(예: 10회)를 사면 지점 관리자가 회원 상세에서 등록한다. 변경 전 10단계: 회원 메뉴 → 이름 → 검색 → 회원 줄 → PT 탭 → 패키지 등록 → 프로그램 → 세션 수 → 구매일 → 등록. 변경 후 6단계: 빠른 찾기 2단계 → (남은 PT가 있어 PT 탭이 먼저 열림) → 패키지 등록 → 프로그램 → 세션 수 → 등록. 구매일은 거의 항상 오늘이라 오늘로 채워 둔다(log/199) — 5번 카드의 초록 점선. 측정 회원은 남은 PT가 있다 — PT가 없는 회원이면 PT 탭을 한 번 눌러 7단계.',
    '빠른 찾기 D72 · 구매일 기본값 log/199',
    lead='회원이 현장(프런트)에서 PT를 사면 지점 관리자가 등록하는 일. 회원 찾기를 빠른 찾기로 줄이고, 거의 항상 오늘인 구매일을 미리 채웠다.')))

S.append(('ux-miss', content('ux-miss', '사용감 · 기본값', '직원 근태 누락일 등록: 8단계 → 7단계',
    compare_body('miss', ['직원 메뉴', '직원 줄', '누락일 등록', '날짜', '출근 시각', '퇴근 시각', '사유', '저장'],
                 ['직원 메뉴', '직원 줄', '누락일 등록', '날짜', '퇴근 시각', '사유', '저장'], '', '') + GREEN_NOTE,
    '직원이 출근 체크를 빠뜨린 날을 지점 관리자가 직원 상세에서 대신 등록한다. 변경 전에는 출근 시각을 매번 입력했다. 이제 그 직원이 파견된 지점의 기준 출근 시각(지각 판정에 이미 쓰던 값 — 서초 09:00, 강남 09:30)으로 채워 둔다(log/199) — 4번 카드의 초록 점선. 실제와 다르면 고치면 되고, 정정 사유가 필수이며 변경 이력에 남는다. 퇴근 시각은 기준이 없어 빈칸 그대로.',
    '출근 시각 기본값 log/199(근태관리 A-6 지점 기준 출근 시각)',
    lead='직원이 출근 체크를 빠뜨린 날을 지점 관리자가 대신 등록하는 일. 출근 시각을 그 지점의 기준 출근 시각으로 미리 채웠다(지점마다 다르다).')))

big = ''.join(
    f'<div style="flex:1; display:flex; flex-direction:column; background:{CARDBG}; border:1px solid {LINE2}; border-radius:14px; overflow:hidden; {SHADOW}">'
    f'<img src="{STEP[k]}" alt="{t}" style="width:549px; height:343px; object-fit:cover; background:{CARDBG}">'
    f'<div style="display:flex; flex-direction:column; gap:6px; padding:20px 24px; border-top:1px solid {LINE}">'
    f'<div style="display:flex; gap:12px; align-items:center"><p style="font-family:{MONOF}; font-size:28px; font-weight:700; color:{ACCENT}">{n}</p>{h3(t, 30)}</div>{p(d, 24)}</div></div>'
    for k, n, t, d in [('a1', 1, '상단 바에 두 글자', '0.3초 뒤 최대 5명. 전화번호는 가린 값'), ('a2', 2, '결과를 고르면 회원 상세', '다른 지점 회원은 결과에 없다'),
                       ('a3', 3, 'PT 탭이 먼저 열려 있다', '남은 PT가 있으면 PT 탭부터 — 바로 세션 사용')])
S.append(('ux-pt-after', content('ux-pt-after', '사용감 · 변경 후', '어느 화면에서든 회원을 바로 찾습니다',
    f'<div style="display:flex; gap:24px">{big}</div>'
    + p('새 API는 만들지 않았습니다 — 기존 회원 목록 API를 그대로 써서 지점 격리 · 전화번호 가림 · 권한이 함께 따라옵니다', 26, SUB, 'text-align:center'),
    '변경 후 3단계를 크게. 대안 네 개(입력 즉시 검색 / 상단 바 빠른 찾기 / 상세 탭 주소화·PT 먼저 / 결과에서 바로 세션 사용) 중 둘째·셋째를 골랐다(D72). 넷째가 효과는 가장 크지만 목록 API 변경과 실수로 누르기 위험이 있어 보류. 글자마다 호출이 늘지 않게 2자·0.3초 조건(무료 한도, D40). 다른 지점 회원이 안 나오는 것은 화면 자동 테스트가 확인한다(강남점 회원 이름으로 찾으면 결과 없음). 회원 조회 권한이 없는 직원에게는 이 칸이 없다.',
    '결정 기록 D72')))

S.append(('ux-order', content('ux-order', '사용감 · 화면 안 순서', '화면 안 순서를 규칙으로 정했습니다',
    flow([('1', '처리할 일', '승인 대기 등'), ('2', '지금 상태', '오늘의 근태 등'), ('3', '입력 폼', '휴가 신청 등'), ('4', '쌓이는 기록', '이번 달 기록 등')], active={0, 2})
    + p('예) 예약 관리의 회차 등록 입력란은 주간 시간표 아래에 있었다 → 화면 맨 위 버튼을 누르면 뜨는 창으로 옮겼다', 28, INK),
    '규칙(D73): 처리할 일 → 지금 상태 → 입력 폼 → 쌓이는 기록. 쌓이는 목록 아래에 있던 폼은 머리글 버튼 + 모달. 대안(화면 안 탭, 링크 위치만 바꾸기)은 D73에. 근태관리 화면을 이 순서로 재배치했고 휴가 승인함은 대기가 있을 때만 맨 위에 그린다. 쌓이는 목록(주간 시간표 등) 아래에 있던 회차 등록 폼은 머리글 버튼 + 모달로 옮겼다. 처리할 일이 맨 위라 화면을 열면 할 일부터 보인다.',
    '결정 기록 D73 · log/201',
    lead='화면마다 위아래 배치가 달라, 처리할 일이 아래에 묻히거나 입력란이 길게 쌓이는 목록 밑에 있었다. 근태관리 · 예약 관리 화면을 아래 순서로 다시 배치했다.')))

# 화면 안 순서(D73) 예시 — 근태관리 변경 전·후 전체 화면, 구역마다 앞 장 순서도의 번호(capture/annotate-attendance.py)
ORDER_COLORS = {1: '#C2410C', 2: NAVY, 3: GREEN, 4: '#6B7280'}
att_img = lambda src, w, alt: f'<img src="{src}" alt="{alt}" style="width:{w}px; height:640px; object-fit:contain; background:{CARDBG}; border:1px solid {LINE2}; border-radius:10px">'
legend = ''.join(
    f'<div style="display:flex; align-items:center; gap:16px"><div style="width:52px; height:52px; border-radius:26px; background:{ORDER_COLORS[n]}; display:flex; align-items:center; justify-content:center">'
    f'<p style="font-family:{HEADF}; font-size:30px; font-weight:900; color:#FFFFFF">{n}</p></div>{p(t, 28, INK)}</div>'
    for n, t in [(1, '처리할 일 — 휴가 승인'), (2, '지금 상태 — 오늘의 근태 · 휴가 일수'), (3, '입력 폼 — 업무일지 · 휴가 신청'), (4, '쌓이는 기록 — 근태 · 신청 내역 · 요약')])
S.append(('ux-order-shot', content('ux-order-shot', '사용감 · 화면 안 순서', '근태관리 화면에 적용한 예',
    f'<div style="display:flex; gap:32px; align-items:flex-start">'
    f'<div style="display:flex; flex-direction:column; gap:10px">{mono("변경 전", color=SUB)}{att_img("/_blob/27f18b494378da580962a5ac68374da6", 318, "변경 전 근태관리 화면 전체 — 구역 순서 2·4·3·4·3·4·1")}</div>'
    f'<div style="display:flex; flex-direction:column; gap:10px">{mono("변경 후")}{att_img("/_blob/e53fba9230484d8c74c9b3972a531d69", 336, "변경 후 근태관리 화면 전체 — 구역 순서 1·2·3·4")}</div>'
    f'<div style="flex:1; display:flex; flex-direction:column; gap:22px; padding:44px 0 0 0">{legend}'
    f'<div style="{CARD}; gap:10px">{p("휴가 승인(처리할 일)이 화면 맨 아래 → 맨 위", 28, INK)}{p("입력 폼이 기록 사이에 흩어져 있던 것 → 상태 다음에 나란히", 28, INK)}'
    f'<p style="font-size:24px; color:{SUB}"><span style="color:#C2410C">주황 점선</span> = 처음 열었을 때 보이는 범위</p></div></div></div>',
    '같은 지점 관리자(서초점 김민수)의 근태관리 화면을 위에서 아래까지 찍었다(시연 데이터, 1440×900 화면). 왼쪽은 변경 전 앱(log/198 기준선 커밋), 오른쪽은 지금 앱. 구역마다 앞 장 순서도의 번호를 겹쳤다 — 1 처리할 일, 2 지금 상태, 3 입력 폼, 4 쌓이는 기록. 변경 전은 2·4·3·4·3·4·1 순서라 처리해야 할 휴가 승인함이 맨 아래(위에서 약 2,200px)에 있었고, 업무일지·휴가 신청 입력란이 기록 사이에 흩어져 있었다. 변경 후는 1·2·3·4 순서 — 화면을 열면 승인할 휴가부터 보이고, 입력란 두 개는 상태 다음에 나란히 있다. 맨 아래 결근 확정은 번호를 붙이지 않았다(휴가 승인 뒤에 하는 처리라 마지막에 둔다, D73). 주황 점선이 처음 열었을 때 보이는 범위.',
    '결정 기록 D73 · 번호와 점선은 캡처 때 겹친 표시',
    lead='같은 화면(지점 관리자 근태관리)을 위에서 아래까지 찍었다. 번호는 앞 장 순서도의 번호다.')))

S.append(('ux-slot-compare', content('ux-slot-compare', '사용감 · 변경 전후', '회차 등록: 스크롤 2~3번 → 0번',
    f'<div style="display:flex; gap:40px; align-items:stretch">'
    f'<div style="width:700px; display:flex; flex-direction:column; gap:10px">'
    f'<div style="display:flex; align-items:baseline; gap:16px">{mono("변경 전", color=SUB)}{p("폼이 첫 화면(점선) 아래 — 시간표를 지나 스크롤", 24)}</div>'
    f'<img src="{STEP["slot_b"]}" alt="변경 전 예약 관리 화면 전체 — 첫 화면 경계 점선 아래에 회차 등록 폼" style="width:700px; height:633px; object-fit:contain; background:{CARDBG}; border:1px solid {LINE2}; border-radius:10px"></div>'
    f'<div style="flex:1; display:flex; flex-direction:column; gap:10px">'
    f'<div style="display:flex; align-items:baseline; gap:16px">{mono("변경 후")}{p("첫 화면의 버튼 → 모달", 24)}</div>'
    f'<div style="display:flex; gap:20px">'
    f'<div style="flex:1; display:flex; flex-direction:column; gap:8px"><img src="{STEP["slot_a1"]}" alt="변경 후 예약 관리 첫 화면, 회차 등록 버튼 강조" style="width:478px; height:356px; object-fit:contain; background:{CARDBG}; border:1px solid {LINE2}; border-radius:10px">{p("① 머리글의 “+ 회차 등록”", 24, INK)}</div>'
    f'<div style="flex:1; display:flex; flex-direction:column; gap:8px"><img src="{STEP["slot_a2"]}" alt="변경 후 회차 등록 모달" style="width:478px; height:356px; object-fit:contain; background:{CARDBG}; border:1px solid {LINE2}; border-radius:10px">{p("② 모달에서 같은 칸 입력", 24, INK)}</div></div>'
    f'<div style="{CARD}; gap:10px">{h3("스크롤 0번, 대신 누름 1번 추가", 30)}{p("단계는 6 → 7. 쌓이는 시간표·결제 내역이 길어질수록 커지던 스크롤이 없어졌다", 24)}</div></div></div>',
    '같은 지점 관리자로 예약 관리 화면을 연 직후. 왼쪽은 변경 전 앱의 화면 전체를 세로로 찍은 것 — 주황 점선이 1440×900 화면에서 처음 보이는 범위, 실선 상자가 회차 등록 폼(위에서 약 1,040px). 예약 현황·주간 시간표를 지나야 나온다(측정: 기준 시드 2번, 시연 데이터 3번 스크롤). 오른쪽은 지금 앱: 머리글 버튼 → 모달. 화면 안 순서 규칙(D73) — 쌓이는 목록 아래의 폼은 머리글 버튼 + 모달. 단계가 1 늘었다는 점(모달 여는 누름)을 숨기지 말고 말할 것. 덤: 권한이 꺼진 사람에게도 보이던 폼을 이제 버튼째 숨긴다(서버는 원래 거부).',
    '결정 기록 D73 · log/201 · 왼쪽 점선 = 첫 화면 경계(캡처 때 겹친 표시)')))

res_rows = [('전화번호로 회원 찾아 상세 열기', '4', '2', '빠른 찾기'), ('PT 세션 차감', '6', '3', '빠른 찾기 · PT 탭 먼저'),
            ('PT 패키지 등록', '10', '6', '구매일 기본값 · 빠른 찾기'), ('직원 근태 누락일 등록', '8', '7', '출근 시각 = 지점 기준'),
            ('휴가 승인 · 회차 등록 · 업무일지 · 휴가 신청', '스크롤 1~3', '스크롤 0', '화면 안 순서')]
tbl = (f'<table style="width:1728px; font-size:28px; color:{INK}"><tr style="background:{SOFT}">'
       f'<th style="width:44%; text-align:left">작업</th><th style="width:14%; text-align:right">처음</th><th style="width:14%; text-align:right">지금</th><th style="width:28%; text-align:left">무엇으로</th></tr>'
       + ''.join(f'<tr><td>{a}</td><td style="text-align:right; color:{SUB}">{b}</td><td style="text-align:right; color:{NAVY}">{c}</td><td style="color:{SUB}">{d}</td></tr>' for a, b, c, d in res_rows)
       + '</table>')
S.append(('ux-result', content('ux-result', '사용감 · 전후', '바뀐 것만 모으면 이렇습니다', tbl,
    '측정 20건 중 바뀐 것만. 숫자는 단계(누름 + 입력) — 마지막 줄만 스크롤 수. 기본값 두 가지(log/199): PT 구매일·수강 등록일 = 오늘, 누락일 출근 시각 = 그 지점의 기준 출근 시각(지각 판정에 이미 쓰던 값 — 지점마다 다르다, 서초 09:00·강남 09:30). 나머지 15건은 그대로. 남은 스크롤 두 곳(공지 등록 버튼, 회원 웹 예약 취소)은 발표 뒤 과제.',
    '단계 = 누름 + 입력 · 남은 스크롤 2곳(공지 등록 버튼 · 회원 웹 예약 취소)은 발표 뒤')))

# PART 02 목록 일관화
S.append(('p2', divider('p2', 'PART 02', '목록 일관화', '같은 동작은 같은 모양으로',
          '전수조사에서 목록마다 정렬·검색·CSV·확인 창이 제각각이었다(머리글 정렬 0곳, 검색 없는 목록 5개, CSV 4곳). 약 2분.')))

left = ''.join(f'<div style="display:flex; align-items:center; gap:14px"><x-icon name="Check" style="color:{GREEN}; width:30px; height:30px"></x-icon>{p(t, 28, INK)}</div>'
               for t in ['머리글을 눌러 정렬', '치는 대로 검색(0.3초)', '지금 화면 그대로 CSV 내려받기', '되돌리기 어려운 동작은 공통 확인 창'])
right = (f'<div style="display:flex; flex-direction:column; gap:14px">'
         f'<div style="display:flex; flex-direction:column; gap:8px; padding:24px 28px; border:2px solid {LINE2}; border-radius:14px; background:{CARDBG}">{mono("화면에서 정렬", color=AMBER)}{p("서버가 20건씩 나눠 주는 목록이면 지금 쪽 20건만 정렬된다", 28, INK)}</div>'
         f'<div style="display:flex; justify-content:center"><x-shape kind="arrow-down" style="background:{LINE2}; width:26px; height:40px"></x-shape></div>'
         f'<div style="display:flex; flex-direction:column; gap:8px; padding:24px 28px; border:2px solid {NAVY}; border-radius:14px; background:#E7ECF1">{mono("서버에서 정렬·검색")}{p("전체 순서를 정한 뒤 20건씩 — 쪽을 넘겨도 빠짐·겹침이 없다", 28, INK)}</div></div>')
S.append(('list-rule', content('list-rule', '목록 일관화', '정렬·검색은 데이터가 있는 곳에서 합니다',
    f'<div style="display:flex; gap:40px; align-items:stretch"><div style="{CARD}; width:760px">{h3("모양을 맞췄다")}{left}</div><div style="flex:1; display:flex; flex-direction:column; gap:14px">{h3("어디서 할지 정했다")}{right}</div></div>'
    + p('시간순이 뜻인 목록(결제 · 예약 · 변경 이력)은 정렬을 넣지 않았습니다. CSV를 더한 4개 화면은 출력 권한으로 막고, 직원 CSV에는 연락처를 넣지 않았습니다', 26),
    '1차(D74)는 화면만: 화면 전체를 불러오는 목록(직원·프로그램·강사)에 머리글 정렬, 회원 검색을 치는 대로, 브라우저 기본 확인 창 3곳을 공통 확인 창으로, 모든 모달에 dialog 역할·Esc·초점 복귀. 2차는 서버가 쪽을 나누는 목록이라 서버에 인자를 더했다 — 검색어(예약·자산·업무지원·변경 이력, 문서), 정렬(회원·자산·업무지원, 문서). 화면에서만 정렬하면 지금 쪽만 정렬돼 오해를 낳는다(D74 대안 b를 피한 이유). 정렬 뒤 같은 값은 id로 이어 쪽 경계가 흔들리지 않는다(테스트로 확인). 변경 이력 검색은 이력 행에 이름을 복사하지 않는 원칙(D44) 그대로 대상 id로 거른다. CSV 확대(직원·자산·문서·프로그램)는 세부 권한 카탈로그에 출력 칸을 더한 권한 결정(ADR-AUTH-09).',
    '결정 기록 D74 · 권한관리 ADR-AUTH-09')))

S.append(('list-shot', shot('list-shot', '목록 일관화 · 화면', '자산 목록', IMG['assets'], '자산 목록 — 검색창, 취득가액 내림차순 정렬, CSV 버튼',
    'admin · 지점 관리자 김민수 · 자산·비품',
    ['자산코드 · 품명 · 위치를 치는 대로 검색', '머리글을 누르면 서버가 정렬 — 지금은 취득가액 높은 순', '지금 검색 · 정렬 그대로 CSV로'],
    '실제 관리자 웹 화면(2026-11-09 로컬, 시연 데이터, 서초점 김민수). 취득가액 머리글을 두 번 눌러 내림차순(머리글의 ▼가 정렬 상태 — 화면 읽기 프로그램에도 정렬 상태가 전달된다). 서버 정렬은 api 테스트(list-sort)가 확인한다: 이름순을 쪽 넘겨 이어 붙이면 DB 순서와 같다, 지점 정렬도 자기 지점만. 자산 화면의 검색·정렬 자체는 화면 자동 테스트가 없다 — 검증은 API 테스트와 타입 검사까지(이렇게 말할 것).')))

# PART 03 문서 파일
S.append(('p3', divider('p3', 'PART 02', '문서 파일', '파일을 안전하게 올리고 여는 설계',
          '문서함에는 인사서류(근로계약서 등)처럼 개인정보가 담긴 파일이 들어간다. 파일을 올리고 여는 길을 어떻게 설계해 보안을 챙겼는지 보인다. 약 2분.')))

sec = cards_row([
    f'<x-icon name="Verified" style="color:{NAVY}; width:44px; height:44px"></x-icon>{h3("화면이 보낸 정보를 믿지 않는다", 30)}{p("올린 뒤 서버가 저장소에서 크기 · 형식 · 저장 위치를 직접 다시 확인한다", 26)}',
    f'<x-icon name="Lock" style="color:{NAVY}; width:44px; height:44px"></x-icon>{h3("주소가 새어도 60초 뒤 무효", 30)}{p("열 때마다 권한 · 지점을 검사하고 60초짜리 주소를 새로 만든다", 26)}',
    f'<x-icon name="Book" style="color:{NAVY}; width:44px; height:44px"></x-icon>{h3("누가 언제 열었는지 남는다", 30)}{p("파일을 열 때마다 변경 이력에 “문서 열람”으로 기록한다", 26)}',
])
S.append(('doc-flow', content('doc-flow', '문서 파일 · 설계', '올리기와 열기를 이렇게 설계했습니다',
    f'{mono("올리기", color=SUB)}' + flow([('1 · 서버', '올릴 주소 받기', '문서 입력 권한 확인'), ('2 · 브라우저', '저장소에 직접 올림', '파일이 서버를 거치지 않음'),
                                          ('3 · 서버', '저장소에서 다시 확인', '크기 · 형식 · 위치'), ('4 · 서버', '문서 등록', '확인을 통과한 파일만')], active={2})
    + sec,
    '설계 포인트(자원문서관리 ADR-RES-05). ① 파일은 브라우저가 저장소(Supabase Storage)에 직접 올린다 — 큰 파일이 서버(Lambda)를 거치지 않아 서버 부하·비용이 없다. 그 대신 화면이 보낸 크기·형식을 믿지 않고, 서버가 저장소에서 파일을 다시 확인한 뒤에만 문서로 등록한다(저장 위치가 그 문서 종류의 폴더인지도 본다). ② 저장소의 파일 주소는 화면에 주지 않는다. 열 때마다 권한과 지점 격리를 검사하고 60초짜리 서명 주소를 새로 만든다 — 주소가 밖으로 새어도 곧 쓸 수 없다. ③ 열 때마다 변경 이력에 "문서 열람"이 남는다(누가·언제·어느 문서). 계약서 파일(D69)과 같은 확인 로직을 함께 쓴다. 형식은 PDF·이미지·오피스·한글, 한 파일 10MB까지. 운영 반영: 스키마 변경을 승인 후 배포 DB에 먼저 적용, 운영 저장소로 올리기·열기를 사용자가 확인(11/9).',
    '자원문서관리 ADR-RES-05 · 계약서 파일과 같은 확인 로직(D69)',
    lead='문서함에는 근로계약서 같은 인사서류가 들어간다. 파일을 올리고 여는 길을 위조된 파일 · 주소 유출 · 무단 열람에 대비해 설계했다.')))

S.append(('doc-shot', shot('doc-shot', '문서 파일 · 화면', '문서함', IMG['docs'], '문서함 — 맨 위 줄이 올린 파일 문서',
    'admin · 지점 관리자 김민수 · 문서함',
    ['문서를 올리면 제목 아래에 파일 이름이 보인다(맨 위 줄)', '제목을 누르면 파일이 열리고, 열 때마다 기록이 남는다', 'PDF · 이미지 · 오피스 · 한글 파일, 10MB까지'],
    '실제 관리자 웹 화면(2026-11-09 로컬, 시연 데이터, 서초점 김민수). 캡처 전에 화면에서 매뉴얼 분류로 PDF 한 건("시설 안전 점검 매뉴얼", 내용 없는 시연용 PDF)을 실제로 올렸다 — 맨 위 줄. 로컬은 메모리 저장소, 운영은 Supabase Storage. 문서함 PDF 올리기 → 검색 → 내려받기는 화면 자동 테스트 1건이 본다. 직원 상세의 인사서류 열기는 화면 자동 테스트가 없다.')))

# PART 04 운영 실적 차트
S.append(('p4', divider('p4', 'PART 03', '운영 실적 차트', '운영 데이터가 계약 판단으로 돌아가는 길',
          '사업 구조의 순환 — 운영 데이터가 다시 올라와 계약 갱신·영업 근거가 된다 — 를 화면에서 읽을 수 있게. 약 2분.')))

cycle = flow([('위탁 계약', '지점', '계약 회차'), ('운영', '회원 · 예약 · 결제', ''), ('운영 실적', '월별 집계', ''), ('계약 판단', '갱신 · 영업 근거', '')], active={2})
S.append(('chart-why', content('chart-why', '운영 실적 차트', '운영 실적을 기간으로 봅니다',
    cycle + f'<div style="display:flex; gap:20px"><div style="{CARD}; flex:1">{h3("누가 무엇을 보나")}{p("본사 — 전사 13개월 추이와 지난달 지점별 비교<br>지점 관리자 — 자기 지점 13개월")}</div>'
    f'<div style="{CARD}; flex:1">{h3("어떻게 그렸나")}{p("라이브러리 없이 직접 그린 차트, 지표마다 한 장. 진행 중인 달은 옅게 + “진행 중” 글자, 표로 보기")}</div></div>',
    '10주차까지 대시보드 숫자는 현재값뿐이었고(가짜 추세선은 예전에 뺐다, log/129), 지점 운영 실적은 3개월 표뿐이었다. D75: 기존 월별 실적 집계를 최대 13개월로 늘리고 전사 합계 API(본사 전용)를 더했다 — 같은 쿼리 4개를 지점 조건만 바꿔 쓴다. 도구는 직접 그린 SVG(Recharts는 번들·의존성·라이선스 목록 부담). 색은 검사 스크립트로 골랐다: 브랜드 색(teal-700)은 채도가 낮아 회색으로 읽혀 차트는 teal-600. 진행 중인 달의 옅은 색은 대비가 낮아서 "진행 중" 글자와 표로 보기를 함께 둔다 — 색만으로 말하지 않는다.',
    '결정 기록 D75 · log/208',
    lead='전에는 대시보드에 지금 숫자만 있었고, 지점 운영 실적은 최근 3개월 표뿐이었다. 위탁 계약을 갱신할지 판단하려면 매출 · 예약 · 회원의 기간 추이가 필요하다.')))

S.append(('chart-shot', shot('chart-shot', '운영 실적 차트 · 화면', '본사 대시보드 — 전사 운영 실적', IMG['chart'], '전사 운영 실적 월별 차트 4장과 지점별 순매출',
    'admin · 본사 정하늘 · 대시보드',
    ['순매출 · 예약 · 이용 완료 · 신규 회원, 지난 12개월 + 이번 달', '이번 달은 옅게, “진행 중”', '지난달 지점별 순매출 비교'],
    '실제 관리자 웹 화면(2026-11-09 로컬, 본사 정하늘). 주의 — 시연 데이터는 실행일 기준 지난 90일만 만든다(D58). 그래서 8월 이전 달의 예약·매출 막대가 거의 비어 있다. 실제 운영이면 모든 달이 찬다(이렇게 설명할 것: "시연 데이터가 90일치라서"). 신규 회원은 기준 시드의 가입일이 1년에 퍼져 있어 모든 달에 있다. 노원점은 계약 종료 지점이라 지난달 매출 0. 숫자 카드(지난달 값·전달 대비·12개월 추세선)는 대시보드 위쪽에 있다. 차트는 화면 자동 테스트 1건이 본다(숫자 카드 4개·차트 13칸·키보드 초점 툴팁·지점 상세 표로 보기 13행).')))

# RFP
# 회원 앱 형태 — 10주차 다음 할 일 세 번째의 결론(D77)
S.append(('p5', divider('p5', 'PART 04', '회원 앱 형태', '앱으로 다시 만들지, 지금 모바일 웹을 쓸지',
          '10주차 다음 할 일의 세 번째. 결론은 지금 모바일 웹 유지(D77). 약 1분.')))

app_rows = [('', '지금 모바일 웹(유지)', '하이브리드(웹을 앱으로 감싸기)', '네이티브 앱'),
            ('화면', '지금 그대로', '지금 화면 재사용', '처음부터 다시'),
            ('코드 · 배포', '하나 — 관리자 웹과 함께 배포', '앱 빌드 · 배포가 따로 생김', '앱 코드가 따로 생김'),
            ('스토어', '없음(홈 화면에 설치)', '계정 · 심사 · 버전 관리', '계정 · 심사 · 버전 관리'),
            ('얻는 것', '—', '스토어 노출', '푸시 · 카메라 등 휴대폰 기능')]
app_tbl = (f'<table style="width:1728px; font-size:28px; color:{INK}">'
           + ''.join(
               (f'<tr style="background:{SOFT}">' if i == 0 else '<tr>')
               + ''.join((f'<th style="width:{w}%; text-align:left">{c}</th>' if i == 0 else
                          f'<td style="color:{NAVY if j == 1 else (SUB if j == 0 else INK)}">{c}</td>')
                         for j, (c, w) in enumerate(zip(r, (16, 28, 28, 28))))
               + '</tr>' for i, r in enumerate(app_rows))
           + '</table>')
S.append(('member-app', content('member-app', '회원 앱 형태', '회원 앱은 지금처럼 모바일 웹으로 갑니다',
    app_tbl
    + f'<div style="display:flex; align-items:center; gap:16px; padding:20px 28px; background:{SOFT}; border-radius:12px"><x-icon name="Check" style="color:{GREEN}; width:30px; height:30px"></x-icon>'
    f'{p("지금 회원 기능(예약 · 결제 · 공지 · 혼잡도)에 휴대폰 고유 기능이 필요한 것은 없다 — 앱으로 다시 만들면 유지보수만 늘고 같은 화면을 담는 수준이다", 28, INK)}</div>',
    '10주차 다음 할 일의 세 번째, 회원 앱 형태 재검토의 결론(D77). 지금 회원 기능은 회원 모바일 웹(/m/)이 홈 화면 설치(PWA)까지 제공한다. 비교한 대안: 하이브리드(지금 웹을 앱으로 감싸기 — 화면은 재사용하지만 스토어 배포·빌드 경로가 따로), 네이티브(React Native — 화면을 다시 만들고 코드가 둘). 결정 이유: 유지보수 부담이 크고, 지금 기능 중 푸시·카메라·생체 인증 같은 휴대폰 기능이 필요한 게 없어 네이티브로 만들어도 구색 갖추기에 그친다. 감수하는 것: 앱스토어에 노출되지 않는다, 푸시 알림·QR 체크인은 만들 수 없다(둘 다 이미 범위 제외). 다시 볼 때: 이런 휴대폰 기능을 범위에 넣을 때, 또는 실운영에서 설치 불편이 이용률 문제로 측정될 때.',
    '결정 기록 D77(D40 · D41 · D45 유지) · 다시 볼 때: 푸시 알림 · QR 체크인처럼 휴대폰 기능이 필요해질 때',
    lead='10주차에 남긴 검토 — 회원 기능을 앱으로 다시 만들지. 결론은 지금의 모바일 웹(홈 화면에 설치되는 웹)을 그대로 쓴다.')))

S.append(('p6', divider('p6', 'PART 05', 'RFP 충족률', '충족률 산정 방식을 바꿔 다시 셌습니다',
          'RFP 조항 72개의 충족률을 할 수 없는 조항(해당 없음)을 빼고 다시 셌다(D76). 약 2분.')))

S.append(('rfp', content('rfp', 'RFP 충족률', '충족률 산정 방식을 바꿨습니다',
    f'<div style="display:flex; gap:40px; align-items:stretch"><div style="{CARD}; width:560px; justify-content:center">'
    f'<p style="font-family:{HEADF}; font-size:160px; font-weight:900; line-height:1; color:{NAVY}">94%</p>{h3("58 / 62 조항")}'
    f'<div style="display:flex; align-items:center; gap:14px"><p style="font-family:{HEADF}; font-size:44px; font-weight:700; color:{SUB}; text-decoration:line-through">81%</p>{p("옛 방식 58 / 72")}</div></div>'
    f'<div style="flex:1; display:flex; flex-direction:column; gap:20px">'
    f'<div style="{CARD}">{mono("바꾼 것 1")}{h3("해당 없음 10개는 분모에서 뺀다")}{p("발주기관 승인 · 납품 계약 · 대면 교육처럼 이 프로젝트에 대상이 없는 조항. 건수는 표에 그대로 둔다")}</div>'
    f'<div style="{CARD}">{mono("바꾼 것 2")}{h3("두 조항을 부분 → 해당 없음으로")}{p("검수 · 도입(발주기관이 있어야 함), 업무위탁 계약서 서명(실운영이 전제)")}</div></div></div>'
    f'<div style="display:flex; align-items:center; gap:16px; padding:20px 28px; background:#F6ECDD; border-radius:12px"><x-icon name="Warning" style="color:{AMBER}; width:30px; height:30px"></x-icon>'
    f'{p("남은 미충족 4개 — 결제 테스트 키 실제 호출 1(부분) · 의도적 제외 3(유사기업 분석 2 · 기대효과 분석)", 28, INK)}</div>',
    '중요 — 숫자가 오른 이유는 기능이 늘어서가 아니라 산정 방식을 바꿔서다. 이렇게 말할 것. 전에는 분모가 72조항 전부였고(해당 없음도 미충족처럼 계산) 81%. 이제 해당 없음 10개를 분모에서 빼서 58/62 = 94%(D76). 해당 없음은 발주기관 승인·납품 계약·하자보수·대면 교육처럼 이 프로젝트가 할 수 없는 조항. 이번에 검수·도입(T3-2)과 업무위탁 계약서(N8-2)도 해당 없음으로 옮겼다 — 기대효과 분석은 따로 세는 조항(P2-2)이 있어 가려지지 않는다. 하지 않기로 한 3개(의도적 제외)는 분모에 남겼다 — 할 수 없는 것과 안 한 것을 구분. 영역별: 기능·성능 28/28 = 100%, 시스템~제약 17/18 = 94%, 과업·산출물 13/16 = 81%. 질문 대비: 결제 테스트 키 호출은 계약 없이 할 수 있어서 부분으로 남겼다.',
    '결정 기록 D76 · 판정 원천 요구사항추적표 §3',
    lead='RFP(발주처 제안요청서)의 요구를 72개 조항으로 나눠, 조항마다 구현 · 조정 · 부분 · 미구현 · 해당 없음으로 판정해 왔다.')))

# 정리
nexts = [('Chart', '계약 갱신용 영업 리포트', '지점 운영 실적을 계약 갱신 협상 · 신규 입찰 자료로 뽑는다 — 이번 차트 부품 재사용'),
         ('Book', '산출물 다시 만들기', '요구사항 · 데이터 정의서, 사용자 매뉴얼, 설계서를 지금 화면 · 스키마로'),
         ('Search', '사용감 더 점검하기', '자주 쓰는 다른 작업에서도 불필요한 단계 · 화면 구성을 찾아 줄인다')]
S.append(('wrap', content('wrap', '정리', '다음 할 일', cards_row([
    f'<x-icon name="{ic}" style="color:{NAVY}; width:48px; height:48px"></x-icon>{h3(t)}{p(d)}' for ic, t, d in nexts]),
    '다음 할 일. 영업 리포트는 사업 구조의 "운영 데이터 → 계약 갱신 · 영업 근거" 순환의 마지막 고리 — 이번 운영 실적 차트를 본사가 갱신 협상이나 신규 수주 입찰(PT)에 쓰는 자료로 뽑는다(차별화전략 §2). 사용감은 아직 개선 여지가 있어 다른 작업도 계속 점검한다. 산출물은 최종 제출 전에 지금 화면·스키마·도움말로 다시 만든다. 검증 범위(질문 대비): api 자동 테스트 631건(실DB), 화면 자동 테스트 24건(역할별 핵심 경로) — 그 밖의 화면은 lint · 빌드까지.',
    lead='10주차의 다음 할 일 세 가지를 마쳤다. 남은 것은 운영 데이터를 계약 판단 자료로 잇는 일, 사용감 추가 점검, 제출 준비다.')))

S.append(('closing', f'<section id="closing" data-transition="fade" style="background:{BG}; color:{INK}; font-family:{BODYF}; padding:128px 176px; display:flex; flex-direction:column; gap:24px">{DOTS}'
          f'<div style="flex:1"></div><h1 style="font-family:{HEADF}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:{INK}">감사합니다</h1><div style="flex:1"></div>'
          f'{notes("맺음(말로): 자주 쓰는 기능의 접근 경로를 단순하게 했고(PT 세션 차감 6단계 → 3단계), 문서함에 실제 파일을 올리게 했고, 운영 실적을 기간으로 보게 했고, 회원 앱은 지금 모바일 웹을 유지하기로 해 10주차의 다음 할 일 세 가지를 마쳤습니다. RFP 충족률은 할 수 없는 조항을 분모에서 빼 94%로 다시 셌고, 옛 방식으로는 81%입니다.")}</section>'))

# 2026-11-09 사용자 검토로 뺀 장(log/214) — 측정 수치·기준선·스크롤 비교·전후 표는 "접근 경로 단순화" 한 문장과 6 → 3 비교로 충분하고,
# 목록 일관화(정렬·검색·CSV)는 원래 있었어야 할 기본기라 발표 거리로 삼지 않는다.
DROP = {'doc-shot', 'ux-measure', 'ux-found', 'ux-pt-after', 'ux-slot-compare', 'ux-result', 'p2', 'list-rule', 'list-shot'}
S = [(sid, html) for sid, html in S if sid not in DROP]

os.makedirs(os.path.join(OUT, 'project', 'slides'), exist_ok=True)
for sid, html in S:
    assert html.count('<section') == 1 and f'id="{sid}"' in html, sid
    with open(os.path.join(OUT, 'project', 'slides', f'{sid}.html'), 'w', encoding='utf-8') as f:
        f.write(html)

order = [sid for sid, _ in S]
deck = {
    'v': 4,
    'createdOnFiles': {'v': 1, 'at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')},
    'lists': 'css',
    'title': '스포이즘 ERP 11주차 발표',
    'order': order,
    'sections': {
        'intro': {'description': '표지, 오늘 순서 — 10주차의 다음 할 일에서 출발', 'start': 'cover'},
        'ux': {'description': '01 사용감 — 자주 쓰는 기능의 접근 경로 단순화(PT 세션 차감 6 → 3), 화면 안 순서 규칙', 'start': 'p1'},
        'doc': {'description': '02 문서 파일 — 올리기와 열기를 안전하게(서버 재확인 · 60초 주소 · 열람 기록)', 'start': 'p3'},
        'chart': {'description': '03 운영 실적 차트 — 13개월 추이와 지점 비교', 'start': 'p4'},
        'app': {'description': '04 회원 앱 형태 — 지금 모바일 웹 유지(D77)', 'start': 'p5'},
        'rfp': {'description': '05 RFP 충족률 — 해당 없음을 분모에서 빼고 다시 셈(D76)', 'start': 'p6'},
        'wrap': {'description': '다음 할 일', 'start': 'wrap'},
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
