# 화면 안 순서(D73) 예시 — 근태관리 전체 화면에 구역마다 순서도 번호(1 처리할 일 · 2 지금 상태 · 3 입력 폼 · 4 쌓이는 기록)를
# 색 막대와 큰 번호로 겹친다. 사이드바 자리에 그린다(메뉴는 이 장의 메시지와 무관). 사용: python3 capture/annotate-attendance.py screenshots/compare
import json, sys
from PIL import Image, ImageDraw, ImageFont

D = sys.argv[1] if len(sys.argv) > 1 else 'screenshots/compare'
S = 2
CAT = {'휴가 승인함': 1, '오늘의 근태': 2, '휴가 일수': 2, '업무일지': 3, '휴가 신청': 3,
       '이번 달 근태 기록': 4, '내 휴가 신청 내역': 4, '내 업무일지': 4, '지점 근태 요약(이번 달)': 4}
COLOR = {1: (194, 65, 12), 2: (30, 58, 95), 3: (24, 118, 80), 4: (107, 114, 128)}
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 150)

for mode in ('before', 'after'):
    meta = json.load(open(f'{D}/attendance-{mode}.json'))
    im = Image.open(f'{D}/attendance-{mode}.png').convert('RGB')
    dr = ImageDraw.Draw(im)
    dr.rectangle([(0, 0), (232 * S, im.height)], fill=(244, 245, 243))  # 사이드바 자리를 비워 번호만 보이게
    # 같은 줄에 나란한 구역(오늘의 근태·휴가 일수 등)은 한 번만 그린다 — 구역 아래 끝은 다음 줄의 시작
    rows = {}
    for sec in meta['sections']:
        if sec['text'] in CAT:
            rows.setdefault(round(sec['y']), CAT[sec['text']])
    ys = sorted({round(sec['y']) for sec in meta['sections']}) + [meta['size']['height']]
    for y, cat in sorted(rows.items()):
        top, bottom = y - 10, next(v for v in ys if v > y) - 20
        dr.rectangle([(210 * S, top * S), (226 * S, bottom * S)], fill=COLOR[cat])
        cx, cy, r = 150 * S, (y + 40) * S, 58 * S
        dr.ellipse([(cx - r, cy - r), (cx + r, cy + r)], fill=COLOR[cat])
        dr.text((cx, cy), str(cat), font=FONT, fill=(255, 255, 255), anchor='mm')
    for x in range(0, im.width, 48):  # 첫 화면(900px) 경계
        dr.line([(x, 900 * S), (x + 28, 900 * S)], fill=(224, 89, 42), width=8)
    im.crop((60 * S, 0, im.width, im.height)).save(f'{D}/step-attendance-{mode}.png', optimize=True)
    print(mode, im.size)
