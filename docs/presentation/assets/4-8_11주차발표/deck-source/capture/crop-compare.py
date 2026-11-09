# 변경 전·후 단계 캡처를 덱용으로 자른다. 사용: python3 capture/crop-compare.py screenshots/compare
# - pt·find·ptreg·miss: 누를 대상(meta-*.json의 위치)을 가운데 둔 640×400(CSS px, 1.6:1) 영역 → step-*.png. 기본값으로 채워진 칸은 초록 점선
# - slot-before-full: 세로로 긴 전체 화면에 첫 화면(900px) 경계를 점선, 회차 등록 폼을 실선으로 표시 → step-slot-before.png
# - slot-after-*: 사이드바 오른쪽 영역 → step-slot-after-*.png
import json, sys
from PIL import Image, ImageDraw

D = sys.argv[1] if len(sys.argv) > 1 else 'screenshots/compare'
S = 2  # deviceScaleFactor
VW, VH = 1440, 900
ORANGE = (224, 89, 42)
meta = {**json.load(open(f'{D}/meta-before.json')), **json.load(open(f'{D}/meta-after.json'))}


GREEN = (24, 118, 80)


def dashed_rect(dr, box, color, width=8, dash=28, gap=16):
    x0, y0, x1, y1 = box
    for x in range(int(x0), int(x1), dash + gap):
        dr.line([(x, y0), (min(x + dash, x1), y0)], fill=color, width=width)
        dr.line([(x, y1), (min(x + dash, x1), y1)], fill=color, width=width)
    for y in range(int(y0), int(y1), dash + gap):
        dr.line([(x0, y), (x0, min(y + dash, y1))], fill=color, width=width)
        dr.line([(x1, y), (x1, min(y + dash, y1))], fill=color, width=width)


def around(name, w=640, h=400, also=None):
    """대상(과 also — 자동으로 채워진 칸) 주변 w×h(CSS px). also가 있으면 초록 점선으로 표시."""
    b = meta[name]
    x0, y0, x1, y1 = b['x'], b['y'], b['x'] + b['width'], b['y'] + b['height']
    im = Image.open(f'{D}/{name}.png').convert('RGB')
    if also:
        a = meta[also]
        x0, y0, x1, y1 = min(x0, a['x']), min(y0, a['y']), max(x1, a['x'] + a['width']), max(y1, a['y'] + a['height'])
        dashed_rect(ImageDraw.Draw(im), ((a['x'] - 6) * S, (a['y'] - 6) * S, (a['x'] + a['width'] + 6) * S, (a['y'] + a['height'] + 6) * S), GREEN)
    if x1 - x0 + 100 > w:  # 넓은 대상(대상 + 채워진 칸)은 비율을 지킨 채 영역을 넓힌다
        w = x1 - x0 + 100
        h = w / 1.6
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    x = min(max(cx - w / 2, 0), VW - w)
    y = min(max(cy - h / 2, 0), VH - h)
    im.crop((int(x * S), int(y * S), int((x + w) * S), int((y + h) * S))).save(f'{D}/step-{name}.png', optimize=True)
    print(f'step-{name}.png')


STEPS = {'pt': (6, 3), 'find': (4, 2), 'ptreg': (10, 6), 'miss': (8, 7)}
ALSO = {'ptreg-after-5': 'ptreg-after-prefilled', 'miss-after-4': 'miss-after-prefilled'}  # 기본값으로 채워진 칸(초록 점선)
for task, (nb, na) in STEPS.items():
    for i in range(1, nb + 1):
        around(f'{task}-before-{i}')
    for i in range(1, na + 1):
        around(f'{task}-after-{i}', also=ALSO.get(f'{task}-after-{i}'))

# 변경 전 회차 등록: 전체 화면 + 첫 화면 경계(점선) + 폼(실선)
im = Image.open(f'{D}/slot-before-full.png').convert('RGB')
dr = ImageDraw.Draw(im)
y = VH * S
for x in range(0, im.width, 48):
    dr.line([(x, y), (x + 28, y)], fill=ORANGE, width=8)
f = meta['slot-before-form']
dr.rounded_rectangle([(f['x'] - 8) * S, (f['y'] - 8) * S, (f['x'] + f['width'] + 8) * S, (f['y'] + f['height'] + 8) * S], radius=20, outline=ORANGE, width=10)
im = im.crop((0, 0, VW * S, int((f['y'] + f['height'] + 60) * S)))  # 폼 아래 결제 내역은 잘라 낸다
im.save(f'{D}/step-slot-before.png', optimize=True)
print('step-slot-before.png', im.size, 'form y', f['y'])

for n in ('slot-after-1', 'slot-after-2'):
    im = Image.open(f'{D}/{n}.png')
    im.crop((230 * S, 0, VW * S, VH * S)).save(f'{D}/step-{n}.png', optimize=True)
    print(f'step-{n}.png')
