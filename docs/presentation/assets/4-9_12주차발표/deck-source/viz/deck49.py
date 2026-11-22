# 4-9 12주차 발표 덱 생성기 — 11주차 생성기(4-8 deck48.py)와 같은 색·글꼴·머리말·카드·브라우저 프레임(4-0 §4).
# 사용: python3 viz/deck49.py deck-out [점격자.svg]   → deck-out/project/{deck.json, slides/*.html}
# 점 격자 SVG는 10주차 표지에서 가져온 장식이다(인자로 주지 않으면 deck-out/dots.svg를 쓴다).
import json, os, sys, datetime

OUT = sys.argv[1] if len(sys.argv) > 1 else 'deck-out'
DOTS = open(sys.argv[2] if len(sys.argv) > 2 else os.path.join(OUT, 'dots.svg'), encoding='utf-8').read().strip()

IMG = {  # 아티팩트 자산(/_blob) — screenshots/의 파일을 올린 주소(README 표)
    'button': '/_blob/81c65c8514c3d03b4444320a7fb0f26e',
    'report': '/_blob/cd01d702e3637d7c3ea48f119bc97bf5',
    'print': '/_blob/3c1578a9a718dbc2468b957be4fb3c79',
    'narrow_before': '/_blob/a7e596ab9562a589108eedd83ea63d2c',
    'narrow_after': '/_blob/3f4e70c57429020434710e88a1553030',
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


S = []

# 1 표지
S.append(('cover', f'<section id="cover" data-transition="fade" style="background:{BG}; color:{INK}; font-family:{BODYF}; padding:128px 176px; display:flex; flex-direction:column; gap:20px">{DOTS}'
          f'<div style="flex:1"></div><div style="display:flex"><p style="font-family:{MONOF}; font-size:24px; letter-spacing:2px; color:{NAVY}; background:#E7ECF1; border:1px solid {LINE}; border-radius:999px; padding:8px 24px">SPOISM ERP · WEEK 12</p></div>'
          f'<h1 style="font-family:{HEADF}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:{INK}">스포이즘 ERP</h1>'
          f'<p style="font-size:52px; font-weight:500; color:{SUB}">12주차 진행 발표</p><p style="font-size:32px; color:{SUB}">아파트 · 오피스텔 커뮤니티 시설 위탁운영사의 본사 · 지점 · 회원 관리 시스템</p><div style="height:36px"></div>'
          f'<p style="font-family:{MONOF}; font-size:28px; color:{SUB}"><b>발표자</b>&#160; 박정현 &#160;&#160;·&#160;&#160; <b>범위</b>&#160; 11주차 발표 이후 ~ 2026-11-16</p>'
          f'<div style="flex:1"></div>{notes("12주차 발표. 범위는 11주차 발표 이후 작업(log/221~230). 라이브 데모 없이 로컬 실행 화면 캡처(시연 데이터). 15분 안팎 — 갱신 리포트 5분, 산출물 3분, 검증·사용감 3분, 진행률·정리 3분.")}</section>'))

# 2 순서
todo = ''.join(
    f'<div style="display:flex; align-items:center; gap:14px; padding:14px 22px; background:{CARDBG}; border:1px solid {LINE}; border-radius:12px">'
    f'<x-icon name="{ic}" style="color:{c}; width:30px; height:30px"></x-icon><p style="font-size:28px; color:{INK}; flex:1">{t}</p>{pill(s, c, bg)}</div>'
    for ic, c, bg, t, s in [('Check', GREEN, '#E3F1EA', '계약 갱신용 영업 리포트', '01'),
                            ('Check', GREEN, '#E3F1EA', '산출물 다시 만들기', '02'),
                            ('Clock', AMBER, '#F6ECDD', '사용감 더 점검하기', '03 · 진행 중')])
rows = ''.join(
    f'<div style="display:flex; align-items:center; gap:28px; padding:22px 28px; background:{CARDBG}; border:1px solid {LINE}; border-radius:12px">'
    f'<p style="font-family:{MONOF}; font-size:28px; font-weight:700; color:{NAVY}; width:60px">{n}</p>'
    f'<p style="font-family:{HEADF}; font-size:36px; font-weight:700; color:{INK}; width:400px">{t}</p><p style="font-size:30px; color:{SUB}">{d}</p></div>'
    for n, t, d in [('01', '계약 갱신 리포트', '갱신 협상에 들고 갈 한 장'),
                    ('02', '산출물', '8종을 지금 기준으로 다시'),
                    ('03', '검증과 사용감', '수동 확인뿐이던 곳에 자동 테스트'),
                    ('04', '전체 진행률', '기준을 세우고 다시 셈')])
S.append(('agenda', content('agenda', '오늘 순서', '12주차에 한 일',
          f'<div style="display:flex; gap:40px; align-items:flex-start"><div style="width:640px; display:flex; flex-direction:column; gap:14px">{mono("11주차 발표에서 남긴 다음 할 일", color=SUB)}{todo}</div>'
          f'<div style="flex:1; display:flex; flex-direction:column; gap:14px">{mono("이번 발표 순서", color=SUB)}{rows}</div></div>',
          '11주차 발표 마지막 장의 다음 할 일 세 가지에서 출발한다. 영업 리포트와 산출물은 마쳤고, 사용감은 테스트가 찾아낸 좁은 화면 문제를 고쳤지만 사용자가 직접 더 점검하는 일이 남아 진행 중이다. 그다음 전체 진행률 기준을 세워 지금 위치를 숫자로 보인다.',
          lead='11주차에 남긴 다음 할 일 세 가지 — 둘은 마쳤고, 사용감 점검은 진행 중이다.')))

# PART 01 계약 갱신 리포트
S.append(('p1', divider('p1', 'PART 01', '계약 갱신 리포트', '운영 기록을 갱신 협상 자료로 잇습니다',
          '사업 구조의 순환(계약 → 운영 → 운영 데이터 → 계약 판단)에서 마지막 고리. 약 5분.')))

S.append(('report-why', content('report-why', '계약 갱신 리포트 · 왜', '운영 기록에서 계약 판단까지 한 장으로', 
    flow([('계약', '계약 회차', '상대방 · 기간'),
          ('운영', '지점 운영 기록', '예약 · 결제 · 회원'),
          ('11주차', '운영 실적 차트', '13개월 추이'),
          ('이번 주', '갱신 리포트', '협상용 한 장'),
          ('본사', '계약 판단', '지속 · 조항 변경')], active={3})
    + cards_row([f'{mono("전에는", color=SUB)}{p("지점 상세에 계약 정보와 운영 실적 차트가 따로 있었고, 갱신 협상 자료는 사람이 화면을 보며 따로 모아야 했다", 28, INK)}',
                 f'{mono("이제", color=NAVY)}{p("지점 상세 “갱신 리포트”를 누르면 계약 · 운영 성과 · 서비스 품질이 한 장에 모이고, 그대로 인쇄해 협상에 쓴다", 28, INK)}']),
    '스포이즘 사업 구조의 핵심 순환 — 본사가 아파트와 위탁계약을 맺고(계약), 지점이 운영하고(운영), 그 운영 기록이 다시 계약 갱신 판단 근거가 된다. 11주차에 운영 실적 차트(D75)를 만들었고, 이번에 그것을 갱신 협상용 한 장으로 묶었다(D81). 새로 쌓는 데이터는 없다 — 이미 있는 기록에서 계산만 한다. 질문 대비: 신규 수주 입찰(PT)용 전사 리포트는 아직 제안 단계.',
    '결정 기록 D81 · 차별화전략 §2(영업지원 리포트)를 계약 갱신용으로 좁혀 구현',
    lead='위탁계약은 몇 년마다 갱신된다. 갱신 협상에서 본사가 “이 현장을 이렇게 운영했다”를 보일 근거가 필요하다.')))

S.append(('report-shot', shot('report-shot', '계약 갱신 리포트 · 화면', '갱신 임박 지점의 리포트', IMG['report'], '마포점 계약 갱신 리포트 화면 — 계약 개요와 운영 성과 표',
    'localhost · 본사(정하늘) · /branches/branch-mapo/renewal-report',
    ['<b>계약 개요</b><br>남은 기간 · 갱신 횟수 · 회차',
     '<b>운영 성과</b><br>12개월 합계 · 전사 평균 대비',
     '<b>서비스 품질</b><br>회원 · 혼잡도 · 업무지원 · 인력'],
    '갱신 임박(남은 35일) 마포점. 화면 위쪽 — 계약 개요와 운영 성과 표. 아래로 내리면 월별 차트 4장(11주차 차트 재사용)과 서비스 품질. 숫자는 로컬 시연 데이터(지난 90일치)라 "최근 6개월 증감"은 대부분 "앞 기간 기록 없음"으로 나온다 — 실제 운영이면 앞 기간이 채워진다. 평균 대비는 지점 규모 차이를 보정하지 않은 값이라 추세와 함께 본다(도움말에도 적음). 이렇게 말하지 말 것: "매출이 9% 낮다"를 판단처럼 말하지 않는다 — 시연 데이터다.')))

S.append(('report-print', content('report-print', '계약 갱신 리포트 · 인쇄', '인쇄하면 A4 한 장',
    f'<div style="display:flex; gap:48px; align-items:center">'
    f'<img src="{IMG["print"]}" alt="계약 갱신 리포트 인쇄본 A4 한 장" style="width:470px; height:665px; object-fit:contain; background:{CARDBG}; border:1px solid {LINE2}; border-radius:8px; {SHADOW}">'
    f'<div style="flex:1; display:flex; flex-direction:column; gap:20px">'
    f'<div style="{CARD}">{mono("열기")}{p("지점 상세 “계약 정보”의 “갱신 리포트” → “인쇄 · PDF 저장”", 30, INK)}{p("메뉴 · 버튼은 빠지고 차트는 종이 폭에 맞춘다")}</div>'
    f'<div style="{CARD}">{mono("원칙")}{p("본사 전용 — 지점 관리자는 볼 수 없다", 28, INK)}{p("쌓인 기록에서 계산만 — 새로 저장하는 것 없음", 28, INK)}</div>'
    f'<div style="{CARD}">{mono("검증")}{p("리포트 숫자가 원천 기록과 같은지 자동 테스트로 확인", 28, INK)}</div>'
    f'</div></div>',
    '인쇄본은 시연 데이터로 PDF를 떠서 눈으로 확인했다. 처음엔 3쪽에 차트가 카드 밖으로 넘쳤다 — 쪽 나눔 기준을 카드 단위로 바꾸고 차트를 종이 폭에 맞춰 줄여 한 장이 됐다. 조항 변경 제안 메모 칸은 넣지 않았다(사용자 결정) — 리포트는 데이터만 보이고, 제안은 따로 문서로 준비한다. 검증: api 자동 테스트 6건(숫자가 원천과 같음, 지점 관리자 403, 없는 지점 404), 화면 자동 테스트 2건.',
    '결정 기록 D81 · 조항 변경 제안 메모는 넣지 않음(사용자 결정)',
    lead='협상 자리에는 화면이 아니라 종이나 PDF를 들고 간다.')))

# PART 02 산출물
S.append(('p2', divider('p2', 'PART 02', '산출물', '여덟 종류를 지금 기준으로 다시 만들었습니다',
          '10월 23일(중간 제출) 기준이던 산출물을 11월 14일 기준으로. 약 3분.')))

deliv = [('요구사항 정의서', 'API 118개 · 충족률 94%'), ('데이터 정의서', '테이블 36개'),
         ('기업 분석 및 제안서', '계약 회차 · 회원 앱 PT'), ('아키텍처 설계서', '계약 처리 흐름 · 결정 이력'),
         ('사용자 매뉴얼', '새 화면 · 캡처 21장'), ('교육 자료', '운영 게시판 첨부 교체'),
         ('진행 보고서 5부', '5부 범위를 11월까지'), ('RFP 이행 증빙', '94% · 화면 30장 새로')]
grid = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px">' + ''.join(
    f'<div style="display:flex; align-items:center; gap:20px; padding:20px 26px; background:{CARDBG}; border:1px solid {LINE}; border-radius:12px">'
    f'<x-icon name="Check" style="color:{GREEN}; width:30px; height:30px"></x-icon>'
    f'<p style="font-family:{HEADF}; font-size:32px; font-weight:700; color:{INK}; width:330px">{t}</p><p style="font-size:26px; color:{SUB}">{d}</p></div>'
    for t, d in deliv) + '</div>'
S.append(('deliv', content('deliv', '산출물', '무엇을 다시 만들었나', grid,
    'RFP가 요구한 산출물 여덟 종류. 중간 제출(10/23) 뒤 바뀐 것 — 위탁계약 회차와 계약서 파일, 문서 파일 올리기, 회원 앱 PT 구매·예약, 사용감 개선, 갱신 리포트 — 을 반영했다. 매뉴얼 · RFP 이행 증빙의 화면 캡처 51장도 새로 찍었다. 교육 자료는 운영 게시판 "직원 교육자료" 공지의 첨부를 새 파일로 바꿨다(사용자). 질문 대비: 기업 분석(RFP 20쪽 이상)은 제출본 14쪽이 요약 · 제안이고, 분석 본문은 기업구조 분석 · 차별화전략 · 도메인 문서에 나뉘어 합쳐 약 26쪽 분량이다(추적표 §1-3).',
    '진행 기록 log/227 · 원천에서 생성기로 만든다(scripts/deliverables/)',
    lead='중간 제출 때(10월 23일) 만든 산출물에는 그 뒤의 위탁계약 회차 · 문서 파일 · 회원 앱 PT가 빠져 있었다.')))

src_rows = [('화면 도움말 · 이용 안내', '사용자 매뉴얼 · 교육 자료', '빠진 도움말 1곳 채움'),
            ('요구사항 추적표 · API 경로', '요구사항 정의서 · 이행 증빙', '설명 없는 API 14개 채움'),
            ('DB 스키마', '데이터 정의서', '이름표 없는 테이블 2개 채움')]
src_html = ''.join(
    f'<div style="display:flex; align-items:center; gap:18px">'
    f'<div style="width:470px; padding:22px 26px; background:{CARDBG}; border:2px solid {LINE2}; border-radius:12px">{mono("원천", color=SUB)}{p(a, 28, INK)}</div>'
    f'<x-shape kind="arrow-right" style="background:{LINE2}; width:44px; height:28px"></x-shape>'
    f'<div style="width:470px; padding:22px 26px; background:#E7ECF1; border:2px solid {NAVY}; border-radius:12px">{mono("산출물")}{p(b, 28, INK)}</div>'
    f'<p style="flex:1; font-size:28px; color:{SUB}; white-space:nowrap">{c}</p></div>' for a, b, c in src_rows)
S.append(('deliv-source', content('deliv-source', '산출물 · 만드는 방법', '원천 한 곳에서 생성한다', src_html,
    '산출물을 손으로 고치지 않고, 코드 · 문서에 있는 원천에서 생성기로 만든다(한 사실은 한 곳에만, D38). 그래서 다시 만드는 비용이 작고, 생성기가 빠진 것을 잡아 준다 — 이번에 설명 없는 API 14개, 이름표 없는 새 테이블 2개, 도움말 없는 화면 1개를 찾았다. 질문 대비: 제안서 · 설계서 · 진행 보고서의 본문은 생성기 안에 사람이 쓴 문장이라, 숫자(라우트 · 테이블 · 테스트 수)는 코드에서 다시 세어 고쳤다.',
    '생성기 scripts/deliverables/ · 한 사실은 한 곳에만(D38)',
    lead='산출물은 손으로 고치지 않는다. 생성기가 원천을 읽어 만들고, 빠진 설명이 있으면 멈춘다.')))

# PART 03 검증과 사용감
S.append(('p3', divider('p3', 'PART 03', '검증과 사용감', '수동 확인뿐이던 곳에 자동 테스트를 붙였습니다',
          '검증 공백 7곳을 테스트로 채웠고, 새 테스트가 좁은 화면의 넘침 3곳을 찾았다. 약 3분.')))

S.append(('verify', content('verify', '검증', '수동 확인뿐이던 일곱 곳', cards_row([
    f'{mono("업무 규칙")}{h3("서버가 지키는 규칙")}{p("프로그램 상태 전이<br>혼잡도 5단계 경계<br>동시 채용", 28, INK)}',
    f'{mono("화면 흐름")}{h3("역할별 화면")}{p("채용 → 발령<br>인사서류 열기<br>계약 파일 보존<br>목록 검색 · 정렬<br>주간 시간표", 28, INK)}',
    f'{mono("좁은 화면")}{h3("800px 폭")}{p("화면 18곳 가로 넘침<br>회차 등록 창 위치", 28, INK)}'])
    + f'<div style="display:flex; align-items:center; gap:16px; padding:20px 28px; background:{SOFT}; border-radius:12px"><x-icon name="Search" style="color:{NAVY}; width:30px; height:30px"></x-icon>'
    f'{p("좁은 화면 검사는 실제 문제를 찾았다 — 다음 장", 28, INK)}</div>',
    '11주차까지 "검증되지 않음 — 수동 확인"으로 적어 두던 일곱 곳(진행률 기준의 검증 묶음). 업무 규칙은 api 자동 테스트(실DB)로, 화면은 화면 자동 테스트(Playwright)로 붙였다. 지금 api 671건 · 화면 35건. 이렇게 말하지 말 것: "모든 화면이 검증됐다" — 화면 자동 테스트는 역할별 핵심 경로만 본다. 여전히 수동 확인인 것: 직원 정보 수정 · 퇴사 화면, 회원 앱 날짜 띠, 계약 파일 실물 이관 · 정리 버튼.',
    '진행 기록 log/228 · 남은 수동 확인: 직원 수정 · 퇴사 화면, 회원 앱 날짜 띠, 계약 파일 이관 · 정리 버튼',
    lead='지금까지 “검증되지 않음 — 수동 확인”으로 남겨 두던 곳들이다.')))

S.append(('narrow', content('narrow', '사용감 · 좁은 화면', '좁은 창에서 깨지던 곳을 고쳤다',
    f'<div style="display:flex; gap:40px; align-items:flex-start">'
    f'<div style="flex:1; display:flex; flex-direction:column; gap:14px">{pill("변경 전", AMBER, "#F6ECDD")}{frame(IMG["narrow_before"], "800px 폭 예약 관리 — 상단 버튼·이름·상태가 글자 중간에서 꺾이고 필터가 잘림", "예약 관리 · 800px", 720, 513)}'
    f'{p("버튼 · 이름이 꺾이고 필터가 잘린다", 28, INK)}</div>'
    f'<div style="flex:1; display:flex; flex-direction:column; gap:14px">{pill("변경 후", GREEN, "#E3F1EA")}{frame(IMG["narrow_after"], "800px 폭 예약 관리 — 상단 바 두 줄, 라벨 한 줄, 필터 두 줄", "예약 관리 · 800px", 720, 513)}'
    f'{p("한 줄로 읽히고 모두 보인다", 28, INK)}</div></div>',
    '좁은 노트북이나 창을 나눠 쓸 때(800px). 테스트가 찾은 넘침 세 곳 — 예약 관리 필터 줄, 문서함 표, 자산 표. 필터 줄은 줄바꿈되게, 표는 표만 가로로 넘기게 고쳤다(본문은 밀리지 않음). 테스트가 처음에 실행마다 결과가 달랐는데, 목록이 그려지기 전에 재면 통과하는 측정 시점 문제였다 — 목록이 다 뜬 뒤 재도록 고쳤다. 덱을 만들며 눈으로 찾은 것도 고쳤다: 상단 바 버튼과 표 안 이름 · 상태 · 버튼이 글자 중간에서 꺾였다 — 넘침 검사로는 안 잡히는 종류라 "꺾인 글자" 검사를 테스트에 더했다. 상단 바는 좁은 폭에서 두 줄(이름 · 버튼 / 회원 찾기), 표 칸은 띄어쓰기에서만 줄바꿈.',
    '문서함 · 자산 · 회원 표는 표만 옆으로 · 꺾인 글자도 테스트가 본다(log/236)',
    lead='좁은 노트북이나 창을 나눠 쓸 때(800px)도 글자가 잘리거나 꺾이면 안 된다.')))

# PART 04 전체 진행률
S.append(('p4', divider('p4', 'PART 04', '전체 진행률', '기준을 세우고 다시 셌습니다',
          'RFP 충족률(기능)과 별도로, 최종 제출까지의 진행률. 약 2분.')))

S.append(('progress', content('progress', '전체 진행률', '최종 제출까지 80%',
    f'<div style="display:flex; flex-direction:column; gap:22px">'
    + bar('기능 구현', 40, 94, 'RFP 충족률 58/62')
    + bar('검증 · 품질', 15, 79, '부하 · 비정상 접근 남음')
    + bar('산출물', 20, 100, '8종 지금 기준')
    + bar('발표 · 제출', 15, 44, '13 · 14 · 15주차(최종)')
    + bar('운영 · 마무리', 10, 40, 'main 병합 등')
    + '</div>'
    + f'<div style="display:flex; align-items:center; gap:24px; padding:22px 28px; background:{CARDBG}; border:1px solid {LINE}; border-radius:12px">'
    f'<p style="font-family:{HEADF}; font-size:56px; font-weight:900; color:{SUB}">66%</p><x-shape kind="arrow-right" style="background:{LINE2}; width:56px; height:32px"></x-shape>'
    f'<p style="font-family:{HEADF}; font-size:56px; font-weight:900; color:{NAVY}">80%</p>'
    f'{p("11월 14일 처음 잰 값 → 남은 일을 더해 다시 센 값", 30, INK)}</div>',
    'RFP 충족률 94%는 기능만 본다. 최종 제출까지의 진행률을 따로 세기 위해 기준을 세웠다(D80) — 묶음 5개(기능 40 · 검증 15 · 산출물 20 · 발표·제출 15 · 운영·마무리 10)의 가중 평균. 평가 기준표가 없어 남은 작업량 기준 초안 가중치(사용자 확인). 처음 잰 값 66%(11/14) → 산출물 재생성(+10) · 검증 보강(+8)으로 84%까지 갔다가, 남은 일을 목록에 더해 다시 세니 80%. 더한 것: 검증에 부하 · 스트레스 · 비정상 접근 경로 테스트 3개(11/14), 발표에 13 · 14주차 발표와 15주차 최종 발표(12주차 덱 포함 4/9). 기준(D80)은 새 항목이 생기면 목록에 더해 분모가 늘어난다. 질문 대비: 항목별 판정은 저장소 docs/reference/진행률.md 한 곳에 있다.',
    '결정 기록 D80 · 항목마다 끝냄 1 · 일부 0.5 · 안 함 0으로 세어 가중 평균',
    lead='RFP 충족률(94%)은 기능만 본다. 최종 제출까지 얼마나 왔는지는 따로 세야 했다.')))

nexts = [('Book', '발표 · 제출', '13 · 14주차 발표<br>15주차 최종 발표 · 제출'),
         ('Activity', '부하 · 비정상 접근', '부하 · 스트레스 테스트<br>비정상 접근 경로'),
         ('Search', '사용감 직접 점검', '남은 스크롤<br>시설 카드 버튼'),
         ('Check', '마무리', '운영 PT 구매 확인<br>브랜치 정리 · main 병합')]
S.append(('wrap', content('wrap', '정리', '다음 할 일', cards_row([
    f'<x-icon name="{ic}" style="color:{NAVY}; width:48px; height:48px"></x-icon>{h3(t)}{p(d)}' for ic, t, d in nexts]),
    '남은 것은 진행률의 발표 · 제출(13 · 14주차 발표, 15주차 최종 발표 · 제출 폴더), 검증(부하 · 스트레스 테스트, 비정상 접근 경로 — 토큰 위 · 변조 · 만료, 권한 밖 직접 호출, 잘못된 입력), 운영 · 마무리(운영 PT 확인 · 브랜치 정리 · main 병합). 사용감은 사용자가 직접 더 써 보며 찾는다 — 공지 등록 버튼 · 회원 앱 예약 취소까지의 스크롤, 넓은 화면에서 시설 카드 버튼이 세로로 찌그러지는 것. 검증 범위(질문 대비): api 자동 테스트 671건(실DB), 화면 자동 테스트 35건 — 그 밖의 화면은 lint · 빌드와 수동 점검.',
    lead='남은 것은 발표 · 제출, 부하 · 비정상 접근 테스트, 사용감 점검, 마무리다.')))

S.append(('closing', f'<section id="closing" data-transition="fade" style="background:{BG}; color:{INK}; font-family:{BODYF}; padding:128px 176px; display:flex; flex-direction:column; gap:24px">{DOTS}'
          f'<div style="flex:1"></div><h1 style="font-family:{HEADF}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:{INK}">감사합니다</h1><div style="flex:1"></div>'
          f'{notes("맺음(말로): 운영 기록을 갱신 협상 자료로 잇는 갱신 리포트를 만들었고, 산출물 여덟 종류를 지금 기준으로 다시 만들었고, 수동 확인뿐이던 일곱 곳에 자동 테스트를 붙였습니다. 최종 제출까지의 진행률은 80%입니다.")}</section>'))

os.makedirs(os.path.join(OUT, 'project', 'slides'), exist_ok=True)
for sid, html in S:
    assert html.count('<section') == 1 and f'id="{sid}"' in html, sid
    with open(os.path.join(OUT, 'project', 'slides', f'{sid}.html'), 'w', encoding='utf-8') as f:
        f.write(html)

order = [sid for sid, _ in S]
deck = {
    'v': 4,
    'createdOnFiles': {'v': 1, 'at': os.environ.get('DECK_CREATED_AT') or datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')},
    'lists': 'css',
    'title': '스포이즘 ERP 12주차 발표',
    'order': order,
    'sections': {
        'intro': {'description': '표지, 오늘 순서 — 11주차의 다음 할 일에서 출발', 'start': 'cover'},
        'report': {'description': '01 계약 갱신 리포트 — 운영 기록을 갱신 협상 자료로(D81)', 'start': 'p1'},
        'deliv': {'description': '02 산출물 — 여덟 종류를 지금 기준으로, 원천에서 생성', 'start': 'p2'},
        'verify': {'description': '03 검증과 사용감 — 수동 확인뿐이던 일곱 곳, 좁은 화면 넘침', 'start': 'p3'},
        'progress': {'description': '04 전체 진행률 — 기준(D80)과 80%, 다음 할 일', 'start': 'p4'},
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
