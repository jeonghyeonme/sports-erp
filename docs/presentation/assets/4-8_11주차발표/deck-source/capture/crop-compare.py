# 변경 전·후 단계 캡처를 덱용으로 자른다. 사용: python3 capture/crop-compare.py screenshots/compare
# - pt-*: 누를 대상(meta-*.json의 위치)을 가운데 둔 640×400(CSS px, 1.6:1) 영역 → step-pt-*.png
# - slot-before-full: 세로로 긴 전체 화면에 첫 화면(900px) 경계를 점선, 회차 등록 폼을 실선으로 표시 → step-slot-before.png
# - slot-after-*: 사이드바 오른쪽 영역 → step-slot-after-*.png
import json, sys
from PIL import Image, ImageDraw

D = sys.argv[1] if len(sys.argv) > 1 else 'screenshots/compare'
S = 2  # deviceScaleFactor
VW, VH = 1440, 900
ORANGE = (224, 89, 42)
meta = {**json.load(open(f'{D}/meta-before.json')), **json.load(open(f'{D}/meta-after.json'))}


def around(name, w=640, h=400):
    b = meta[name]
    cx, cy = b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
    x = min(max(cx - w / 2, 0), VW - w)
    y = min(max(cy - h / 2, 0), VH - h)
    im = Image.open(f'{D}/{name}.png')
    im.crop((int(x * S), int(y * S), int((x + w) * S), int((y + h) * S))).save(f'{D}/step-{name}.png', optimize=True)
    print(f'step-{name}.png')


for n in [f'pt-before-{i}' for i in range(1, 7)] + [f'pt-after-{i}' for i in range(1, 4)]:
    around(n)

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
