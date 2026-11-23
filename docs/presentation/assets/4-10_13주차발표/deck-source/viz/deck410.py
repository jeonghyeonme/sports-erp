# 4-10 13주차 발표 덱 생성기 — 12주차 생성기(4-9 deck49.py)와 같은 색·글꼴·머리말·카드·브라우저 프레임(4-0 §4).
# 사용: python3 viz/deck410.py deck-out   → deck-out/project/{deck.json, deck.css, slides/*.html}
# 캡처 주소(/_blob)는 deck-source/assets.json(아티팩트에 올린 뒤 받은 주소)에서 읽는다. 숫자는 data/loadtest.json.
# x-icon 이름은 Slides가 아는 것만(format.md 목록 — Info·RotateCcw 같은 이름은 "[icon: …]" 글자로 보인다).
# 게시본은 사용자가 편집기에서 고친다 — 다시 올리기 전에 그 장을 읽어 편집을 살린다(전체 재생성으로 덮지 않는다).
import json, os, sys, datetime

OUT = sys.argv[1] if len(sys.argv) > 1 else 'deck-out'
HERE = os.path.dirname(os.path.abspath(__file__))
DOTS = open(os.path.join(OUT, 'dots.svg'), encoding='utf-8').read().strip()
IMG = json.load(open(os.path.join(HERE, '..', 'assets.json'), encoding='utf-8'))
LT = json.load(open(os.path.join(HERE, '..', 'data', 'loadtest.json'), encoding='utf-8'))

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


R = LT['runs']
d50, cur, leg = R['d50'], R['current'], R['legacy']
S = []

# 1 표지
S.append(('cover', f'<section id="cover" data-transition="fade" style="background:{BG}; color:{INK}; font-family:{BODYF}; padding:128px 176px; display:flex; flex-direction:column; gap:20px">{DOTS}'
          f'<div style="flex:1"></div><div style="display:flex"><p style="font-family:{MONOF}; font-size:24px; letter-spacing:2px; color:{NAVY}; background:#E7ECF1; border:1px solid {LINE}; border-radius:999px; padding:8px 24px">SPOISM ERP · WEEK 13</p></div>'
          f'<h1 style="font-family:{HEADF}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:{INK}">스포이즘 ERP</h1>'
          f'<p style="font-size:52px; font-weight:500; color:{SUB}">13주차 진행 발표</p><p style="font-size:32px; color:{SUB}">아파트 · 오피스텔 커뮤니티 시설 위탁운영사의 본사 · 지점 · 회원 관리 시스템</p><div style="height:36px"></div>'
          f'<p style="font-family:{MONOF}; font-size:28px; color:{SUB}"><b>발표자</b>&#160; 박정현 &#160;&#160;·&#160;&#160; <b>범위</b>&#160; 12주차 발표 이후 ~ 2026-11-23</p>'
          f'<div style="flex:1"></div>{notes("13주차 발표. 범위는 12주차 발표 이후 작업(log/231~233·238~248). 라이브 데모 없이 로컬 시연 데이터 캡처와 운영 서버 측정 수치. 15분 안팎 — 비정상 접근 2분, 운영 부하 5분, 운영에서 써 보며 고친 것 4분 30초, RFP·진행률·다음 할 일 2분 30초.")}</section>'))

# 2 순서
todo = ''.join(
    f'<div style="display:flex; align-items:center; gap:14px; padding:14px 22px; background:{CARDBG}; border:1px solid {LINE}; border-radius:12px">'
    f'<x-icon name="{ic}" style="color:{c}; width:30px; height:30px"></x-icon><p style="font-size:28px; color:{INK}; flex:1">{t}</p>{pill(s, c, bg)}</div>'
    for ic, c, bg, t, s in [('Check', GREEN, '#E3F1EA', '부하 · 비정상 접근 테스트', '끝냄'),
                            ('Check', GREEN, '#E3F1EA', '사용감 직접 점검', '끝냄'),
                            ('Clock', AMBER, '#F6ECDD', '운영 마무리', '일부'),
                            ('Clock', AMBER, '#F6ECDD', '발표 · 제출', '진행 중')])
rows = ''.join(
    f'<div style="display:flex; align-items:center; gap:28px; padding:22px 28px; background:{CARDBG}; border:1px solid {LINE}; border-radius:12px">'
    f'<p style="font-family:{MONOF}; font-size:28px; font-weight:700; color:{NAVY}; width:60px">{n}</p>'
    f'<p style="font-family:{HEADF}; font-size:36px; font-weight:700; color:{INK}; width:420px; white-space:nowrap">{t}</p><p style="font-size:28px; color:{SUB}">{d}</p></div>'
    for n, t, d in [('01', '비정상 접근', '정상이 아닌 요청도 정확히'),
                    ('02', '운영 부하', '운영 서버에 직접 부하'),
                    ('03', '운영에서 써 보며', '배포 뒤 직접 쓰고 고친 것'),
                    ('04', 'RFP · 진행률', '지금 위치와 다음 할 일')])
S.append(('agenda', content('agenda', '오늘 순서', '13주차에 한 일',
          f'<div style="display:flex; gap:40px; align-items:flex-start"><div style="width:620px; display:flex; flex-direction:column; gap:14px">{mono("12주차 발표에서 남긴 다음 할 일", color=SUB)}{todo}</div>'
          f'<div style="flex:1; display:flex; flex-direction:column; gap:14px">{mono("이번 발표 순서", color=SUB)}{rows}</div></div>',
          '12주차 마지막 장의 다음 할 일 네 묶음에서 출발한다. 검증 두 가지(부하·비정상 접근)와 사용감 점검은 끝냈고, 운영 마무리는 운영에서 PT 구매·예약 확인까지 했다(브랜치 정리·main 병합은 마지막 날). 발표·제출은 진행 중.',
          lead='12주차에 남긴 다음 할 일 — 검증과 사용감 점검은 끝냈고, 마무리와 발표는 진행 중이다.')))

# PART 01 비정상 접근
S.append(('p1', divider('p1', 'PART 01', '비정상 접근', '정상이 아닌 요청도 정확히 거절합니다',
          '12주차까지 테스트는 대부분 정상 흐름과 권한 규칙을 봤다. 이번엔 일부러 잘못된 요청을 보낸다. 약 2분.')))

paths = [('만료된 로그인', '401', '로그인 유지 시간이 지난 토큰으로 요청', '같은 사용자의 새 토큰은 200'),
         ('권한 밖 직접 호출', '403', '회원 · 직원이 회원 목록 주소를 직접 입력', '자기 지점 관리자는 200'),
         ('깨진 입력', '400', '형식이 틀린 본문 · 없는 항목 · 잘못된 타입', '바른 입력은 저장됨')]
S.append(('abnormal', content('abnormal', '비정상 접근', '정상이 아닌 요청도 정확히 거절한다', cards_row([
    f'{mono(t)}<p style="font-family:{HEADF}; font-size:88px; font-weight:900; line-height:1; color:{INK}">{code}</p>{p(d, 28, INK)}'
    f'<div style="display:flex; align-items:center; gap:10px"><x-icon name="Check" style="color:{GREEN}; width:26px; height:26px"></x-icon>{p(c, 26)}</div>'
    for t, code, d, c in paths]),
    '세 경로를 자동 테스트 9건으로 붙였다(log/232). 상태 코드와 오류 코드는 정확히 맞추고, 메시지는 문구를 고정하지 않고 내부 정보가 없는지만 본다. 매번 정상 사용자 대조군을 함께 둬서 "다 막아서 통과"가 아님을 확인한다. 범위에서 뺀 것: 토큰 위·변조(사용자 결정 — 서명 검증은 라이브러리가 한다). 질문 대비: 주소의 잘못된 % 인코딩도 같은 식으로 문구가 샐 수 있는데 이번 범위 밖이라 확인하지 않았다.',
    '진행 기록 log/232 · 자동 테스트 9건 · 토큰 위 · 변조는 범위에서 뺌',
    lead='전에는 정상 흐름과 권한 규칙만 봤다. 이번엔 일부러 잘못된 요청을 보내 거절 방식까지 본다.')))

S.append(('abnormal-found', content('abnormal-found', '비정상 접근 · 찾은 것', '테스트가 실제로 하나 찾았다',
    f'<div style="display:flex; gap:32px; align-items:stretch">'
    f'<div style="flex:1; display:flex; flex-direction:column; gap:16px">{pill("변경 전", AMBER, "#F6ECDD")}'
    f'{mono_card("400 BAD_REQUEST<br>Unterminated string in JSON<br>at position 13 …", "bad")}{p("서버 내부 파서의 문구가 그대로 응답에 나갔다", 28, INK)}</div>'
    f'<div style="display:flex; align-items:center"><x-shape kind="arrow-right" style="background:{LINE2}; width:56px; height:32px"></x-shape></div>'
    f'<div style="flex:1; display:flex; flex-direction:column; gap:16px">{pill("변경 후", GREEN, "#E3F1EA")}'
    f'{mono_card("400 INVALID_JSON<br>요청 본문(JSON) 형식이<br>올바르지 않습니다.", "good")}{p("어디가 틀렸는지 내부 정보 없이 알려 준다", 28, INK)}</div></div>',
    '깨진 JSON을 보내는 테스트가 처음 실행에서 실패했다 — 응답에 서버 파서의 문구(위치 정보 포함)가 그대로 나갔다. 공격자에게 내부 구현을 알려 주는 정보 노출이라(보안약점 체크리스트 에러-1), 전용 오류 코드와 일반 안내 문구로 바꿨다. 두 웹앱은 모르는 오류 코드는 서버 메시지를 그대로 보여 주므로 화면 수정은 필요 없었다.',
    '보안약점 체크리스트 에러-1(오류 메시지 정보노출) · log/232',
    lead='깨진 요청 본문을 보내는 테스트가 처음 실행에서 실패했다 — 고쳐야 할 진짜 문제였다.')))

# PART 02 운영 부하
S.append(('p2', divider('p2', 'PART 02', '운영 부하', '운영 서버에 직접 부하를 걸었습니다',
          '10월에 한 번 쟀던 운영 측정을, 그 뒤 바뀐 시스템으로 다시. 약 5분.')))

S.append(('load-why', content('load-why', '운영 부하 · 왜', '10월 측정 뒤 시스템이 많이 바뀌었다', cards_row([
    f'{mono("10월 12일 측정", color=SUB)}{h3("지난 기준")}{p("운영 서버(서울)에 직접 부하 — 처리 시간 · 한계를 설계 값으로 정했다(D50)", 28, INK)}',
    f'{mono("그 뒤 바뀐 것", color=AMBER)}{h3("DB 구조 변경 8번")}{p("업무지원 · 세부 권한 · 계약 회차 · 계약 파일 · 문서 파일 · 회원 앱 PT 등<br>새 화면: 처리 대기함 · 운영 실적 차트 · 문서함 · 오늘 예약", 28, INK)}',
    f'{mono("이번 측정", color=NAVY)}{h3("같은 조건 + 새 화면")}{p("10월과 같은 시나리오에 회복 구간을 더하고, 새 화면이 부르는 조회를 섞었다", 28, INK)}']),
    '10월 12일 운영 측정(D50)에서 서버 처리 시간 약 40ms, 과부하 실제 처리 약 80~90건/초를 설계 값으로 정했다. 그 뒤 DB 마이그레이션 8번(10-17~11-09)과 새 화면이 생겨 다시 쟀다(사용자 결정). 조회 묶음은 두 가지 — 새 화면 조회를 섞은 8종(기본)과 10월과 같은 4종(비교용). 측정은 내 PC에서 운영 Lambda 주소로 직접.',
    'loadtest/k6-lambda.js · 결정 기록 D50 · 진행 기록 log/238·239',
    lead='10월에 운영 서버를 한 번 쟀다. 그 뒤 DB와 화면이 많이 바뀌어, 같은 조건으로 다시 쟀다.')))

TOTAL = 690
segs = [(t['id'], t['label'], t['start'], t['end'], t['rate']) for t in LT['timeline']]
crit = {'S1': '응답 0.5초 안 · 오류 0', 'S2': '응답 0.3초 안 · 거절 0', 'S3': '넘친 요청은 0.1초 안에 거절', 'S4': '30초 뒤 S2 기준으로 복귀'}
color = {'S1': SUB, 'S2': NAVY, 'S3': AMBER, 'S4': GREEN}
W = 1680
track = ''
pos = 0
for sid, lab, st, en, rate in segs:
    if st > pos:
        track += f'<div style="width:{int(W * (st - pos) / TOTAL)}px"></div>'
    w = int(W * (en - st) / TOTAL)
    track += (f'<div style="width:{w}px; display:flex; flex-direction:column; gap:12px">'
              f'<div style="height:64px; background:{color[sid]}; border-radius:10px; display:flex; align-items:center; padding:0 16px">'
              f'<p style="font-family:{MONOF}; font-size:24px; font-weight:700; color:#FFFFFF; white-space:nowrap">{sid}</p></div>'
              f'<p style="font-family:{HEADF}; font-size:30px; font-weight:700; color:{INK}; white-space:nowrap">{lab}</p>'
              f'<p style="font-family:{MONOF}; font-size:24px; color:{SUB}; white-space:nowrap">{rate}</p></div>')
    pos = en
ticks = ''.join(f'<p style="position:absolute; left:{int(W * s / TOTAL)}px; top:0; font-family:{MONOF}; font-size:24px; color:{SUB}; white-space:nowrap">{s // 60}분{" " + str(s % 60) + "초" if s % 60 else ""}</p>' for s in (0, 150, 480, 540, 690) if s < 690)
crit_cards = ''.join(f'<div style="flex:1; padding:20px 24px; background:{CARDBG}; border:1px solid {LINE}; border-left:6px solid {color[k]}; border-radius:10px">'
                     f'{mono(k, color=color[k])}{p(v, 26, INK)}</div>' for k, v in crit.items())
S.append(('load-plan', content('load-plan', '운영 부하 · 시나리오', '11분 30초 동안 네 가지 상황을 차례로',
    f'<div style="position:relative; height:34px; width:{W}px">{ticks}</div>'
    f'<div style="display:flex; width:{W}px; align-items:flex-start">{track}</div>'
    f'<div style="display:flex; gap:16px">{crit_cards}</div>',
    'S1 로그인 몰림(0~2분, 동시 사용자 0→40명), S2 평소 부하(초당 50건 5분 — 설계 계산 D37의 기준 요청량), S3 과부하(초당 300건 1분 — 처리 한계를 일부러 넘김), S4 회복(S3 직후 초당 50건, 처음 30초는 서버 오류만 보고 그 뒤 2분은 S2 기준). 통과 기준 12개가 스크립트에 적혀 있어 하나라도 넘으면 실패로 끝난다. 웹 앞단(Cloudflare Worker)을 거치면 로그인 제한과 무료 한도에 걸려 Lambda 주소로 직접 보냈다.',
    '통과 기준 12개를 스크립트에 적어 하나라도 넘으면 실패 · loadtest/k6-lambda.js',
    lead='같은 스크립트로 로그인 몰림부터 회복까지 한 번에 돌린다. 각 구간에 통과 기준이 있다.')))

def trow(name, before, after, good=True):
    c = GREEN if good else INK
    return (f'<tr><td style="font-size:30px; color:{INK}; padding:20px 24px; border-bottom:1px solid {LINE}">{name}</td>'
            f'<td style="font-family:{MONOF}; font-size:30px; color:{SUB}; padding:20px 24px; border-bottom:1px solid {LINE}">{before}</td>'
            f'<td style="font-family:{MONOF}; font-size:30px; font-weight:700; color:{c}; padding:20px 24px; border-bottom:1px solid {LINE}">{after}</td></tr>')
table = (f'<table style="width:1500px; border-collapse:collapse; background:{CARDBG}; border:1px solid {LINE}; border-radius:14px">'
         f'<tr><th style="text-align:left; font-size:26px; color:{SUB}; padding:18px 24px; background:{SOFT}">항목</th>'
         f'<th style="text-align:left; font-size:26px; color:{SUB}; padding:18px 24px; background:{SOFT}">10월 12일</th>'
         f'<th style="text-align:left; font-size:26px; color:{SUB}; padding:18px 24px; background:{SOFT}">11월 22일(새 화면 포함)</th></tr>'
         + trow('로그인 몰림 · 응답(95%)', f"{d50['loginP95ms']}ms", f"{cur['loginP95ms']}ms")
         + trow('평소 부하 · 응답(95%)', f"{d50['s2P95ms']}ms", f"{cur['s2P95ms']}ms")
         + trow('평소 부하 · 거절', f"{d50['s2Rejected']}건", f"{cur['s2Rejected']}건")
         + trow('과부하 · 실제 처리', f"약 {d50['s3OkRps']}건/초", f"약 {cur['s3OkRps']}건/초")
         + '</table>')
S.append(('load-result', content('load-result', '운영 부하 · 결과', '기준 12개 모두 통과 — 10월보다 빨랐다',
    table + f'<div style="display:flex; align-items:center; gap:16px; padding:18px 26px; background:{SOFT}; border-radius:12px"><x-icon name="Lightbulb" style="color:{NAVY}; width:30px; height:30px"></x-icon>'
    f'{p("새 화면 조회를 빼고 10월과 같은 조회로 한 번 더 돌려도 결과가 같았다 — 새 기능이 부담을 늘리지 않았다", 28, INK)}</div>',
    f'두 번 돌렸다 — 새 화면 조회를 섞은 8종(위 표)과 10월과 같은 4종(평소 부하 응답 {leg["s2P95ms"]}ms·거절 0, 과부하 약 {leg["s3OkRps"]}건/초). 응답 시간은 내 PC에서 서울 리전까지의 네트워크를 포함한다. 10월보다 빨라진 이유는 가르지 못했다(서버 처리 시간은 다시 재지 않았다). 10월의 평소 부하 거절 47건은 이번에 재현되지 않았지만 원인은 모른다 — "해결"이라고 말하지 않는다. 최대 응답 약 2.2초 몇 건은 새 실행 환경이 뜰 때(콜드 스타트)로 추정.',
    '응답 시간은 측정 PC ↔ 서울 리전 네트워크 포함 · 진행 기록 log/239 · 원본 출력 data/k6-*.txt',
    lead='10월과 같은 시나리오에 새 화면 조회를 섞어도 모든 기준을 통과했다.')))

S.append(('load-overload', content('load-overload', '운영 부하 · 과부하와 회복', '넘치면 빨리 거절하고, 30초 안에 돌아온다',
    '<div style="display:flex; gap:20px; align-items:stretch">'
    + big(f"약 {cur['s3OkRps']}", '건/초', '초당 300건이 몰려도 처리할 만큼은 0.07초 안에 처리')
    + big('0.013', '초', '나머지는 기다리게 두지 않고 “잠시 후 다시”로 바로 거절', AMBER)
    + big('0', '건', '서버 오류 · 시간 초과', GREEN) + '</div>'
    + f'<div style="display:flex; align-items:center; gap:20px; padding:24px 30px; background:{NAVY}; border-radius:14px">'
    f'<p style="font-size:34px; font-weight:700; color:#FFFFFF">과부하가 끝나고 30초 안에 평소 속도(응답 0.07초 · 거절 0)로 돌아왔다</p></div>',
    '동시 실행 상한 10(D42)을 일부러 넘긴 구간. 모두가 느려지는 대신 처리할 만큼만 빠르게 처리하고, 넘친 요청은 즉시 거절해 앱이 "잠시 후 다시"를 보여 준다(D37 설계). 과부하가 끝난 뒤 30초 구간에도 서버 오류는 0, 그 뒤 2분은 평소 기준을 만족했다. 질문 대비: 초당 99건은 이번 조건에서 실제로 처리한 양(측정 하한)이다. 상한을 올리려면 DB 연결 수(Pool Size 15)부터 봐야 한다.',
    '동시 실행 상한 10(D42) · 넘친 요청은 즉시 거절(D37) · S4 회복 구간은 이번에 처음 잼',
    lead='처리 한계를 일부러 넘겼다. 모두가 느려지지 않고, 넘친 만큼만 빨리 거절한다.')))

# PART 03 운영에서 써 보며
S.append(('p3', divider('p3', 'PART 03', '운영에서 써 보며', '배포한 뒤 직접 써 보고 고쳤습니다',
          '테스트는 통과하는데 운영에서 직접 써 보니 보인 것들. 약 4분 30초.')))

S.append(('ops-sheet', content('ops-sheet', '운영에서 써 보며 · 회원 앱', '확인 버튼이 화면 밖에 있었다',
    f'<div style="display:flex; gap:48px; align-items:center">'
    f'<div style="display:flex; flex-direction:column; gap:14px; align-items:center">{pill("변경 전", AMBER, "#F6ECDD")}{phone(IMG["sheet_before"], "예약 취소를 눌렀지만 확인 시트가 화면 밖 — 배경만 어두워짐", 590)}</div>'
    f'<div style="display:flex; flex-direction:column; gap:14px; align-items:center">{pill("변경 후", GREEN, "#E3F1EA")}{phone(IMG["sheet_after"], "예약 취소 확인 시트가 화면 아래에서 올라옴", 590)}</div>'
    f'<div style="flex:1; display:flex; flex-direction:column; gap:20px">'
    f'<div style="{CARD}">{mono("무슨 일이", color=AMBER)}{p("“예약 취소”를 누르면 확인 시트가 페이지 맨 아래에 떠서, 회원이 스크롤해 찾아야 했다", 28, INK)}</div>'
    f'<div style="{CARD}">{mono("왜 못 잡았나")}{p("테스트 데이터는 예약 목록이 짧아 페이지가 화면보다 짧았다 — 예약이 많은 회원에게만 보인다", 28, INK)}</div>'
    f'<div style="{CARD}">{mono("이제", color=GREEN)}{p("시트는 늘 화면 아래에서 올라오고, “시트가 화면 안에 있는가”를 테스트가 본다", 28, INK)}</div></div></div>',
    '원인: 화면 전환 애니메이션이 걸린 영역 안에서는 "화면에 고정"이 화면이 아니라 그 영역을 기준으로 잡혔다(브라우저 동작). 시트를 화면 최상위로 옮겨(포털) 고쳤다. 예약 확인 시트도 같은 시트라 함께 고쳐졌다. 운영에서 사용자가 예약 · 결제 · 취소 시트를 확인했다(11-23). 같이 고친 것 하나: 측정 도구가 시트가 올라오는 0.28초 애니메이션 도중에 위치를 재서 스크롤로 잘못 셌다 — 애니메이션이 끝난 뒤 재게 했다.',
    '회원 웹 · 예약이 많은 회원(시연 데이터) · 검사 추가 · 진행 기록 log/241',
    lead='예약이 많은 회원으로 써 보니, 취소를 누른 뒤 확인 버튼을 찾으러 스크롤해야 했다.')))

S.append(('ops-data', content('ops-data', '운영에서 써 보며 · 데이터', '운영 데이터도 날짜가 지난다',
    f'<div style="display:flex; gap:48px; align-items:center">'
    f'<div style="flex:1; display:flex; flex-direction:column; gap:20px">'
    f'<div style="{CARD}">{mono("전에는", color=AMBER)}{p("운영 DB의 시연 데이터가 10월 20일 기준 — 11월 23일엔 앞으로 회차가 0개, 회원 앱이 “예약할 수 있는 회차가 없습니다”만 보였다", 28, INK)}</div>'
    f'<div style="{CARD}">{mono("이제", color=GREEN)}{p("오늘 기준으로 다시 넣었다 — 앞으로 회차 111개. 운영에서 직접 올린 계약서 4개 · 교육자료는 살렸고, 36개 테이블 내용이 원본과 같은지 확인했다", 28, INK)}</div>'
    f'<div style="{CARD}">{mono("같이 고친 것")}{p("회차가 없는 강습은 회색 카드로 아래에 — 눌러서 빈 화면을 보지 않게", 28, INK)}</div></div>'
    f'{phone(IMG["programs"], "회원 앱 예약하기 — 회차 있는 강습 위, 지금 열린 회차 없음 회색 카드 아래", 640)}</div>',
    '운영 DB의 시연 데이터는 "실행일 기준 지난 90일 + 앞으로 3주"로 만들어서 날짜가 지나면 비어 간다. 재시드는 로컬에서 만든 데이터를 한 트랜잭션으로 적용(실패하면 전부 되돌림)하고, 적용 뒤 36개 테이블 행 지문이 원본과 같은지 봤다. 사용자가 운영에서 올린 계약서 4개와 교육자료 글은 새 데이터에 이어 붙였다. 시연 회차는 12월 12일까지라 그 뒤에는 다시 넣어야 한다. 실운영은 하지 않으므로(D67) 운영 데이터를 바꾸는 데 문제는 없다.',
    '회원 웹 · 시연 데이터 재시드(log/243·244) · 회차 없는 카드(ADR-PRG-04 보완, log/242)',
    lead='배포 뒤 테스트하려니 시연 데이터의 회차가 모두 지나 있었다.')))

S.append(('ops-pt', content('ops-pt', '운영에서 써 보며 · PT', 'PT를 사고, 예약하고, 남은 횟수를 홈에서',
    f'<div style="display:flex; gap:40px; align-items:center">'
    f'<div style="flex:1; display:flex; flex-direction:column; gap:24px">'
    + flow([('구매', 'PT 10회', '앱에서 결제'), ('예약', '회차 잡기', '1회 잡힘'), ('체크인', '1회 차감', '취소하면 돌아옴')], active={1})
    + f'<div style="{CARD}">{mono("전에는", color=AMBER)}{p("PT 회차가 시연 데이터에 없어 예약할 수 없었고, 남은 횟수는 “내 정보” 안쪽에 있었다", 28, INK)}</div>'
    f'<div style="{CARD}">{mono("이제", color=GREEN)}{p("트레이너가 연 회차(정원 1)를 앱에서 예약하고, 홈 “내 PT”에서 바로 본다 — 운영에서 구매 · 예약 · 취소까지 확인", 28, INK)}</div></div>'
    f'{phone(IMG["home_pt"], "회원 홈 내 PT 카드 — 예약에 쓸 수 있는 PT 7회, PT 회차 예약하기", 560)}'
    f'{phone(IMG["pt_slots"], "PT 회차 화면 — 월 · 수 · 금 회차, 1자리 남음", 560)}</div>',
    'PT는 산 횟수로 트레이너가 연 회차를 예약하고, 체크인 때 1회 차감된다(ADR-RSV-09). 구매하면 횟수만 오르는 것은 설계대로다 — 회차가 있어야 예약한다. 시연 데이터에 PT 회차가 없던 것을 채웠다(월·수·금 10시·19시, 정원 1). 홈 "내 PT" 카드는 "예약에 쓸 수 있는 횟수 = 남은 횟수 − 예약으로 잡힌 횟수"를 보이고, 사거나 예약한 직후에도 맞도록 캐시하지 않는다(사용자 요청). 운영에서 사용자가 홈 카드 · 예약 · 예약 뒤 횟수 감소 · 취소 뒤 복귀를 확인했다(11-23).',
    '회원 웹 · ADR-RSV-09 · 진행 기록 log/245~247 · 운영 확인 11-23',
    lead='운영에서 PT를 사 봤는데 횟수만 오르고 예약할 회차가 없었다.')))

S.append(('ops-admin', content('ops-admin', '운영에서 써 보며 · 관리자', '관리자 화면 두 곳',
    f'<div style="display:flex; gap:32px; align-items:flex-start">'
    f'<div style="display:flex; flex-direction:column; gap:12px">{pill("시설 · 혼잡도 — 변경 전", AMBER, "#F6ECDD")}'
    f'<img src="{IMG["fac_before"]}" alt="시설 카드 버튼 글자가 한 글자씩 세로로 쌓임" style="width:780px; height:299px; object-fit:contain; background:{CARDBG}; border:1px solid {LINE2}; border-radius:12px">'
    f'{pill("변경 후", GREEN, "#E3F1EA")}'
    f'<img src="{IMG["fac_after"]}" alt="입력 줄과 관리 버튼 줄로 나뉜 시설 카드" style="width:780px; height:299px; object-fit:contain; background:{CARDBG}; border:1px solid {LINE2}; border-radius:12px"></div>'
    f'<div style="flex:1; display:flex; flex-direction:column; gap:12px">{pill("게시글 작성 — 변경 후", GREEN, "#E3F1EA")}'
    f'{frame(IMG["post"], "게시글 작성 — 내용을 길게 써도 취소 · 등록 줄이 화면 아래", "게시글 작성 · 1280×720", 720, 405)}'
    f'{p("글을 길게 써도 “등록”이 늘 화면 아래에 — 전에는 스크롤해야 보였다", 28, INK)}</div></div>',
    '시설 카드: 카드 폭(약 230px)에 입력칸과 버튼 셋을 한 줄로 넣어, 지점에 시설이 많아 카드가 좁아지면 버튼 글자가 한 글자씩 세로로 쌓였다 — 입력 줄과 관리 버튼 줄로 나눴고, 카드 안 버튼 줄바꿈을 화면 테스트가 본다. 게시글 작성: 1280×720 화면에서 등록 버튼이 첫 화면 밖이었다 — 취소 · 등록 줄을 화면 아래에 붙였다. 작업 단계 측정(시연 데이터)으로 스크롤 1 → 0 확인. 질문 대비: 측정에서 새로 스크롤이 생긴 작업 4곳(체크인 버튼 · 본사 대시보드 지점 행 · 회원 프로그램 목록)은 다음 후보로 남겼다.',
    '관리자 웹 · 시연 데이터 · 진행 기록 log/241',
    lead='지점에 시설이 많거나 글이 길 때 — 테스트 데이터에선 안 보이던 경우다.')))

# 마무리
# RFP 장(rfp)은 사용자가 게시본에서 지웠다(2026-11-23) — 분모 설명은 진행률 장 노트에.
S.append(('progress', content('progress', '전체 진행률', '최종 제출까지 91%',
    f'<div style="display:flex; flex-direction:column; gap:22px">'
    + bar('기능 구현', 40, 100, '94 → 100')
    + bar('검증 · 품질', 15, 100, '79 → 100')
    + bar('산출물', 20, 100, '8종 지금 기준')
    + bar('발표 · 제출', 15, 67, '44 → 67')
    + bar('운영 · 마무리', 10, 60, '40 → 60')
    + '</div>'
    + f'<div style="display:flex; align-items:center; gap:24px; padding:22px 28px; background:{CARDBG}; border:1px solid {LINE}; border-radius:12px">'
    f'<p style="font-family:{HEADF}; font-size:56px; font-weight:900; color:{SUB}">80%</p><x-shape kind="arrow-right" style="background:{LINE2}; width:56px; height:32px"></x-shape>'
    f'<p style="font-family:{HEADF}; font-size:56px; font-weight:900; color:{NAVY}">91%</p>'
    f'{p("12주차 → 13주차", 30, INK)}</div>',
    '진행률 기준(D80) — 묶음 5개(기능 40 · 검증 15 · 산출물 20 · 발표·제출 15 · 운영·마무리 10)의 가중 평균. 이번에 오른 것: 검증 79 → 100%(부하 · 스트레스 · 비정상 접근 3항목), 운영·마무리 40 → 60%(운영에서 PT 구매·예약 확인), 발표·제출 44 → 67%(13주차 덱 작성, 11주차 덱 렌더 확인 — 발표 때 문제없었음), 기능 94 → 100%(RFP 충족률 — 말로 붙일 것: 해당 없음 10·의도적 제외 3을 분모에서 뺀 59/59, D82. 12주차 기준이면 95%, 72조항 전부로는 82%). 산출물은 RFP 판정을 바꾼 뒤 요구사항 정의서·이행 증빙·제안서·설계서를 다시 만들어 100% 유지. 남은 것: 발표·제출(14주차 덱, 15주차 최종 덱, 최종 제출 폴더), 마무리(브랜치 정리, main 병합).',
    '결정 기록 D80 · 항목마다 끝냄 1 · 일부 0.5 · 안 함 0으로 세어 가중 평균 · docs/reference/진행률.md',
    lead='최종 제출까지의 진행률 — 검증과 운영 확인이 채워졌다.')))

nexts = [('Book', '발표 · 제출', '14주차 발표<br>15주차 최종 발표 · 제출 폴더'),
         ('Check', '마무리', '원격 브랜치 정리<br>dev → main 병합'),
         ('Search', '다음 후보', '새로 보인 스크롤 4곳<br>서버 처리 시간 재측정')]
S.append(('wrap', content('wrap', '정리', '다음 할 일', cards_row([
    f'<x-icon name="{ic}" style="color:{NAVY}; width:48px; height:48px"></x-icon>{h3(t)}{p(d)}' for ic, t, d in nexts]),
    '남은 것은 발표·제출(14주차 발표, 15주차 최종 발표 덱, 최종 제출 폴더)과 마무리(원격 브랜치 정리, dev → main 병합 — 마지막 날). 선택 후보: 시연 데이터 측정에서 새로 스크롤이 생긴 4곳(오늘 예약 체크인 버튼, 본사 대시보드 지점 행 2곳, 회원 프로그램 목록), CloudWatch로 서버 처리 시간 재측정. 검증 범위(질문 대비): api 자동 테스트 62파일 681건(실DB), 화면 자동 테스트 35건(역할별 핵심 경로) — 그 밖은 lint·빌드·수동 점검.',
    lead='남은 것은 발표 · 제출과 마무리다.')))

S.append(('closing', f'<section id="closing" data-transition="fade" style="background:{BG}; color:{INK}; font-family:{BODYF}; padding:128px 176px; display:flex; flex-direction:column; gap:24px">{DOTS}'
          f'<div style="flex:1"></div><h1 style="font-family:{HEADF}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:{INK}">감사합니다</h1><div style="flex:1"></div>'
          f'{notes("맺음(말로): 12주차에 남긴 검증 두 가지 — 비정상 접근과 운영 부하 — 를 끝냈고, 배포한 뒤 직접 써 보며 회원 확인 시트 · 시연 데이터 날짜 · PT 흐름 · 관리자 화면을 고쳤습니다. 이제 운영에서 회원이 예약 · 결제 · 취소와 PT 구매 · 예약을 끝까지 할 수 있습니다. 최종 제출까지 91%입니다.")}</section>'))

os.makedirs(os.path.join(OUT, 'project', 'slides'), exist_ok=True)
for sid, html in S:
    assert html.count('<section') == 1 and f'id="{sid}"' in html, sid
    with open(os.path.join(OUT, 'project', 'slides', f'{sid}.html'), 'w', encoding='utf-8') as f:
        f.write(html)

with open(os.path.join(OUT, 'project', 'deck.css'), 'w', encoding='utf-8') as f:
    f.write('/* 13주차 덱 — 슬라이드는 인라인 스타일(4-0 §4, 12주차와 같은 언어). 공통 규칙은 두지 않는다. */\nsection { box-sizing: border-box; }\n')

order = [sid for sid, _ in S]
deck = {
    'v': 5,
    'createdOnFiles': {'v': 1, 'at': os.environ.get('DECK_CREATED_AT') or datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')},
    'lists': 'css',
    'format': {'v': 1, 'shared': ['project/deck.css']},
    'title': '스포이즘 ERP 13주차 발표',
    'order': order,
    'sections': {
        'intro': {'description': '표지, 오늘 순서 — 12주차의 다음 할 일에서 출발', 'start': 'cover'},
        'abnormal': {'description': '01 비정상 접근 — 세 경로와 테스트가 찾은 정보 노출', 'start': 'p1'},
        'load': {'description': '02 운영 부하 — 10월 이후 재측정, 기준 12개 통과, 과부하와 회복', 'start': 'p2'},
        'ops': {'description': '03 운영에서 써 보며 고친 것 — 확인 시트, 시연 데이터, PT 흐름, 관리자 화면', 'start': 'p3'},
        'wrapup': {'description': '진행률 91%, 다음 할 일', 'start': 'progress'},
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
