# 4-8 최종 발표 덱 생성기 — 10주차 덱(https://claude.ai/artifact/YS4CX2S87R882cwTdjPxzZ)과 같은 색·글꼴·머리말·카드·브라우저 프레임(4-0 §4).
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


def content(sid, lab, title, body, note, footer=''):
    return (f'<section id="{sid}" data-transition="fade" style="background:{BG}; color:{INK}; font-family:{BODYF}; padding:72px 96px 120px; display:flex; flex-direction:column; gap:16px">'
            f'{label(lab)}{h2(title)}<div style="flex:1; display:flex; flex-direction:column; justify-content:center; gap:32px">{body}</div>'
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
          f'<div style="flex:1"></div><div style="display:flex"><p style="font-family:{MONOF}; font-size:24px; letter-spacing:2px; color:{NAVY}; background:#E7ECF1; border:1px solid {LINE}; border-radius:999px; padding:8px 24px">SPOISM ERP · FINAL</p></div>'
          f'<h1 style="font-family:{HEADF}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:{INK}">스포이즘 ERP</h1>'
          f'<p style="font-size:52px; font-weight:500; color:{SUB}">최종 발표</p><div style="height:36px"></div>'
          f'<p style="font-family:{MONOF}; font-size:28px; color:{SUB}"><b>발표자</b>&#160; 박정현 &#160;&#160;·&#160;&#160; <b>범위</b>&#160; 10주차 발표(11/5) 이후 ~ 2026-11-09</p>'
          f'<div style="flex:1"></div>{notes("최종 발표. 범위는 10주차 발표(11/5, 계약 관리·동시성) 이후 작업. 라이브 데모 없이 로컬 실행 화면 캡처로 보인다. 15분 — 사용감 5분, 목록·문서·차트 각 2분, RFP와 정리 3분.")}</section>'))

# 2 순서
todo = ''.join(
    f'<div style="display:flex; align-items:center; gap:14px; padding:14px 22px; background:{CARDBG}; border:1px solid {LINE}; border-radius:12px">'
    f'<x-icon name="{ic}" style="color:{c}; width:30px; height:30px"></x-icon><p style="font-size:28px; color:{INK}">{t}</p>{pill(s, c, bg)}</div>'
    for ic, c, bg, t, s in [('Check', GREEN, '#E3F1EA', '문서 관리 실제 파일 업로드', '03'),
                            ('Check', GREEN, '#E3F1EA', '사용감 개선', '01 · 02 · 04'),
                            ('Clock', AMBER, '#F6ECDD', '회원 앱 형태 재검토', '발표 뒤')])
rows = ''.join(
    f'<div style="display:flex; align-items:center; gap:28px; padding:22px 28px; background:{CARDBG}; border:1px solid {LINE}; border-radius:12px">'
    f'<p style="font-family:{MONOF}; font-size:28px; font-weight:700; color:{NAVY}; width:60px">{n}</p>'
    f'<p style="font-family:{HEADF}; font-size:36px; font-weight:700; color:{INK}; width:420px">{t}</p><p style="font-size:30px; color:{SUB}">{d}</p></div>'
    for n, t, d in [('01', '사용감', '단계 수를 재고 줄였다'), ('02', '목록 일관화', '정렬·검색·CSV·확인 창'),
                    ('03', '문서 파일', '실제 파일 올리기·열람 기록'), ('04', '운영 실적 차트', '13개월 추이·지점 비교'),
                    ('+', 'RFP 충족률', '산정 방식을 바꿨다')])
S.append(('agenda', content('agenda', '오늘 순서', '지난주 “다음 할 일”에서 출발합니다',
          f'<div style="display:flex; gap:40px; align-items:flex-start"><div style="width:620px; display:flex; flex-direction:column; gap:14px">{mono("10주차의 다음 할 일", color=SUB)}{todo}</div>'
          f'<div style="flex:1; display:flex; flex-direction:column; gap:14px">{rows}</div></div>',
          '10주차 마지막 장의 다음 할 일 세 개에서 출발한다. 문서 파일 업로드는 03, 사용감 개선은 01·02·04로 했다. 회원 앱 형태 재검토는 하지 않았다 — 발표 뒤 선택 과제로 남겼다(이렇게 말할 것: "하지 않았다", "진행 중"이라고 하지 말 것). 마지막에 RFP 충족률 산정 방식을 바꾼 것을 따로 설명한다.',
          '10주차 발표(11/5) 이후 작업 · 결정 기록 D72~D76')))

# PART 01 사용감
S.append(('p1', divider('p1', 'PART 01', '사용감', '느낌이 아니라 단계 수를 재고 줄였습니다',
          '사용감 개선은 "더 편하게"라는 말로는 무엇을 고칠지 고를 수 없다. 그래서 먼저 쟀다. 이 파트가 발표의 중심(약 5분).')))

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

S.append(('ux-quick', content('ux-quick', '사용감 · 회원 찾기', '회원은 어느 화면에서든 바로 찾습니다',
    f'<div style="display:flex; gap:56px; align-items:center"><div style="width:760px; display:flex; flex-direction:column; gap:28px">'
    f'<div style="display:flex; flex-direction:column; gap:8px">{h3("상단 바 빠른 찾기")}{p("두 글자를 치면 0.3초 뒤 최대 5명 — 고르면 회원 상세로")}</div>'
    f'<div style="display:flex; flex-direction:column; gap:8px">{h3("남은 PT가 있으면 PT 탭부터")}{p("회원 상세의 탭을 주소에 두고, 진행 중인 PT가 있으면 PT 탭을 먼저 연다")}</div>'
    f'<div style="display:flex; flex-direction:column; gap:8px">{h3("새 API는 만들지 않았다")}{p("기존 회원 목록 API 그대로 — 지점 격리 · 전화번호 가림 · 권한이 함께 따라온다")}</div></div>'
    f'<div style="flex:1; {CARD}; gap:28px">{bar_row("회원 찾아 상세 열기", 4, 2)}{bar_row("PT 세션 차감", 6, 3)}{bar_row("PT 패키지 등록", 10, 6, unit=56)}</div></div>',
    '대안 네 개(입력 즉시 검색 / 상단 바 빠른 찾기 / 상세 탭 주소화·PT 먼저 / 빠른 찾기 결과에서 바로 세션 사용)를 비교해 둘째·셋째를 골랐다(D72). 넷째가 효과는 가장 크지만 목록 API 변경과 실수로 누르기 위험이 있어 보류. 수치는 측정 도구로 전후를 잰 값: 회원 찾기 4→2, PT 세션 차감 6→3. PT 패키지 등록 10→6은 기본값 채우기(구매일 = 오늘, 10→9)와 빠른 찾기를 합친 값이고, 측정 회원은 PT가 있어 PT 탭이 먼저 열린다(PT가 없는 회원이면 7). 글자마다 호출이 늘지 않게 2자·0.3초 조건(무료 한도, D40).',
    '결정 기록 D72 · 측정 log/200')))

S.append(('ux-quick-shot', shot('ux-quick-shot', '사용감 · 화면', '상단 바 회원 빠른 찾기', IMG['quick'], '상단 바 회원 빠른 찾기 결과 목록',
    'admin · 지점 관리자 김민수 · 대시보드',
    ['이름 · 회원번호 · 전화번호 어느 것으로도 찾는다', '전화번호는 회원 목록처럼 가린 값으로', '다른 지점 회원은 결과에 나오지 않는다'],
    '실제 관리자 웹 화면(2026-11-09 로컬 실행, 시연 데이터를 새로 얹은 DB, 서초점 지점 관리자 김민수). 대시보드 위에서 "이수"를 친 상태. 3번(다른 지점 회원이 안 나옴)은 화면 자동 테스트가 확인한다 — 강남점 회원 이름으로 찾으면 결과 없음. 키보드 위·아래·Enter·Esc로 고를 수 있다. 회원 조회 권한이 없는 사람(직원)에게는 이 칸이 없다.')))

S.append(('ux-order', content('ux-order', '사용감 · 화면 안 순서', '화면 안 순서를 규칙으로 정했습니다',
    flow([('1', '처리할 일', '승인 대기 등'), ('2', '지금 상태', '오늘의 근태 등'), ('3', '입력 폼', '휴가 신청 등'), ('4', '쌓이는 기록', '이번 달 기록 등')], active={0, 2})
    + f'<div style="display:flex; gap:20px"><div style="{CARD}; flex:1">{h3("쌓이는 목록 아래 폼은 버튼 + 모달로")}{p("회차 등록 폼은 주간 시간표 아래에 있었다 — 머리글 버튼으로 옮기고 모달로 연다")}</div>'
    f'<div style="{CARD}; flex:1">{h3("대상 작업 4개 스크롤 → 0")}{p("휴가 승인 · 회차 등록 · 업무일지 · 휴가 신청. 회차 등록은 모달을 여는 누름 1번이 늘었다(6 → 7단계)")}</div></div>',
    '규칙(D73): 처리할 일 → 지금 상태 → 입력 폼 → 쌓이는 기록. 쌓이는 목록 아래에 있던 폼은 머리글 버튼 + 모달. 대안(화면 안 탭, 링크 위치만 바꾸기)은 D73에. 근태관리 화면을 이 순서로 재배치했고 휴가 승인함은 대기가 있을 때만 맨 위에 그린다. 회차 등록은 스크롤 2~3번이 0이 된 대신 모달을 여는 누름이 하나 늘었다 — 숨기지 말고 말할 것. 덤으로: 회차 등록 폼이 권한이 꺼져도 보이던 것을 버튼 숨김으로 고쳤다(서버는 원래 거부).',
    '결정 기록 D73 · log/201')))

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
S.append(('p3', divider('p3', 'PART 03', '문서 파일', '문서함에 실제 파일을 올립니다',
          '10주차까지 문서함의 문서는 가짜 주소였다. 계약서 파일(D69)에서 만든 올리기 방식을 문서에도 썼다. 약 2분.')))

S.append(('doc-flow', content('doc-flow', '문서 파일', '파일은 서버를 거치지 않고, 열 때마다 남깁니다',
    f'{mono("올리기", color=SUB)}' + flow([('1 · 서버', '올릴 주소 받기', '문서 입력 권한 확인'), ('2 · 브라우저', '저장소에 직접 올림', '서버를 거치지 않음'),
                                          ('3 · 서버', '저장소에서 다시 확인', '크기 · 형식 · 경로'), ('4 · 서버', '문서 등록', '파일 1개 = 문서 1건')], active={2})
    + f'{mono("열기", color=SUB)}' + flow([('서버', '60초짜리 주소', '지점 격리 검사 뒤 발급'), ('변경 이력', '문서 열람 기록', '누가 언제 열었나')], active={1})
    + p('옛 링크 문서는 그대로 두고 표시만 · 계약 파일과 같은 확인 로직을 함께 씀 · 배포 DB 마이그레이션까지 운영 반영', 26),
    '흐름(ADR-RES-05): 서버가 올릴 주소를 주고, 브라우저가 저장소(Supabase Storage)에 직접 올리고, 서버가 저장소에서 크기·형식·경로를 다시 확인한 뒤 등록한다 — 큰 파일이 Lambda를 거치지 않고, 화면이 보낸 정보를 믿지 않는다. 열 때는 60초짜리 서명 주소 + 변경 이력에 "문서 열람"(변경 이력 20종째). 기존 가짜 주소 문서 15건은 지우지 않고 "옛 링크 문서"로 표시, 시연용 가짜 주소는 열기 409. 계약 파일(D69)과 문서 파일이 같은 확인 로직을 쓰도록 모았다 — 그 덕에 계약 파일도 경로 접두사를 서버가 다시 본다. 스키마 변경(칸 추가 + CHECK)은 승인 후 배포 DB에 먼저 적용하고 병합했다. 운영 저장소로 올리기·열기는 사용자가 운영에서 확인(11/9).',
    '자원문서관리 ADR-RES-05 · log/206 · 운영 반영 log/207')))

S.append(('doc-shot', shot('doc-shot', '문서 파일 · 화면', '문서함', IMG['docs'], '문서함 — 올린 파일 문서와 옛 링크 문서',
    'admin · 지점 관리자 김민수 · 문서함',
    ['올린 문서는 파일 이름, 이전 문서는 “옛 링크 문서”', '제목을 누르면 열린다 — 열 때마다 기록', '서버가 나눠 주는 목록 + 검색 · 정렬'],
    '실제 관리자 웹 화면(2026-11-09 로컬, 시연 데이터, 서초점 김민수). 캡처 전에 화면에서 매뉴얼 분류로 PDF 한 건("시설 안전 점검 매뉴얼", 내용 없는 시연용 PDF)을 실제로 올렸다 — 맨 위 줄. 로컬은 메모리 저장소, 운영은 Supabase Storage. 문서함 PDF 올리기 → 검색 → 내려받기는 화면 자동 테스트 1건이 본다. 직원 상세의 인사서류 열기는 화면 자동 테스트가 없다.')))

# PART 04 운영 실적 차트
S.append(('p4', divider('p4', 'PART 04', '운영 실적 차트', '운영 데이터가 계약 판단으로 돌아가는 길',
          '사업 구조의 순환 — 운영 데이터가 다시 올라와 계약 갱신·영업 근거가 된다 — 를 화면에서 읽을 수 있게. 약 2분.')))

cycle = flow([('위탁 계약', '지점', '계약 회차'), ('운영', '회원 · 예약 · 결제', ''), ('운영 실적', '월별 집계', ''), ('계약 판단', '갱신 · 영업 근거', '')], active={2})
S.append(('chart-why', content('chart-why', '운영 실적 차트', '운영 실적을 기간으로 봅니다',
    cycle + f'<div style="display:flex; gap:20px"><div style="{CARD}; flex:1">{h3("누가 무엇을 보나")}{p("본사 — 전사 13개월 추이와 지난달 지점별 비교<br>지점 관리자 — 자기 지점 13개월")}</div>'
    f'<div style="{CARD}; flex:1">{h3("어떻게 그렸나")}{p("라이브러리 없이 직접 그린 차트, 지표마다 한 장. 진행 중인 달은 옅게 + “진행 중” 글자, 표로 보기")}</div></div>',
    '10주차까지 대시보드 숫자는 현재값뿐이었고(가짜 추세선은 예전에 뺐다, log/129), 지점 운영 실적은 3개월 표뿐이었다. D75: 기존 월별 실적 집계를 최대 13개월로 늘리고 전사 합계 API(본사 전용)를 더했다 — 같은 쿼리 4개를 지점 조건만 바꿔 쓴다. 도구는 직접 그린 SVG(Recharts는 번들·의존성·라이선스 목록 부담). 색은 검사 스크립트로 골랐다: 브랜드 색(teal-700)은 채도가 낮아 회색으로 읽혀 차트는 teal-600. 진행 중인 달의 옅은 색은 대비가 낮아서 "진행 중" 글자와 표로 보기를 함께 둔다 — 색만으로 말하지 않는다.',
    '결정 기록 D75 · log/208')))

S.append(('chart-shot', shot('chart-shot', '운영 실적 차트 · 화면', '본사 대시보드 — 전사 운영 실적', IMG['chart'], '전사 운영 실적 월별 차트 4장과 지점별 순매출',
    'admin · 본사 정하늘 · 대시보드',
    ['순매출 · 예약 · 이용 완료 · 신규 회원, 지난 12개월 + 이번 달', '이번 달은 옅게, “진행 중”', '지난달 지점별 순매출 비교'],
    '실제 관리자 웹 화면(2026-11-09 로컬, 본사 정하늘). 주의 — 시연 데이터는 실행일 기준 지난 90일만 만든다(D58). 그래서 8월 이전 달의 예약·매출 막대가 거의 비어 있다. 실제 운영이면 모든 달이 찬다(이렇게 설명할 것: "시연 데이터가 90일치라서"). 신규 회원은 기준 시드의 가입일이 1년에 퍼져 있어 모든 달에 있다. 노원점은 계약 종료 지점이라 지난달 매출 0. 숫자 카드(지난달 값·전달 대비·12개월 추세선)는 대시보드 위쪽에 있다. 차트는 화면 자동 테스트 1건이 본다(숫자 카드 4개·차트 13칸·키보드 초점 툴팁·지점 상세 표로 보기 13행).')))

# RFP
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
    '결정 기록 D76 · 판정 원천 요구사항추적표 §3')))

# 정리
S.append(('wrap', content('wrap', '정리', '검증 · 운영 반영 · 남은 일', cards_row([
    f'<p style="font-family:{HEADF}; font-size:96px; font-weight:900; line-height:1; color:{NAVY}">631</p>{h3("API 자동 테스트(건)")}{p("59개 파일, 실DB · 화면 자동 테스트 24건 — 나머지 화면은 lint · 빌드까지")}',
    f'{mono("운영 반영")}' + ''.join(f'<div style="display:flex; align-items:flex-start; gap:14px"><x-icon name="Check" style="color:{GREEN}; width:30px; height:30px"></x-icon>{p(t, 28, INK)}</div>'
                                     for t in ['배포 DB 마이그레이션(승인)', '서버 · 웹 재배포', '운영에서 직접 확인']),
    f'{mono("발표 뒤(선택)")}' + ''.join(f'<div style="display:flex; align-items:flex-start; gap:14px"><x-icon name="Play" style="color:{NAVY}; width:30px; height:30px"></x-icon>{p(t, 28, INK)}</div>'
                                         for t in ['영업 리포트(차트 부품 재사용)', '회원 앱 형태 재검토', '남은 스크롤 2곳']),
]),
    '검증: api 자동 테스트 631건(59개 파일, 실DB — 2026-11-09 전체 실행 통과), 화면 자동 테스트 24건(역할별 핵심 경로, CI). 이번 작업에서 화면 자동 테스트가 없는 곳: 직원·강사·문서 표 정렬, 자산·업무지원 검색·정렬 화면, 직원 상세 인사서류 열기, 900px 이하 폭 — 이 범위를 넘어 "다 검증했다"고 말하지 말 것. 운영 반영: 문서 파일 스키마는 승인 후 배포 DB에 적용, 서버(Lambda)와 웹(Worker) 재배포, 운영에서 차트·문서 올리기·빠른 찾기를 직접 확인(11/9). 실운영은 하지 않는다 — 시연용 배포 환경. 발표 뒤 과제는 선택.')))

S.append(('closing', f'<section id="closing" data-transition="fade" style="background:{BG}; color:{INK}; font-family:{BODYF}; padding:128px 176px; display:flex; flex-direction:column; gap:24px">{DOTS}'
          f'<div style="flex:1"></div><h1 style="font-family:{HEADF}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:{INK}">감사합니다</h1><div style="flex:1"></div>'
          f'{notes("맺음(말로): 사용감은 느낌이 아니라 단계 수를 재고 줄였고, 목록은 같은 동작을 같은 모양으로 맞추며 정렬·검색을 데이터가 있는 서버로 옮겼고, 문서 파일과 운영 실적 차트로 10주차의 다음 할 일을 마쳤습니다. RFP 충족률은 할 수 없는 조항을 분모에서 빼 94%로 다시 셌고, 옛 방식으로는 81%입니다.")}</section>'))

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
    'title': '스포이즘 ERP 최종 발표',
    'order': order,
    'sections': {
        'intro': {'description': '표지, 오늘 순서 — 10주차의 다음 할 일에서 출발', 'start': 'cover'},
        'ux': {'description': '01 사용감 — 작업 단계를 재고 줄였다(빠른 찾기, 화면 안 순서)', 'start': 'p1'},
        'list': {'description': '02 목록 일관화 — 정렬·검색은 서버에서, 공통 부품', 'start': 'p2'},
        'doc': {'description': '03 문서 파일 — 직접 올리기와 열람 기록', 'start': 'p3'},
        'chart': {'description': '04 운영 실적 차트 — 13개월 추이와 지점 비교', 'start': 'p4'},
        'wrap': {'description': 'RFP 충족률 산정 변경과 정리', 'start': 'rfp'},
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
